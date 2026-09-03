"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useShallow } from "zustand/react/shallow";
import {
    ChartNoAxesCombined,
    ChevronRight,
    CircleArrowRight,
    CornerDownRight,
    ExternalLink,
    Info,
    LockKeyhole,
    Pin,
    Search,
    Settings2,
    Wrench,
} from "lucide-react";
import { useDataContext } from "@/app/(data)/_dataContext";
import { DataLoadError } from "@/components/core/DataLoadError";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
    evaluateBarters,
    evaluateCrafts,
    getItemBuyPrice,
    getItemSellComparison,
    getItemSellPrice,
    type AcquisitionPlan,
    type ManualPriceOverride,
    type RecipeEvaluation,
} from "@/lib/price-calculation";
import { formatCompactRoubles, formatRoubles } from "@/lib/utils/market-price";
import type { BarterRecord, CraftRecord, GlobalItem, GlobalItemVendorPrice, Station, Trader } from "@/types";
import type { ProfitPageData } from "@/server/services/profitPages";
import { useManualPriceOverrides } from "./useManualPriceOverrides";
import { usePinnedCrafts } from "./usePinnedCrafts";

type ProfitPageKind = "barter" | "craft";
type SortMode = "profit" | "profitPerHour" | "cost" | "name";

interface ProfitPageClientProps {
    kind: ProfitPageKind;
    data: ProfitPageData;
    initialTargetRecipeId?: string;
}

function indexByOutput<T>(records: T[], getItemId: (record: T) => string) {
    const index: Record<string, T[]> = Object.create(null) as Record<string, T[]>;
    for (const record of records) (index[getItemId(record)] ??= []).push(record);
    return index;
}

export function ProfitPageClient({ kind, data, initialTargetRecipeId }: ProfitPageClientProps) {
    const router = useRouter();
    const { items, itemById, itemsError, stations } = useDataContext();
    const {
        gameMode,
        stationLevels,
        completedQuests,
        traderLoyaltyLevels,
        hiddenStations,
        completedRequirements,
    } = useUserStore(
        useShallow((state) => ({
            gameMode: state.gameMode,
            stationLevels: state.stationLevels,
            completedQuests: state.completedQuests,
            traderLoyaltyLevels: state.questTraderLoyaltyLevels,
            hiddenStations: state.hiddenStations,
            completedRequirements: state.completedRequirements,
        })),
    );
    const { overrides, setItemOverride } = useManualPriceOverrides(gameMode);
    const { pinnedCrafts, togglePinnedCraft } = usePinnedCrafts(gameMode);
    const [search, setSearch] = useState("");
    const [sourceId, setSourceId] = useState("all");
    const [availableOnly, setAvailableOnly] = useState(true);
    const [profitableOnly, setProfitableOnly] = useState(false);
    const [showPinnedOnly, setShowPinnedOnly] = useState(false);
    const [allowCrafts, setAllowCrafts] = useState(true);
    const [allowBarters, setAllowBarters] = useState(true);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [targetRecipeId, setTargetRecipeId] = useState<string | null>(initialTargetRecipeId ?? null);
    const [sortMode, setSortMode] = useState<SortMode>(
        kind === "craft" ? "profitPerHour" : "profit",
    );

    const bartersByItemId = useMemo(
        () => indexByOutput(data.barters, (barter) => barter.offeredItemId),
        [data.barters],
    );
    const craftsByItemId = useMemo(
        () => indexByOutput(data.crafts, (craft) => craft.productItemId),
        [data.crafts],
    );

    const evaluations = useMemo(() => {
        const context = {
            itemsById: itemById,
            bartersByItemId,
            craftsByItemId,
            overrides,
            allowCrafts,
            allowBarters,
        };
        return kind === "barter"
            ? evaluateBarters(data.barters, context)
            : evaluateCrafts(data.crafts, context);
    }, [allowBarters, allowCrafts, bartersByItemId, craftsByItemId, data.barters, data.crafts, itemById, kind, overrides]);

    const tradersById = useMemo(
        () => Object.fromEntries(data.traders.map((trader) => [trader.id, trader])),
        [data.traders],
    );
    const stationsById = useMemo(
        () => Object.fromEntries((stations ?? []).map((station) => [station.id, station])),
        [stations],
    );
    const bartersById = useMemo(
        () => Object.fromEntries(data.barters.map((barter) => [barter.id, barter])),
        [data.barters],
    );
    const craftsById = useMemo(
        () => Object.fromEntries(data.crafts.map((craft) => [craft.id, craft])),
        [data.crafts],
    );

    const sources = useMemo(() => {
        if (kind === "barter") {
            return [...new Set(data.barters.map((barter) => barter.traderId))]
                .map((id) => ({ id, name: tradersById[id]?.name ?? id }))
                .sort((left, right) => left.name.localeCompare(right.name));
        }
        return [...new Set(data.crafts.map((craft) => craft.stationId))]
            .map((id) => ({ id, name: stationsById[id]?.name ?? id }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [data.barters, data.crafts, kind, stationsById, tradersById]);

    const visibleEvaluations = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return evaluations
            .filter((evaluation) => {
                if (kind === "craft" && showPinnedOnly && !pinnedCrafts[evaluation.id]) return false;
                if (evaluation.id === targetRecipeId) return true;
                const item = itemById[evaluation.outputItemId];
                if (
                    normalizedSearch &&
                    !item?.name.toLowerCase().includes(normalizedSearch) &&
                    !item?.shortName?.toLowerCase().includes(normalizedSearch)
                ) return false;
                if (sourceId !== "all" && getRecipeSourceId(evaluation) !== sourceId) return false;
                if (profitableOnly && (evaluation.profit ?? Number.NEGATIVE_INFINITY) <= 0) return false;
                if (
                    availableOnly &&
                    !isRecipeAvailable(
                        evaluation,
                        stationLevels,
                        traderLoyaltyLevels,
                        completedQuests,
                    )
                ) return false;
                return true;
            })
            .sort((left, right) => compareEvaluations(left, right, sortMode, itemById));
    }, [
        availableOnly,
        completedQuests,
        evaluations,
        itemById,
        kind,
        profitableOnly,
        pinnedCrafts,
        search,
        showPinnedOnly,
        sortMode,
        sourceId,
        stationLevels,
        targetRecipeId,
        traderLoyaltyLevels,
    ]);

    const relevantError = kind === "barter" ? data.bartersError : data.craftsError;
    const hasProfitData = Boolean(items && !itemsError && !relevantError);
    const listRef = useRef<HTMLDivElement>(null);
    const lastScrolledRecipeIdRef = useRef<string | null>(null);
    const [scrollMargin, setScrollMargin] = useState(0);

    useLayoutEffect(() => {
        if (!hasProfitData) return;

        const updateScrollMargin = () => {
            if (!listRef.current) return;
            setScrollMargin(listRef.current.getBoundingClientRect().top + window.scrollY);
        };

        updateScrollMargin();
        window.addEventListener("resize", updateScrollMargin);
        return () => window.removeEventListener("resize", updateScrollMargin);
    }, [hasProfitData, kind]);

    const virtualizer = useWindowVirtualizer({
        count: visibleEvaluations.length,
        estimateSize: (index) => estimateProfitRowHeight(visibleEvaluations[index]),
        getItemKey: (index) => visibleEvaluations[index]?.id ?? index,
        overscan: 8,
        scrollMargin,
    });

    useEffect(() => {
        if (!targetRecipeId) return;
        if (lastScrolledRecipeIdRef.current === targetRecipeId) return;
        const targetIndex = visibleEvaluations.findIndex((evaluation) => evaluation.id === targetRecipeId);
        if (targetIndex < 0) return;
        virtualizer.scrollToIndex(targetIndex, { align: "center" });
        lastScrolledRecipeIdRef.current = targetRecipeId;
    }, [targetRecipeId, virtualizer, visibleEvaluations]);

    function goToRecipe(method: "barter" | "craft", recipeId: string) {
        const route = method === "barter"
            ? "/items/barter-profits"
            : "/items/crafting-profits";
        if (method !== kind) {
            router.push(`${route}?recipe=${encodeURIComponent(recipeId)}`);
            return;
        }
        router.replace(`${route}?recipe=${encodeURIComponent(recipeId)}`, { scroll: false });
        setTargetRecipeId(recipeId);
    }

    if (!items || itemsError || relevantError) {
        return (
            <main className="container mx-auto px-6 py-8">
                <DataLoadError
                    title={`${kind === "barter" ? "Barter" : "Craft"} profit data is unavailable`}
                    messages={[itemsError, relevantError, !items ? "Item prices could not be loaded." : null].filter(
                        (message): message is string => Boolean(message),
                    )}
                />
            </main>
        );
    }

    const totalProfit = visibleEvaluations.reduce(
        (total, evaluation) => total + Math.max(0, evaluation.profit ?? 0),
        0,
    );

    return (
        <main className="container mx-auto px-4 py-8 sm:px-6">
            <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-tarkov-green">
                        Average 24-hour market prices
                    </p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
                        {kind === "barter" ? "BARTER PROFITS" : "CRAFTING PROFITS"}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        Ingredient costs follow the cheapest practical mix of flea purchases,
                        crafts, and barters. Manual prices override market data for this {gameMode} profile.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <Stat label="Recipes" value={visibleEvaluations.length.toLocaleString()} />
                    <Stat
                        label="Profitable"
                        value={visibleEvaluations.filter((entry) => (entry.profit ?? 0) > 0).length.toLocaleString()}
                    />
                    <Stat label="Positive value" value={formatRoundedRoubles(totalProfit)} />
                </div>
            </header>

            <section className="mb-4 rounded-md border border-white/10 bg-card/70 p-3 shadow-lg">
                <div className={`grid gap-3 ${kind === "craft" ? "lg:grid-cols-[minmax(220px,1fr)_220px_180px_auto_auto]" : "lg:grid-cols-[minmax(220px,1fr)_220px_180px_auto]"}`}>
                    <label className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search output item"
                            className="h-9 w-full rounded border border-white/10 bg-black/30 pl-9 pr-3 text-sm outline-none focus:border-tarkov-green/60"
                        />
                    </label>
                    <select
                        value={sourceId}
                        onChange={(event) => setSourceId(event.target.value)}
                        className="h-9 rounded border border-white/10 bg-[#11151a] px-3 text-sm text-foreground"
                    >
                        <option className="bg-[#11151a] text-foreground" value="all">All {kind === "barter" ? "traders" : "stations"}</option>
                        {sources.map((source) => (
                            <option className="bg-[#11151a] text-foreground" key={source.id} value={source.id}>{source.name}</option>
                        ))}
                    </select>
                    <select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as SortMode)}
                        className="h-9 rounded border border-white/10 bg-[#11151a] px-3 text-sm text-foreground"
                    >
                        <option className="bg-[#11151a] text-foreground" value="profit">Route profit</option>
                        <option className="bg-[#11151a] text-foreground" value="profitPerHour">Route profit / hour</option>
                        <option className="bg-[#11151a] text-foreground" value="cost">Lowest cost</option>
                        <option className="bg-[#11151a] text-foreground" value="name">Item name</option>
                    </select>
                    <CalculationSettings
                        availableOnly={availableOnly}
                        onAvailableOnlyChange={setAvailableOnly}
                        profitableOnly={profitableOnly}
                        onProfitableOnlyChange={setProfitableOnly}
                        allowCrafts={allowCrafts}
                        onAllowCraftsChange={setAllowCrafts}
                        allowBarters={allowBarters}
                        onAllowBartersChange={setAllowBarters}
                    />
                    {kind === "craft" && (
                        <button
                            type="button"
                            aria-pressed={showPinnedOnly}
                            aria-label="Show pinned crafts only"
                            title={showPinnedOnly ? "Show all crafts" : "Show pinned crafts only"}
                            onClick={() => setShowPinnedOnly((value) => !value)}
                            className={`flex h-9 items-center justify-center rounded border px-3 transition ${showPinnedOnly ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : "border-white/10 bg-black/20 text-muted-foreground hover:border-sky-400/30 hover:text-sky-300"}`}
                        >
                            <Pin className={`size-4 ${showPinnedOnly ? "fill-current" : ""}`} />
                        </button>
                    )}
                </div>
            </section>

            <div className="overflow-x-auto rounded-md border border-white/10 bg-card/50">
                <div className={`grid w-full min-w-[1000px] border-b border-white/10 bg-black/30 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${profitGrid()}`}>
                    <span aria-label="Actions" /><span>Source</span><span>Produced item</span><span>Required items</span><span className="px-3">Cost</span><span className="px-3">Sell value</span><span className="px-3">Route profit</span><span className="px-3">Route profit / hour</span>
                </div>
                <div ref={listRef} className="w-full min-w-[1000px]">
                    {visibleEvaluations.length > 0 ? (
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                position: "relative",
                                width: "100%",
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const evaluation = visibleEvaluations[virtualRow.index];
                                const translateY =
                                    virtualRow.start - virtualizer.options.scrollMargin;

                                return (
                                    <div
                                        key={virtualRow.key}
                                        data-index={virtualRow.index}
                                        ref={virtualizer.measureElement}
                                        className="absolute left-0 top-0 w-full border-b border-white/10"
                                        style={{ transform: `translateY(${translateY}px)` }}
                                    >
                                        <ProfitRow
                                            evaluation={evaluation}
                                            itemById={itemById}
                                            sourceName={
                                                kind === "barter"
                                                    ? tradersById[evaluation.barter?.traderId ?? ""]?.name
                                                    : stationsById[evaluation.craft?.stationId ?? ""]?.name
                                            }
                                            available={isRecipeAvailable(
                                                evaluation,
                                                stationLevels,
                                                traderLoyaltyLevels,
                                                completedQuests,
                                            )}
                                            source={kind === "barter"
                                                ? tradersById[evaluation.barter?.traderId ?? ""]
                                                : stationsById[evaluation.craft?.stationId ?? ""]}
                                            overrides={overrides}
                                            onPriceChange={setItemOverride}
                                            bartersById={bartersById}
                                            craftsById={craftsById}
                                            tradersById={tradersById}
                                            stationsById={stationsById}
                                            onItemOpen={setSelectedItemId}
                                            onGoToRecipe={goToRecipe}
                                            highlighted={evaluation.id === targetRecipeId}
                                            pinned={kind === "craft" && Boolean(pinnedCrafts[evaluation.id])}
                                            onTogglePinned={kind === "craft" ? () => togglePinnedCraft(evaluation.id) : undefined}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="px-4 py-14 text-center text-sm text-muted-foreground">
                            {kind === "craft" && showPinnedOnly
                                ? Object.keys(pinnedCrafts).length === 0
                                    ? "No pinned crafts yet. Pin a craft from the actions column to add it here."
                                    : "No pinned crafts match these filters."
                                : "No recipes match these filters."}
                        </div>
                    )}
                </div>
            </div>
            <ItemDetailModal
                item={selectedItemId ? itemById[selectedItemId] ?? null : null}
                isOpen={selectedItemId !== null}
                onClose={() => setSelectedItemId(null)}
                stations={stations}
                stationLevels={stationLevels}
                hiddenStations={hiddenStations}
                completedRequirements={completedRequirements}
            />
        </main>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded border border-white/10 bg-black/25 px-3 py-2">
            <div className="text-muted-foreground">{label}</div>
            <div className="mt-0.5 font-mono font-semibold text-foreground">{value}</div>
        </div>
    );
}

function CalculationSettings({
    availableOnly,
    onAvailableOnlyChange,
    profitableOnly,
    onProfitableOnlyChange,
    allowCrafts,
    onAllowCraftsChange,
    allowBarters,
    onAllowBartersChange,
}: {
    availableOnly: boolean;
    onAvailableOnlyChange: (value: boolean) => void;
    profitableOnly: boolean;
    onProfitableOnlyChange: (value: boolean) => void;
    allowCrafts: boolean;
    onAllowCraftsChange: (value: boolean) => void;
    allowBarters: boolean;
    onAllowBartersChange: (value: boolean) => void;
}) {
    return (
        <details className="group/settings relative">
            <summary className="flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded border border-white/10 bg-black/20 px-3 text-xs font-semibold text-muted-foreground hover:border-white/20 hover:text-foreground">
                <Settings2 className="size-4" />
                Options
            </summary>
            <div className="absolute right-0 top-11 z-50 w-72 rounded-md border border-white/15 bg-[#080a0d] p-3 shadow-2xl">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">List filters</p>
                <Toggle checked={availableOnly} onChange={onAvailableOnlyChange} label="Available to me" />
                <Toggle checked={profitableOnly} onChange={onProfitableOnlyChange} label="Profitable recipes only" />
                <p className="mb-2 mt-3 border-t border-white/10 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ingredient routes</p>
                <Toggle checked={allowCrafts} onChange={onAllowCraftsChange} label="Use crafts for ingredients" />
                <Toggle checked={allowBarters} onChange={onAllowBartersChange} label="Use barters for ingredients" />
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">The recipe being evaluated remains visible; these options only change how its required items are acquired.</p>
            </div>
        </details>
    );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
    return <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-white/5"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-lime-400" />{label}</label>;
}

function ProfitRow({
    evaluation,
    itemById,
    sourceName,
    available,
    source,
    overrides,
    onPriceChange,
    bartersById,
    craftsById,
    tradersById,
    stationsById,
    onItemOpen,
    onGoToRecipe,
    highlighted,
    pinned,
    onTogglePinned,
}: {
    evaluation: RecipeEvaluation;
    itemById: Readonly<Record<string, GlobalItem>>;
    sourceName?: string;
    available: boolean;
    source?: Trader | Station;
    overrides: Record<string, ManualPriceOverride>;
    onPriceChange: (itemId: string, override: ManualPriceOverride) => void;
    bartersById: Readonly<Record<string, BarterRecord>>;
    craftsById: Readonly<Record<string, CraftRecord>>;
    tradersById: Readonly<Record<string, Trader>>;
    stationsById: Readonly<Record<string, Station>>;
    onItemOpen: (itemId: string) => void;
    onGoToRecipe: (method: "barter" | "craft", recipeId: string) => void;
    highlighted: boolean;
    pinned: boolean;
    onTogglePinned?: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const output = itemById[evaluation.outputItemId];
    const routeContext = { itemById, bartersById, craftsById, tradersById, stationsById };
    const hasNestedRecipe = evaluation.requiredItems.some(hasRecipeRoute);
    return (
        <div className={highlighted ? "bg-tarkov-green/[0.06] ring-1 ring-inset ring-tarkov-green/40" : undefined}>
            <div className={`grid min-h-[72px] items-stretch ${profitGrid()}`}>
                <div className="flex flex-col items-center justify-center gap-1 border-r border-white/5 bg-black/10">
                    {onTogglePinned && (
                        <button
                            type="button"
                            aria-pressed={pinned}
                            aria-label={pinned ? "Unpin craft" : "Pin craft"}
                            title={pinned ? "Unpin craft" : "Pin craft"}
                            onClick={onTogglePinned}
                            className={`flex size-7 items-center justify-center rounded border transition ${pinned ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-sky-400/40 hover:text-sky-300"}`}
                        >
                            <Pin className={`size-4 ${pinned ? "fill-current" : ""}`} />
                        </button>
                    )}
                    {hasNestedRecipe && (
                        <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "Collapse" : "Expand"} recipe chain`}
                            title={`${expanded ? "Collapse" : "Expand"} recipe chain`}
                            onClick={() => setExpanded((value) => !value)}
                            className="flex size-7 items-center justify-center rounded border border-white/10 bg-white/[0.035] text-muted-foreground transition hover:border-tarkov-green/50 hover:text-tarkov-green"
                        >
                            <ChevronRight className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
                        </button>
                    )}
                </div>
                <SourceBlock evaluation={evaluation} source={source} available={available} />
                <div className="min-w-0 border-r border-white/5">
                    <ItemCard
                        item={output}
                        count={evaluation.outputCount}
                        method={evaluation.kind}
                        totalPrice={evaluation.sellValue}
                        priceKind="sell"
                        emphasized
                        fillColumn
                        showRouteIcon={false}
                        overrides={overrides}
                        onPriceChange={onPriceChange}
                        routeContext={routeContext}
                        onItemOpen={onItemOpen}
                        recipePreview={{
                            kind: evaluation.kind,
                            sourceId: evaluation.id,
                            outputItemId: evaluation.outputItemId,
                            outputCount: evaluation.outputCount,
                            batches: 1,
                            requiredItems: evaluation.requiredItems,
                            durationSeconds: evaluation.craft?.duration ?? 0,
                        }}
                        detail={evaluation.barter
                            ? `Barter with ${sourceName ?? "unknown trader"} at LL${evaluation.barter.minTraderLevel}`
                            : `Craft at ${sourceName ?? "unknown station"} level ${evaluation.craft?.level ?? "?"} · ${formatDuration(evaluation.craft?.duration ?? 0)}`}
                    />
                </div>
                <div className="flex min-w-0 flex-col justify-center py-0.5">
                    {evaluation.requiredItems.map((plan) => (
                        <ItemCard
                            key={`${plan.itemId}:${plan.isTool === true}`}
                            item={itemById[plan.itemId]}
                            count={plan.quantity}
                            method={plan.method}
                            totalPrice={plan.totalCost}
                            plan={plan}
                            priceKind="buy"
                            overrides={overrides}
                            onPriceChange={onPriceChange}
                            routeContext={routeContext}
                            compactLine
                            onItemOpen={onItemOpen}
                            onGoToRecipe={onGoToRecipe}
                        />
                    ))}
                </div>
                <Cell label="Cost">{formatRoundedRoubles(evaluation.cost)}</Cell>
                <SellValueCell
                    item={output}
                    count={evaluation.outputCount}
                    sellValue={evaluation.sellValue}
                    overrides={overrides}
                />
                <Cell
                    label="Route profit"
                    value={evaluation.profit}
                    detail={`Total time ${evaluation.durationSeconds > 0 ? formatDuration(evaluation.durationSeconds) : "-"}`}
                    infoTitle="Sell the ingredients instead"
                    info={evaluation.profitVsSellingInputs !== null && evaluation.profitVsSellingInputs < 0 && evaluation.inputSellValue !== null && evaluation.sellValue !== null ? <>
                        <span className="block">Selling all non-tool ingredients individually would return <strong className="text-white">{formatRoundedRoubles(evaluation.inputSellValue)}</strong>.</span>
                        <span className="mt-1 block">The {evaluation.kind === "barter" ? "barter" : "craft"} output sells for <strong className="text-white">{formatRoundedRoubles(evaluation.sellValue)}</strong>.</span>
                        <span className="mt-2 block border-t border-white/10 pt-2 text-amber-200">If you already own the ingredients, selling them separately is worth <strong>{formatRoundedRoubles(-evaluation.profitVsSellingInputs)}</strong> more.</span>
                    </> : undefined}
                >
                    {formatSignedRoubles(evaluation.profit)}
                </Cell>
                <Cell label="Route profit / hour" value={evaluation.profitPerHour}>
                    {formatSignedRoubles(evaluation.profitPerHour)}
                </Cell>
            </div>
            {expanded && hasNestedRecipe && (
                <RecipeChain
                    evaluation={evaluation}
                    itemById={itemById}
                    routeContext={routeContext}
                    onGoToRecipe={onGoToRecipe}
                />
            )}
        </div>
    );
}

interface RouteContext {
    itemById: Readonly<Record<string, GlobalItem>>;
    bartersById: Readonly<Record<string, BarterRecord>>;
    craftsById: Readonly<Record<string, CraftRecord>>;
    tradersById: Readonly<Record<string, Trader>>;
    stationsById: Readonly<Record<string, Station>>;
}

interface RecipePreviewData {
    kind: "barter" | "craft";
    sourceId: string;
    outputItemId: string;
    outputCount: number;
    batches: number;
    requiredItems: AcquisitionPlan[];
    durationSeconds: number;
}

function getPlanRecipePreview(
    plan: AcquisitionPlan | undefined,
    context: RouteContext,
): RecipePreviewData | undefined {
    if (!plan?.sourceId || (plan.method !== "barter" && plan.method !== "craft")) return undefined;
    if (plan.method === "barter") {
        const barter = context.bartersById[plan.sourceId];
        if (!barter) return undefined;
        return {
            kind: "barter",
            sourceId: barter.id,
            outputItemId: barter.offeredItemId,
            outputCount: barter.offeredCount,
            batches: plan.batches,
            requiredItems: plan.children,
            durationSeconds: plan.durationSeconds,
        };
    }
    const craft = context.craftsById[plan.sourceId];
    if (!craft) return undefined;
    return {
        kind: "craft",
        sourceId: craft.id,
        outputItemId: craft.productItemId,
        outputCount: craft.productCount,
        batches: plan.batches,
        requiredItems: plan.children,
        durationSeconds: craft.duration,
    };
}

function RecipePreviewCard({
    preview,
    itemById,
    routeContext,
}: {
    preview: RecipePreviewData;
    itemById: Readonly<Record<string, GlobalItem>>;
    routeContext: RouteContext;
}) {
    const barter = preview.kind === "barter" ? routeContext.bartersById[preview.sourceId] : undefined;
    const craft = preview.kind === "craft" ? routeContext.craftsById[preview.sourceId] : undefined;
    const source = barter
        ? routeContext.tradersById[barter.traderId]
        : craft
            ? routeContext.stationsById[craft.stationId]
            : undefined;
    const output = itemById[preview.outputItemId];

    return (
        <span className="block min-w-0 flex-1 overflow-hidden rounded-md border border-white/15 bg-[#05070a] shadow-[0_18px_55px_rgba(0,0,0,0.8)]">
            <span className="flex items-center gap-2 border-b border-white/10 bg-white/[0.035] px-3 py-2">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded border ${preview.kind === "craft" ? "border-orange-400/25 bg-orange-400/10 text-orange-300" : "border-sky-400/25 bg-sky-400/10 text-sky-300"}`}>
                    {preview.kind === "craft" ? <Wrench className="size-4" /> : <CircleArrowRight className="size-4" />}
                </span>
                {source?.imageLink && <Image src={source.imageLink} alt="" width={30} height={30} className="size-8 rounded object-contain" unoptimized />}
                <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-white">
                        {source?.name ?? (preview.kind === "craft" ? "Unknown station" : "Unknown trader")}
                        {barter ? ` · LL${barter.minTraderLevel}` : craft ? ` · Level ${craft.level}` : ""}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                        {preview.kind === "craft" ? `Crafts ${output?.name ?? "item"}` : `Barters for ${output?.name ?? "item"}`}
                        {preview.batches > 1 ? ` · ${preview.batches} batches` : ""}
                    </span>
                </span>
            </span>
            <span className="block p-2">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Required items</span>
                {preview.requiredItems.map((requirement, index) => {
                    const item = itemById[requirement.itemId];
                    return (
                        <span key={`${requirement.itemId}:${requirement.isTool === true}:${index}`} className="flex h-9 items-center gap-2 border-t border-white/5 first:border-t-0">
                            {item?.iconLink ? <Image src={item.iconLink} alt="" width={30} height={30} className="size-8 shrink-0 object-contain" unoptimized /> : <span className="size-8 shrink-0" />}
                            <span className="min-w-0 flex-1 truncate text-[10px] text-foreground">{item?.name ?? "Unknown item"}</span>
                            <span className="font-mono text-[9px] text-muted-foreground">×{formatQuantity(requirement.quantity)}</span>
                            <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${routeChipClasses(requirement.method)}`}>{requirement.method}</span>
                        </span>
                    );
                })}
                {preview.kind === "craft" && preview.durationSeconds > 0 && (
                    <span className="mt-1 block border-t border-white/10 pt-1 text-right font-mono text-[9px] text-orange-300">{formatDuration(preview.durationSeconds)}</span>
                )}
            </span>
        </span>
    );
}

function hasRecipeRoute(plan: AcquisitionPlan): boolean {
    return plan.method === "barter" || plan.method === "craft" || plan.children.some(hasRecipeRoute);
}

function RecipeChain({
    evaluation,
    itemById,
    routeContext,
    onGoToRecipe,
}: {
    evaluation: RecipeEvaluation;
    itemById: Readonly<Record<string, GlobalItem>>;
    routeContext: RouteContext;
    onGoToRecipe: (method: "barter" | "craft", recipeId: string) => void;
}) {
    const recipeBranches = evaluation.requiredItems.filter(
        (plan) => plan.method === "barter" || plan.method === "craft",
    );

    return (
        <div className="border-t border-white/10 bg-black/15">
            {recipeBranches.map((plan, index) => (
                <div key={`${plan.itemId}:${plan.isTool === true}:${index}`} className="border-t border-white/10 first:border-t-0">
                    <RecipeChainNode
                        plan={plan}
                        depth={0}
                        root
                        itemById={itemById}
                        routeContext={routeContext}
                        onGoToRecipe={onGoToRecipe}
                    />
                    {plan.children.map((child, childIndex) => (
                        <RecipeChainNode
                            key={`${child.itemId}:${child.isTool === true}:${childIndex}`}
                            plan={child}
                            depth={1}
                            itemById={itemById}
                            routeContext={routeContext}
                            onGoToRecipe={onGoToRecipe}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

function RecipeChainNode({
    plan,
    depth,
    itemById,
    routeContext,
    onGoToRecipe,
    root = false,
}: {
    plan: AcquisitionPlan;
    depth: number;
    itemById: Readonly<Record<string, GlobalItem>>;
    routeContext: RouteContext;
    onGoToRecipe: (method: "barter" | "craft", recipeId: string) => void;
    root?: boolean;
}) {
    const item = itemById[plan.itemId];
    const preview = getPlanRecipePreview(plan, routeContext);
    const source = preview?.kind === "barter"
        ? routeContext.tradersById[routeContext.bartersById[preview.sourceId]?.traderId]
        : preview?.kind === "craft"
            ? routeContext.stationsById[routeContext.craftsById[preview.sourceId]?.stationId]
            : undefined;

    return (
        <div>
            <div
                className={`group/chain flex min-h-10 items-center gap-2 pr-3 hover:bg-white/[0.025] ${root ? "min-h-12 bg-white/[0.02]" : ""}`}
                style={{ paddingLeft: `${12 + Math.min(depth, 8) * 24}px` }}
            >
                {!root && <CornerDownRight className="size-3.5 shrink-0 text-white/25" />}
                {item?.iconLink ? <Image src={item.iconLink} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" unoptimized /> : <span className="size-8 shrink-0" />}
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-foreground">{item?.name ?? "Unknown item"}</span>
                    <span className="block truncate text-[9px] text-muted-foreground">
                        {source ? `${source.name} · ` : ""}{describeChainRoute(plan, routeContext)}
                    </span>
                </span>
                {plan.isTool && <span className="rounded bg-sky-400 px-1 py-0.5 text-[7px] font-black uppercase text-black">tool</span>}
                <span className="font-mono text-[10px] text-muted-foreground">×{formatQuantity(plan.quantity)}</span>
                <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${routeChipClasses(plan.method)}`}>{plan.method}</span>
                <span className="w-20 text-right font-mono text-[10px] text-foreground">{plan.isTool ? "Excluded" : formatRoundedRoubles(plan.totalCost)}</span>
                {plan.durationSeconds > 0 && (
                    <span className="w-16 text-right font-mono text-[10px] text-orange-300">{formatDuration(plan.durationSeconds)}</span>
                )}
                {preview && plan.sourceId && (plan.method === "barter" || plan.method === "craft") && (
                    <button
                        type="button"
                        title={`Go to ${plan.method} recipe`}
                        onClick={() => onGoToRecipe(plan.method as "barter" | "craft", plan.sourceId as string)}
                        className="flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-tarkov-green group-hover/chain:opacity-100 focus:opacity-100"
                    >
                        <ExternalLink className="size-3.5" />
                    </button>
                )}
            </div>
            {!root && plan.children.length > 0 && (
                <div>
                    {plan.children.map((child, index) => (
                        <RecipeChainNode
                            key={`${child.itemId}:${child.isTool === true}:${index}`}
                            plan={child}
                            depth={depth + 1}
                            itemById={itemById}
                            routeContext={routeContext}
                            onGoToRecipe={onGoToRecipe}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function describeChainRoute(plan: AcquisitionPlan, context: RouteContext) {
    if (plan.method === "flea") return "Flea market";
    if (plan.method === "unavailable") return "No priced route";
    if (plan.method === "barter" && plan.sourceId) {
        const barter = context.bartersById[plan.sourceId];
        return `Barter LL${barter?.minTraderLevel ?? "?"}${plan.batches > 1 ? ` · ${plan.batches} batches` : ""}`;
    }
    if (plan.method === "craft" && plan.sourceId) {
        const craft = context.craftsById[plan.sourceId];
        return `Craft level ${craft?.level ?? "?"}${plan.batches > 1 ? ` · ${plan.batches} batches` : ""}`;
    }
    return "Acquisition route";
}

function SourceBlock({ evaluation, source, available }: { evaluation: RecipeEvaluation; source?: Trader | Station; available: boolean }) {
    return (
        <span className="flex flex-col items-center justify-center gap-0.5 border-r border-white/5 px-2 text-center">
            <span className="relative flex size-9 items-center justify-center">
                {source?.imageLink && (
                    <Image src={source.imageLink} alt="" width={36} height={36} className="size-9 rounded object-contain" unoptimized />
                )}
                {!available && (
                    <span title="Locked for the current profile" className="absolute -right-5 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-[3px] bg-amber-400 text-black shadow-md">
                        <LockKeyhole className="size-2.5 stroke-[3]" />
                    </span>
                )}
            </span>
            <span className="flex max-w-full items-center justify-center gap-1 text-[11px] font-medium text-foreground">
                <span className="truncate">{source?.name ?? "Unknown"}</span>
                {evaluation.barter && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">LL<strong className="text-foreground">{evaluation.barter.minTraderLevel}</strong></span>}
                {evaluation.craft && <strong className="shrink-0 font-mono text-[10px] text-foreground">{evaluation.craft.level}</strong>}
            </span>
        </span>
    );
}

function Cell({ label, value, children, detail, info, infoTitle }: {
    label: string;
    value?: number | null;
    children: React.ReactNode;
    detail?: string;
    info?: React.ReactNode;
    infoTitle?: string;
}) {
    const color = value == null ? "text-foreground" : value > 0 ? "text-tarkov-green" : value < 0 ? "text-red-300" : "text-foreground";
    return (
        <div className="flex flex-col items-start justify-center border-l border-white/5 px-3">
            <span className="flex items-center gap-1">
                <span className={`whitespace-nowrap font-mono text-sm font-semibold ${color}`} title={label}>{children}</span>
                {info && <InfoHint title={infoTitle ?? "Price comparison"} tone="warning">{info}</InfoHint>}
            </span>
            {detail && <span className="mt-0.5 whitespace-nowrap font-mono text-[9px] text-muted-foreground">{detail}</span>}
        </div>
    );
}

function InfoHint({ title, children, tone = "neutral", onShow }: {
    title: string;
    children: React.ReactNode;
    tone?: "neutral" | "warning";
    onShow?: () => void;
}) {
    const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    function show(event?: React.SyntheticEvent) {
        event?.stopPropagation();
        onShow?.();
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.min(288, window.innerWidth - 16);
        const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
        const placeAbove = rect.top > 170;
        setPosition({
            left,
            width,
            ...(placeAbove
                ? { bottom: window.innerHeight - rect.top + 8 }
                : { top: rect.bottom + 8 }),
        });
    }

    return <>
        <span
            ref={triggerRef}
            data-isolated-hover="true"
            tabIndex={0}
            aria-label={title}
            onMouseEnter={show}
            onMouseMove={(event) => event.stopPropagation()}
            onMouseLeave={() => setPosition(null)}
            onFocus={show}
            onBlur={() => setPosition(null)}
            className={`flex size-3.5 shrink-0 cursor-help items-center justify-center outline-none transition ${tone === "warning" ? "text-amber-300/90 hover:text-amber-200 focus:text-amber-200" : "text-muted-foreground hover:text-foreground focus:text-foreground"}`}
        >
            <Info className="size-3" />
        </span>
        {position && createPortal(
            <span
                role="tooltip"
                className="pointer-events-none fixed z-[120] block rounded-md border border-white/15 bg-[#05070a] p-3 text-left shadow-[0_18px_55px_rgba(0,0,0,0.8)]"
                style={position}
            >
                <span className={`block text-[10px] font-bold uppercase tracking-wide ${tone === "warning" ? "text-amber-300" : "text-tarkov-green"}`}>{title}</span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-foreground/80">{children}</span>
            </span>,
            document.body,
        )}
    </>;
}

function SellValueCell({ item, count, sellValue, overrides }: {
    item?: GlobalItem;
    count: number;
    sellValue: number | null;
    overrides: Record<string, ManualPriceOverride>;
}) {
    const comparison = getItemSellComparison(item, overrides);
    const trader = comparison.bestTraderOffer;
    return (
        <div className="flex min-w-0 flex-col items-start justify-center border-l border-white/5 px-3">
            <span className="whitespace-nowrap font-mono text-sm font-semibold text-foreground">{formatRoundedRoubles(sellValue)}</span>
            {comparison.selectedSource === "manual" ? (
                <span className="mt-0.5 text-[8px] uppercase tracking-wide text-amber-300">Manual price</span>
            ) : comparison.pricesAreClose && comparison.fleaPrice !== null && trader ? (
                <span className="mt-0.5 block max-w-full space-y-0.5 text-[8px] leading-tight text-muted-foreground">
                    <span className="block truncate">Flea {formatCompactPrice(comparison.fleaPrice * count)}</span>
                    <span className="block truncate">{trader.vendor.name} {formatTraderOffer(trader, count, true)}</span>
                </span>
            ) : (
                <span className="mt-0.5 max-w-full truncate text-[8px] text-muted-foreground">
                    {comparison.selectedSource === "trader" && trader
                        ? `${trader.vendor.name} · ${formatTraderOffer(trader, count, false)}`
                        : comparison.selectedSource === "flea" ? "Flea market" : "No sale price"}
                </span>
            )}
        </div>
    );
}

function ItemCard({
    item,
    count,
    method,
    totalPrice,
    priceKind,
    emphasized,
    plan,
    overrides,
    onPriceChange,
    routeContext,
    detail,
    showRouteIcon = true,
    fillColumn = false,
    compactLine = false,
    onItemOpen,
    onGoToRecipe,
    recipePreview,
}: {
    item?: GlobalItem;
    count: number;
    method: "flea" | "barter" | "craft" | "unavailable";
    totalPrice: number | null;
    priceKind: "buy" | "sell";
    emphasized?: boolean;
    plan?: AcquisitionPlan;
    overrides: Record<string, ManualPriceOverride>;
    onPriceChange: (itemId: string, override: ManualPriceOverride) => void;
    routeContext: RouteContext;
    detail?: string;
    showRouteIcon?: boolean;
    fillColumn?: boolean;
    compactLine?: boolean;
    onItemOpen: (itemId: string) => void;
    onGoToRecipe?: (method: "barter" | "craft", recipeId: string) => void;
    recipePreview?: RecipePreviewData;
}) {
    const [hoverPosition, setHoverPosition] = useState<{
        left: number;
        placeAbove: boolean;
        verticalOffset: number;
    } | null>(null);
    const routeDetail = detail ?? (plan ? describeRoute(plan, routeContext) : null);
    const unitRoutePrice = totalPrice === null || count <= 0 ? null : totalPrice / count;
    const directUnitPrice = item
        ? priceKind === "buy"
            ? getItemBuyPrice(item, overrides)
            : getItemSellPrice(item, overrides)
        : null;
    const hasOverride = Boolean(item && overrides[item.id]?.[priceKind] !== undefined);
    const sellComparison = priceKind === "sell" ? getItemSellComparison(item, overrides) : null;
    const routeLabel = plan?.isTool ? "Reusable tool" : method === "flea" ? "Flea market" : method === "barter" ? "Barter" : method === "craft" ? "Craft" : "Unavailable";
    const resolvedRecipePreview = recipePreview ?? getPlanRecipePreview(plan, routeContext);
    const canGoToRecipe = Boolean(
        compactLine &&
        onGoToRecipe &&
        plan?.sourceId &&
        (plan.method === "barter" || plan.method === "craft"),
    );
    const routeSavingsPerUnit = plan && method !== "flea" && directUnitPrice !== null && unitRoutePrice !== null
        ? directUnitPrice - unitRoutePrice
        : null;
    const routeSavingsTotal = routeSavingsPerUnit === null ? null : routeSavingsPerUnit * count;
    const ingredientSellValue = plan && !plan.isTool && item
        ? (() => {
            const unitSellValue = getItemSellPrice(item, overrides);
            return unitSellValue === null ? null : unitSellValue * count;
        })()
        : null;
    const ingredientSellPremium = ingredientSellValue !== null && plan?.totalCost !== null && plan?.totalCost !== undefined
        ? ingredientSellValue - plan.totalCost
        : null;

    function updateHoverPosition(event: React.MouseEvent<HTMLSpanElement>) {
        if ((event.target as HTMLElement).closest("[data-isolated-hover='true']")) {
            setHoverPosition(null);
            return;
        }
        const gap = 12;
        const hoverWidth = Math.min(resolvedRecipePreview ? 660 : 320, window.innerWidth - 16);
        const preferredLeft = event.clientX + gap + hoverWidth <= window.innerWidth - 8
            ? event.clientX + gap
            : event.clientX - hoverWidth - gap;
        const placeAbove = event.clientY > window.innerHeight / 2;

        setHoverPosition({
            left: Math.max(8, Math.min(preferredLeft, window.innerWidth - hoverWidth - 8)),
            placeAbove,
            verticalOffset: placeAbove
                ? window.innerHeight - event.clientY + gap
                : event.clientY + gap,
        });
    }

    return (
        <span
            className={`group/item relative flex shrink-0 items-center px-1 ${compactLine ? "h-9 w-full gap-1.5 hover:bg-white/[0.025]" : `h-full min-h-[72px] gap-1.5 ${fillColumn ? "w-full" : "w-40"} ${emphasized ? "bg-tarkov-green/[0.07]" : "bg-black/10"}`}`}
            onMouseEnter={updateHoverPosition}
            onMouseMove={updateHoverPosition}
            onMouseLeave={() => setHoverPosition(null)}
        >
            {compactLine ? <>
                {showRouteIcon && <RouteIcon method={method} inline />}
                <button
                    type="button"
                    aria-label={`Open ${item?.name ?? "item"} details`}
                    disabled={!item}
                    onClick={(event) => { event.stopPropagation(); setHoverPosition(null); if (item) onItemOpen(item.id); }}
                    className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center bg-white/[0.025] transition hover:bg-white/10 disabled:cursor-default"
                >
                    {item?.iconLink ? <Image src={item.iconLink} alt="" width={32} height={32} className="size-8 object-contain" unoptimized /> : <span className="size-8" />}
                </button>
                <span className="min-w-0 truncate text-[11px] font-medium text-foreground" title={item?.name}>{item?.name ?? "Unknown item"}</span>
                {plan?.isTool && <span className="shrink-0 rounded-[3px] bg-sky-400 px-1 py-0.5 text-[7px] font-black uppercase text-black">tool</span>}
                <span className="shrink-0 text-[10px] text-muted-foreground">—</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatQuantity(count)} ×</span>
                <span className="shrink-0 font-mono text-[10px]">
                    {plan?.isTool ? <span className="text-sky-200">cost excluded</span> : <InlineItemPrice item={item} kind={priceKind} totalPrice={totalPrice} displayPrice={unitRoutePrice} overrides={overrides} onPriceChange={onPriceChange} />}
                </span>
                {(routeSavingsTotal ?? 0) > 0 || (plan?.durationSeconds ?? 0) > 0 || canGoToRecipe ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {(routeSavingsTotal ?? 0) > 0 && directUnitPrice !== null && plan && plan.totalCost !== null && (
                            <span className="flex items-center gap-0.5 whitespace-nowrap text-[9px] text-amber-300">
                                {method === "craft" ? "Craft" : "Barter"} saves {formatCompactPrice(routeSavingsTotal)}
                                <InfoHint
                                    title={`${method === "craft" ? "Crafting" : "Bartering"} saves ${formatRoundedRoubles(routeSavingsTotal)}`}
                                    onShow={() => setHoverPosition(null)}
                                >
                                    <span className="block">{method === "craft" ? "Crafting" : "Bartering for"} {formatQuantity(count)} × {item?.name ?? "this item"} costs <strong className="text-white">{formatRoundedRoubles(plan.totalCost)}</strong>.</span>
                                    <span className="mt-1 block">Buying the same quantity on the flea market costs <strong className="text-white">{formatRoundedRoubles(directUnitPrice * count)}</strong>.</span>
                                </InfoHint>
                            </span>
                        )}
                        {(plan?.durationSeconds ?? 0) > 0 && (
                            <span className="font-mono text-[9px] text-orange-300">{formatDuration(plan?.durationSeconds ?? 0)}</span>
                        )}
                        {canGoToRecipe && plan?.sourceId && (plan.method === "barter" || plan.method === "craft") && (
                            <button
                                type="button"
                                title={`Go to ${plan.method} recipe`}
                                aria-label={`Go to ${plan.method} recipe for ${item?.name ?? "item"}`}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setHoverPosition(null);
                                    onGoToRecipe?.(plan.method as "barter" | "craft", plan.sourceId as string);
                                }}
                                className="flex size-6 shrink-0 items-center justify-center rounded border border-white/10 bg-black/70 text-muted-foreground opacity-0 transition hover:border-tarkov-green/50 hover:text-tarkov-green group-hover/item:opacity-100 focus:opacity-100"
                            >
                                <ExternalLink className="size-3.5" />
                            </button>
                        )}
                    </span>
                ) : null}
            </> : <>
                <button
                    type="button"
                    aria-label={`Open ${item?.name ?? "item"} details`}
                    disabled={!item}
                    onClick={(event) => { event.stopPropagation(); setHoverPosition(null); if (item) onItemOpen(item.id); }}
                    className="relative flex size-12 shrink-0 cursor-pointer items-center justify-center bg-white/[0.025] transition hover:bg-white/10 disabled:cursor-default"
                >
                    {showRouteIcon && <RouteIcon method={method} />}
                    {plan?.isTool && (
                        <span className="absolute -right-0.5 -top-0.5 z-10 rounded-[3px] bg-sky-400 px-1 py-0.5 text-[7px] font-black uppercase text-black shadow">tool</span>
                    )}
                    {item?.iconLink ? (
                        <Image src={item.iconLink} alt="" width={48} height={48} className="size-12 object-contain" unoptimized />
                    ) : <span className="size-12" />}
                </button>
                <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
                    <span className="w-full truncate text-[11px] font-medium leading-tight text-foreground" title={item?.name}>
                        {item?.shortName ?? item?.name ?? "Unknown item"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">Quantity ×{formatQuantity(count)}</span>
                    <span className="font-mono text-[10px]">
                        {plan?.isTool ? <span className="text-sky-200">Cost excluded</span> : <InlineItemPrice item={item} kind={priceKind} totalPrice={totalPrice} overrides={overrides} onPriceChange={onPriceChange} />}
                    </span>
                </span>
            </>}
            {hoverPosition && createPortal(<span
                className="pointer-events-none fixed z-[100] flex max-w-[calc(100vw-16px)] items-stretch gap-2 text-left"
                style={{
                    left: hoverPosition.left,
                    width: resolvedRecipePreview ? Math.min(660, window.innerWidth - 16) : 320,
                    ...(hoverPosition.placeAbove
                        ? { bottom: hoverPosition.verticalOffset }
                        : { top: hoverPosition.verticalOffset }),
                }}
            >
                <span className="block w-80 max-w-full shrink-0 rounded-md border border-white/15 bg-[#05070a] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.8)]">
                <span className="flex items-center gap-3">
                    <span className="relative flex size-16 shrink-0 items-center justify-center bg-white/[0.035]">
                        {showRouteIcon && <RouteIcon method={method} />}
                        {item?.iconLink && <Image src={item.iconLink} alt="" width={64} height={64} className="size-16 object-contain" unoptimized />}
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight text-white">{item?.name ?? "Unknown item"}</span>
                        <span className={`mt-1 inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${routeChipClasses(method)}`}>{routeLabel}</span>
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">×{formatQuantity(count)}</span>
                    </span>
                </span>
                {routeDetail && <span className="mt-3 block border-t border-white/10 pt-2 text-[11px] leading-relaxed text-foreground/80">{routeDetail}</span>}
                <span className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded bg-white/[0.035] p-2 font-mono text-[10px]">
                    {priceKind === "sell" && sellComparison ? <>
                        <span className="text-muted-foreground">Flea sale / unit</span><span className="text-foreground">{formatRoundedRoubles(sellComparison.fleaPrice)}</span>
                        <span className="text-muted-foreground">Best trader / unit</span>
                        <span className="text-right text-foreground">
                            {sellComparison.bestTraderOffer
                                ? <>{sellComparison.bestTraderOffer.vendor.name} · {formatTraderOffer(sellComparison.bestTraderOffer, 1, true)}</>
                                : "-"}
                        </span>
                        {sellComparison.manualPrice !== null && <><span className="text-muted-foreground">Manual sale / unit</span><span className="text-amber-300">{formatRoundedRoubles(sellComparison.manualPrice)}</span></>}
                    </> : <>
                        <span className="text-muted-foreground">Flea purchase / unit</span><span className={hasOverride ? "text-amber-300" : "text-foreground"}>{formatRoundedRoubles(directUnitPrice)}{hasOverride ? " · manual" : ""}</span>
                    </>}
                    {plan && <><span className="text-muted-foreground">{method === "flea" ? "Selected route / unit" : `${routeLabel} / unit`}</span><span className="text-sky-200">{formatRoundedRoubles(unitRoutePrice)}</span></>}
                    {routeSavingsPerUnit !== null && <><span className="text-muted-foreground">Savings / unit</span><span className={routeSavingsPerUnit > 0 ? "text-tarkov-green" : "text-red-300"}>{formatSignedRoubles(routeSavingsPerUnit)}</span></>}
                    {plan && ingredientSellValue !== null && <>
                        <span className="text-muted-foreground">Best sale value / total</span><span className="text-amber-200">{formatRoundedRoubles(ingredientSellValue)}</span>
                    </>}
                    {plan && ingredientSellPremium !== null && ingredientSellPremium > 0 && <>
                        <span className="text-muted-foreground">Sale value above route cost</span><span className="text-amber-300">+{formatRoundedRoubles(ingredientSellPremium)}</span>
                    </>}
                    <span className="text-muted-foreground">Quantity</span><span className="text-foreground">× {formatQuantity(count)}</span>
                    <span className="border-t border-white/10 pt-1 text-muted-foreground">Total</span><span className="border-t border-white/10 pt-1 font-semibold text-tarkov-green">{plan?.isTool ? "Excluded" : formatRoundedRoubles(totalPrice)}</span>
                </span>
                {plan && (plan.batches > 1 || plan.durationSeconds > 0) && <span className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                    <span>Batches <b className="font-mono text-foreground">{plan.batches}</b></span>
                    {plan.durationSeconds > 0 && <span>Route time <b className="font-mono text-orange-300">{formatDuration(plan.durationSeconds)}</b></span>}
                </span>}
                {plan?.isTool && <span className="mt-2 block text-[10px] text-sky-200">Reusable tool price is not included in the craft cost.</span>}
                {plan?.theoreticalMethod !== undefined && plan.theoreticalMethod !== method && (
                    <span className="mt-2 block text-[10px] text-violet-300">Cheapest theoretical route: {plan.theoreticalMethod} · {formatRoundedRoubles(plan.theoreticalCost)}</span>
                )}
                </span>
                {resolvedRecipePreview && (
                    <RecipePreviewCard
                        preview={resolvedRecipePreview}
                        itemById={routeContext.itemById}
                        routeContext={routeContext}
                    />
                )}
            </span>, document.body)}
        </span>
    );
}

function RouteIcon({ method, inline = false }: { method: "flea" | "barter" | "craft" | "unavailable"; inline?: boolean }) {
    const classes = `${inline ? "relative shrink-0" : "absolute -left-1 -top-1 z-10"} flex size-[18px] items-center justify-center rounded-[3px] text-black shadow-md`;
    if (method === "barter") return <span title="Barter recommended" className={`${classes} bg-sky-400`}><CircleArrowRight className="size-3.5 stroke-[3]" /></span>;
    if (method === "craft") return <span title="Craft recommended" className={`${classes} bg-orange-400`}><Wrench className="size-3.5 stroke-[3]" /></span>;
    if (method === "flea") return <span title="Flea market recommended" className={`${classes} bg-emerald-400`}><ChartNoAxesCombined className="size-3.5 stroke-[3]" /></span>;
    return <span title="No priced route" className={`${classes} bg-gray-400 text-[11px] font-black`}>?</span>;
}

function routeChipClasses(method: "flea" | "barter" | "craft" | "unavailable") {
    if (method === "barter") return "bg-sky-400 text-black";
    if (method === "craft") return "bg-orange-400 text-black";
    if (method === "flea") return "bg-emerald-400 text-black";
    return "bg-gray-500 text-black";
}

function InlineItemPrice({ item, kind, totalPrice, displayPrice, overrides, onPriceChange }: {
    item?: GlobalItem;
    kind: "buy" | "sell";
    totalPrice: number | null;
    displayPrice?: number | null;
    overrides: Record<string, ManualPriceOverride>;
    onPriceChange: (itemId: string, override: ManualPriceOverride) => void;
}) {
    const [editing, setEditing] = useState(false);
    if (!item) return <span>-</span>;
    const itemId = item.id;
    const currentUnitPrice = kind === "buy"
        ? getItemBuyPrice(item, overrides)
        : getItemSellPrice(item, overrides);
    const currentOverride = overrides[itemId] ?? {};

    function commit(raw: string) {
        const parsed = raw.trim() === "" ? undefined : Number(raw);
        onPriceChange(itemId, {
            ...currentOverride,
            [kind]: parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
        });
        setEditing(false);
    }

    if (editing) {
        return (
            <input
                autoFocus
                type="number"
                min="0"
                placeholder={currentUnitPrice === null ? "No price" : String(Math.round(currentUnitPrice))}
                defaultValue={currentOverride[kind]}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") commit(event.currentTarget.value);
                    if (event.key === "Escape") setEditing(false);
                }}
                onBlur={(event) => commit(event.currentTarget.value)}
                className="h-5 w-16 rounded border border-tarkov-green/50 bg-black px-1 text-[10px] text-foreground outline-none"
            />
        );
    }
    return (
        <button
            type="button"
            title={`Edit ${kind} price`}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); setEditing(true); }}
            className="truncate text-tarkov-green hover:underline"
        >
            {formatCompactPrice(displayPrice === undefined ? totalPrice : displayPrice)}
        </button>
    );
}

function getRecipeSourceId(evaluation: RecipeEvaluation) {
    return evaluation.barter?.traderId ?? evaluation.craft?.stationId ?? "";
}

function profitGrid() {
    return "grid-cols-[40px_125px_170px_minmax(300px,1fr)_110px_150px_120px_120px]";
}

function estimateProfitRowHeight(evaluation?: RecipeEvaluation) {
    if (!evaluation) return 72;
    return Math.max(72, evaluation.requiredItems.length * 36 + 4) + 1;
}

function describeRoute(plan: AcquisitionPlan, context: RouteContext) {
    if (plan.isTool) {
        return `Reusable tool acquired via ${plan.method}; its value is not included in recurring craft cost.`;
    }
    if (plan.method === "flea") return "Buy from the flea market using the 24-hour average price.";
    if (plan.method === "barter" && plan.sourceId) {
        const barter = context.bartersById[plan.sourceId];
        const trader = barter ? context.tradersById[barter.traderId] : undefined;
        if (barter) {
            return `Barter with ${trader?.name ?? "unknown trader"} at LL${barter.minTraderLevel} · ${plan.batches} batch${plan.batches === 1 ? "" : "es"}${barter.buyLimit ? ` · limit ${barter.buyLimit}` : ""}.`;
        }
    }
    if (plan.method === "craft" && plan.sourceId) {
        const craft = context.craftsById[plan.sourceId];
        const station = craft ? context.stationsById[craft.stationId] : undefined;
        if (craft) {
            const allocatedCraftTime = craft.duration * (plan.quantity / craft.productCount);
            return `Craft at ${station?.name ?? "unknown station"} level ${craft.level} · ${plan.batches} batch${plan.batches === 1 ? "" : "es"} · ${formatDuration(allocatedCraftTime)} allocated craft time.`;
        }
    }
    return "No complete priced acquisition route is currently available.";
}

function isRecipeAvailable(
    evaluation: RecipeEvaluation,
    stationLevels: Record<string, number>,
    traderLevels: Record<string, number>,
    completedQuests: Record<string, boolean>,
) {
    if (evaluation.barter) {
        return (
            (traderLevels[evaluation.barter.traderId] ?? 1) >= evaluation.barter.minTraderLevel &&
            (!evaluation.barter.taskUnlockId || completedQuests[evaluation.barter.taskUnlockId] === true)
        );
    }
    if (evaluation.craft) {
        return (
            (stationLevels[evaluation.craft.stationId] ?? 0) >= evaluation.craft.level &&
            (!evaluation.craft.taskUnlockId || completedQuests[evaluation.craft.taskUnlockId] === true)
        );
    }
    return false;
}

function compareEvaluations(
    left: RecipeEvaluation,
    right: RecipeEvaluation,
    sortMode: SortMode,
    itemsById: Readonly<Record<string, GlobalItem>>,
) {
    if (sortMode === "name") {
        return (itemsById[left.outputItemId]?.name ?? left.outputItemId).localeCompare(
            itemsById[right.outputItemId]?.name ?? right.outputItemId,
        );
    }
    const leftValue = sortMode === "cost" ? left.cost : sortMode === "profitPerHour" ? left.profitPerHour : left.profit;
    const rightValue = sortMode === "cost" ? right.cost : sortMode === "profitPerHour" ? right.profitPerHour : right.profit;
    if (sortMode === "cost") return (leftValue ?? Number.POSITIVE_INFINITY) - (rightValue ?? Number.POSITIVE_INFINITY);
    return (rightValue ?? Number.NEGATIVE_INFINITY) - (leftValue ?? Number.NEGATIVE_INFINITY);
}

function formatSignedRoubles(value: number | null) {
    if (value === null) return "-";
    return `${value > 0 ? "+" : ""}${formatRoubles(Math.round(value))}`;
}

function formatRoundedRoubles(value: number | null) {
    return formatRoubles(value === null ? null : Math.round(value));
}

function formatCompactPrice(value: number | null) {
    return value === null ? "-" : `${formatCompactRoubles(Math.round(value))} ₽`;
}

function formatTraderOffer(
    offer: GlobalItemVendorPrice,
    count: number,
    includeRoubleComparison: boolean,
) {
    const amount = (offer.price ?? offer.priceRUB) * count;
    const formattedAmount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
    const original = offer.currency === "USD"
        ? `$${formattedAmount}`
        : offer.currency === "EUR"
            ? `€${formattedAmount}`
            : offer.currency === "RUB" || !offer.currency
                ? `${formattedAmount} ₽`
                : `${formattedAmount} ${offer.currency}`;
    if (!includeRoubleComparison || offer.currency === "RUB" || !offer.currency) return original;
    return `${original} (${formatCompactPrice(offer.priceRUB * count)})`;
}

function formatQuantity(value: number) {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3_600);
    const minutes = Math.round((seconds % 3_600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
