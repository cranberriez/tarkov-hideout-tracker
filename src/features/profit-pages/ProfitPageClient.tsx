"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useShallow } from "zustand/react/shallow";
import {
    ChartNoAxesCombined,
    CircleArrowRight,
    LockKeyhole,
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
    getItemSellPrice,
    type AcquisitionPlan,
    type ManualPriceOverride,
    type RecipeEvaluation,
} from "@/lib/price-calculation";
import { formatCompactRoubles, formatRoubles } from "@/lib/utils/market-price";
import type { BarterRecord, CraftRecord, GlobalItem, Station, Trader } from "@/types";
import type { ProfitPageData } from "@/server/services/profitPages";
import { useManualPriceOverrides } from "./useManualPriceOverrides";

type ProfitPageKind = "barter" | "craft";
type SortMode = "profit" | "profitPerHour" | "cost" | "name";

interface ProfitPageClientProps {
    kind: ProfitPageKind;
    data: ProfitPageData;
}

function indexByOutput<T>(records: T[], getItemId: (record: T) => string) {
    const index: Record<string, T[]> = Object.create(null) as Record<string, T[]>;
    for (const record of records) (index[getItemId(record)] ??= []).push(record);
    return index;
}

export function ProfitPageClient({ kind, data }: ProfitPageClientProps) {
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
    const [search, setSearch] = useState("");
    const [sourceId, setSourceId] = useState("all");
    const [availableOnly, setAvailableOnly] = useState(true);
    const [profitableOnly, setProfitableOnly] = useState(false);
    const [allowCrafts, setAllowCrafts] = useState(true);
    const [allowBarters, setAllowBarters] = useState(true);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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
        profitableOnly,
        search,
        sortMode,
        sourceId,
        stationLevels,
        traderLoyaltyLevels,
    ]);

    const relevantError = kind === "barter" ? data.bartersError : data.craftsError;
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
                <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_180px_auto]">
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
                        className="h-9 rounded border border-white/10 bg-black/30 px-3 text-sm"
                    >
                        <option value="all">All {kind === "barter" ? "traders" : "stations"}</option>
                        {sources.map((source) => (
                            <option key={source.id} value={source.id}>{source.name}</option>
                        ))}
                    </select>
                    <select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as SortMode)}
                        className="h-9 rounded border border-white/10 bg-black/30 px-3 text-sm"
                    >
                        <option value="profit">Profit</option>
                        <option value="profitPerHour">Profit / hour</option>
                        <option value="cost">Lowest cost</option>
                        <option value="name">Item name</option>
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
                </div>
            </section>

            <div className="overflow-x-auto rounded-md border border-white/10 bg-card/50">
                <div className={`grid w-full min-w-[900px] border-b border-white/10 bg-black/30 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${profitGrid(kind)}`}>
                    <span>Source</span><span>Produced item</span><span>Required items</span><span className="px-3">Cost</span><span className="px-3">Sell value</span><span className="px-3">Profit</span><span className="px-3">Profit / hour</span>
                    {kind === "craft" && <span className="px-3">Full time</span>}
                </div>
                <div className="w-full min-w-[900px] divide-y divide-white/10">
                    {visibleEvaluations.map((evaluation) => (
                        <ProfitRow
                            key={evaluation.id}
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
                        />
                    ))}
                    {visibleEvaluations.length === 0 && (
                        <div className="px-4 py-14 text-center text-sm text-muted-foreground">
                            No recipes match these filters.
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
}) {
    const output = itemById[evaluation.outputItemId];
    const routeContext = { bartersById, craftsById, tradersById, stationsById };
    return (
        <div className={`grid min-h-[72px] items-stretch ${profitGrid(evaluation.kind)}`}>
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
                        />
                    ))}
                </div>
                <Cell label="Cost">{formatRoundedRoubles(evaluation.cost)}</Cell>
                <Cell label="Sell value">{formatRoundedRoubles(evaluation.sellValue)}</Cell>
                <Cell label="Profit" value={evaluation.profit}>
                    {formatSignedRoubles(evaluation.profit)}
                </Cell>
                <Cell label="Profit / hour" value={evaluation.profitPerHour}>
                    {formatSignedRoubles(evaluation.profitPerHour)}
                </Cell>
                {evaluation.kind === "craft" && (
                    <Cell label="Full time">{formatDuration(evaluation.durationSeconds)}</Cell>
                )}
        </div>
    );
}

interface RouteContext {
    bartersById: Readonly<Record<string, BarterRecord>>;
    craftsById: Readonly<Record<string, CraftRecord>>;
    tradersById: Readonly<Record<string, Trader>>;
    stationsById: Readonly<Record<string, Station>>;
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

function Cell({ label, value, children }: { label: string; value?: number | null; children: React.ReactNode }) {
    const color = value == null ? "text-foreground" : value > 0 ? "text-tarkov-green" : value < 0 ? "text-red-300" : "text-foreground";
    return (
        <div className="flex items-center border-l border-white/5 px-3">
            <span className={`whitespace-nowrap font-mono text-sm font-semibold ${color}`} title={label}>{children}</span>
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
}) {
    const [hoverPosition, setHoverPosition] = useState<{ left: number; top: number } | null>(null);
    const routeDetail = detail ?? (plan ? describeRoute(plan, routeContext) : null);
    const unitRoutePrice = totalPrice === null || count <= 0 ? null : totalPrice / count;
    const directUnitPrice = item
        ? priceKind === "buy"
            ? getItemBuyPrice(item, overrides)
            : getItemSellPrice(item, overrides)
        : null;
    const hasOverride = Boolean(item && overrides[item.id]?.[priceKind] !== undefined);
    const routeLabel = plan?.isTool ? "Reusable tool" : method === "flea" ? "Flea market" : method === "barter" ? "Barter" : method === "craft" ? "Craft" : "Unavailable";
    return (
        <span
            className={`relative flex shrink-0 items-center px-1 ${compactLine ? "h-9 w-full gap-1.5 hover:bg-white/[0.025]" : `h-full min-h-[72px] gap-1.5 ${fillColumn ? "w-full" : "w-40"} ${emphasized ? "bg-tarkov-green/[0.07]" : "bg-black/10"}`}`}
            onMouseEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const left = Math.max(8, Math.min(rect.left, window.innerWidth - 336));
                const hoverHeight = 240;
                const pointerGap = 12;
                const top = event.clientY + pointerGap + hoverHeight <= window.innerHeight
                    ? event.clientY + pointerGap
                    : Math.max(8, event.clientY - hoverHeight - pointerGap);
                setHoverPosition({ left, top });
            }}
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
            {hoverPosition && <span
                className="pointer-events-none fixed z-[100] w-80 rounded-md border border-white/15 bg-[#05070a] p-3 text-left shadow-[0_18px_55px_rgba(0,0,0,0.8)]"
                style={{ left: hoverPosition.left, top: hoverPosition.top }}
            >
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
                    <span className="text-muted-foreground">Current {priceKind} price</span><span className={hasOverride ? "text-amber-300" : "text-foreground"}>{formatRoundedRoubles(directUnitPrice)}{hasOverride ? " · manual" : ""}</span>
                    <span className="text-muted-foreground">Selected route / unit</span><span className="text-sky-200">{formatRoundedRoubles(unitRoutePrice)}</span>
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
            </span>}
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

function profitGrid(kind: ProfitPageKind) {
    return kind === "craft"
        ? "grid-cols-[125px_170px_minmax(300px,1fr)_110px_110px_110px_120px_90px]"
        : "grid-cols-[125px_170px_minmax(300px,1fr)_110px_110px_110px_120px]";
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

function formatQuantity(value: number) {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3_600);
    const minutes = Math.round((seconds % 3_600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
