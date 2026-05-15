"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ItemDetails, Station } from "@/types";
import { X, Pin, CircleSlash, CheckCircle, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { stationOrder } from "@/lib/cfg/stationOrder";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { computeNeeds } from "@/lib/utils/item-needs";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { ItemDetailInventoryAndMarket } from "./ItemDetailInventoryAndMarket";
import { ItemDetailHideoutRequirements } from "./ItemDetailHideoutRequirements";
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";
import type { QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import { deriveQuestItemState } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

export interface ItemDetailModalProps {
    item: ItemDetails | null;
    isOpen: boolean;
    onClose: () => void;
    stations: Station[] | null;
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    completedRequirements: Record<string, boolean>;
    questItemIndex?: QuestItemIndexEntry[];
    questAvailabilityQuests?: QuestAvailabilityQuest[];
}

export function ItemDetailModal({
    item,
    isOpen,
    onClose,
    stations,
    stationLevels,
    hiddenStations,
    completedRequirements,
    questItemIndex = [],
    questAvailabilityQuests = [],
}: ItemDetailModalProps) {
    const selectedItem = item;
    const selectedItemId = selectedItem?.id ?? "";
    const selectedNormalizedName = selectedItem?.normalizedName ?? "";

    const stationRequirements = useMemo(() => {
        if (!selectedItem || !stations) return [];

        const reqs: {
            stationName: string;
            stationNormalizedName: string;
            stationId: string;
            level: number;
            count: number;
            isFir: boolean;
            isCompleted: boolean;
            isStationMaxed: boolean;
            requirementId: string;
        }[] = [];

        stations.forEach((station) => {
            const currentLevel = stationLevels[station.id] ?? 0;
            const maxLevel =
                station.levels.length > 0 ? station.levels[station.levels.length - 1].level : 0;
            const isStationMaxed = currentLevel >= maxLevel;

            station.levels.forEach((level) => {
                level.itemRequirements.forEach((req) => {
                    if (req.item.id === selectedItem.id) {
                        const isFir = req.attributes.some(
                            (attr) => attr.name === "found_in_raid" && attr.value === "true",
                        );
                        reqs.push({
                            stationName: station.name,
                            stationNormalizedName: station.normalizedName,
                            stationId: station.id,
                            level: level.level,
                            count: req.count ?? req.quantity ?? 0,
                            isFir,
                            isCompleted: currentLevel >= level.level,
                            isStationMaxed,
                            requirementId: req.id,
                        });
                    }
                });
            });
        });

        const grouped: Record<string, typeof reqs> = {};
        reqs.forEach((req) => {
            if (!grouped[req.stationName]) {
                grouped[req.stationName] = [];
            }
            grouped[req.stationName].push(req);
        });

        const orderMap = new Map(stationOrder.map((name, index) => [name, index] as const));
        const getOrder = (normalizedName: string) => orderMap.get(normalizedName) ?? 999;

        return Object.entries(grouped).sort((a, b) => {
            const reqA = a[1][0];
            const reqB = b[1][0];

            if (reqA.isStationMaxed && !reqB.isStationMaxed) return 1;
            if (!reqA.isStationMaxed && reqB.isStationMaxed) return -1;

            return getOrder(reqA.stationNormalizedName) - getOrder(reqB.stationNormalizedName);
        });
    }, [selectedItem, stations, stationLevels]);

    const { marketPricesByMode, loading: pricesLoading } = usePriceDataContext();
    const {
        completedQuests,
        ignoredQuests,
        pinnedQuests,
        gameMode,
        playerLevel,
        prestigeLevel,
        questTraderLoyaltyLevels,
        questFaction,
        itemQuestMaxDepth,
        itemCounts,
        addItemCounts,
        toggleQuestCompletion,
        toggleIgnoredQuest,
        togglePinnedQuest,
    } = useUserStore();
    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];
    const loading = pricesLoading || !priceBucket || priceBucket.updatedAt === null;
    const marketPrice = selectedItem ? priceBucket?.prices[selectedNormalizedName] : undefined;

    const formatPrice = (price?: number) => {
        if (price === undefined) return "-";
        return `${new Intl.NumberFormat("en-US").format(price)} ₽`;
    };

    const renderMarketValue = (value?: number) => {
        if (loading && !marketPrice) return "...";
        if (!loading && (!marketPrice || value === undefined)) return "-";
        return formatPrice(value);
    };

    const renderPercentChange = (value?: number) => {
        if (loading && !marketPrice) return "...";
        if (!loading && (!marketPrice || value === undefined)) return "-";
        if (value === undefined) return "-";
        return `${value.toFixed(2)}%`;
    };

    const { totalCount, totalFir } = useMemo(() => {
        let nextTotalCount = 0;
        let nextTotalFir = 0;

        stationRequirements.forEach(([, reqs]) => {
            reqs.forEach((req) => {
                const isManuallyCompleted = completedRequirements[req.requirementId];
                if (req.isCompleted || isManuallyCompleted) {
                    return;
                }

                nextTotalCount += req.count;
                if (req.isFir) {
                    nextTotalFir += req.count;
                }
            });
        });

        return { totalCount: nextTotalCount, totalFir: nextTotalFir };
    }, [stationRequirements, completedRequirements]);

    const isRouble = selectedNormalizedName === "roubles";
    const isDollar = selectedNormalizedName === "dollars";
    const isEuro = selectedNormalizedName === "euros";
    const isFiat = isDollar || isEuro;

    const itemUpdatedTimestamp = (() => {
        if (!marketPrice?.updated) return null;
        const parsed = Date.parse(marketPrice.updated);
        if (Number.isNaN(parsed)) return null;
        return parsed;
    })();

    const relativeUpdatedAt = formatRelativeUpdatedAt(itemUpdatedTimestamp);
    const owned = itemCounts[selectedItemId] ?? { have: 0, haveFir: 0 };

    const needsBreakdown = useMemo(() => {
        if (totalCount === 0) {
            return null;
        }

        return computeNeeds({
            totalRequired: totalCount,
            requiredFir: totalFir,
            haveNonFir: owned.have,
            haveFir: owned.haveFir,
        });
    }, [totalCount, totalFir, owned.have, owned.haveFir]);

    const questItemState = useMemo(() => {
        if (!selectedItem) return null;

        const entry = questItemIndex.find((questEntry) => questEntry.itemId === selectedItem.id);
        if (!entry) return null;

        return deriveQuestItemState(entry, {
            completedQuests,
            ignoredQuests,
            pinnedQuests,
            playerLevel,
            prestigeLevel,
            faction: questFaction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            quests: questAvailabilityQuests,
            maxDepth: itemQuestMaxDepth,
        });
    }, [
        selectedItem,
        questItemIndex,
        completedQuests,
        ignoredQuests,
        pinnedQuests,
        playerLevel,
        prestigeLevel,
        questFaction,
        questTraderLoyaltyLevels,
        questAvailabilityQuests,
        itemQuestMaxDepth,
    ]);

    const [draftNonFir, setDraftNonFir] = useState(owned.have);
    const [draftFir, setDraftFir] = useState(owned.haveFir);

    const hasInventoryChanges = draftNonFir !== owned.have || draftFir !== owned.haveFir;

    const handleCancelInventoryChanges = () => {
        setDraftNonFir(owned.have);
        setDraftFir(owned.haveFir);
    };

    const handleConfirmInventoryChanges = () => {
        if (!selectedItem || !hasInventoryChanges) return;

        const haveDelta = draftNonFir - owned.have;
        const haveFirDelta = draftFir - owned.haveFir;

        if (haveDelta !== 0 || haveFirDelta !== 0) {
            addItemCounts(selectedItem.id, haveDelta, haveFirDelta);
        }
    };

    if (!selectedItem) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-5xl"
            >
                <DialogTitle className="sr-only">{selectedItem.name}</DialogTitle>
                <div className="flex items-start justify-between border-b border-border-color bg-card p-3 sm:p-5">
                    <ItemDetailHeader
                        item={selectedItem}
                        marketPrice={marketPrice}
                        totalCount={totalCount}
                        owned={owned}
                        needsBreakdown={needsBreakdown}
                    />
                    <button
                        onClick={onClose}
                        className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-background p-3 sm:p-5">
                    <div
                        className={`grid grid-cols-1 gap-5 ${
                            !isRouble && stationRequirements.length > 0
                                ? "lg:grid-cols-3"
                                : isRouble && stationRequirements.length > 0
                                  ? "lg:grid-cols-2"
                                  : ""
                        }`}
                    >
                        {!isRouble && (
                            <ItemDetailInventoryAndMarket
                                isFiat={isFiat}
                                marketPrice={marketPrice}
                                loading={loading}
                                relativeUpdatedAt={relativeUpdatedAt}
                                draftNonFir={draftNonFir}
                                draftFir={draftFir}
                                setDraftNonFir={setDraftNonFir}
                                setDraftFir={setDraftFir}
                                hasInventoryChanges={hasInventoryChanges}
                                onCancelChanges={handleCancelInventoryChanges}
                                onConfirmChanges={handleConfirmInventoryChanges}
                                renderMarketValue={renderMarketValue}
                                renderPercentChange={renderPercentChange}
                            />
                        )}

                        {stationRequirements.length > 0 && (
                            <ItemDetailHideoutRequirements
                                stationRequirements={stationRequirements}
                                stationLevels={stationLevels}
                                hiddenStations={hiddenStations}
                            />
                        )}
                    </div>

                    {questItemState && questItemState.relatedQuests.length > 0 && (
                        <section className="mt-5 rounded-md border border-white/10 bg-card p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-white">Quest Hand-Ins</h3>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Ordered by the same active progression logic used on the items
                                        page.
                                    </p>
                                </div>
                                <div className="text-right text-xs text-gray-500">
                                    <div>{questItemState.relatedQuestCount} active quests</div>
                                    <div>{questItemState.pinnedQuestCount} pinned</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {questItemState.relatedQuests.map((quest) => {
                                    const isCompleted = !!completedQuests[quest.questId];
                                    const isIgnored = !!ignoredQuests[quest.questId];
                                    const isPinned = !!pinnedQuests[quest.questId];
                                    return (
                                        <div
                                            key={quest.questId}
                                            className="rounded-md border border-white/8 bg-black/20 px-3 py-2 space-y-1.5"
                                        >
                                            {/* Row 1: completion + name + status */}
                                            <div className="flex items-center gap-2 min-w-0">
                                                <button
                                                    onClick={() => toggleQuestCompletion(quest.questId)}
                                                    className="shrink-0 text-gray-600 hover:text-tarkov-green transition-colors"
                                                    title={isCompleted ? "Mark incomplete" : "Mark complete"}
                                                >
                                                    {isCompleted
                                                        ? <CheckCircle size={14} className="text-tarkov-green" />
                                                        : <Circle size={14} />}
                                                </button>
                                                <span className={`flex-1 min-w-0 truncate text-sm font-medium ${isCompleted ? "line-through text-gray-600" : "text-white"}`}>
                                                    {quest.questName}
                                                </span>
                                                <span
                                                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                                                        quest.status === "available"
                                                            ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
                                                            : quest.status === "future"
                                                            ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                                                            : quest.status === "completed"
                                                            ? "border-tarkov-green/20 bg-tarkov-green/10 text-tarkov-green"
                                                            : "border-white/10 bg-black/30 text-gray-400"
                                                    }`}
                                                >
                                                    {quest.status}
                                                </span>
                                            </div>

                                            {/* Row 2: meta + badges + actions */}
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                                <span className="truncate text-xs text-gray-500">
                                                    {quest.traderName} · depth {quest.prerequisiteDepth}
                                                    {quest.minPlayerLevel != null
                                                        ? ` · Lv. ${quest.minPlayerLevel}`
                                                        : ""}
                                                </span>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-gray-400">
                                                        x{quest.requiredCount}
                                                    </span>
                                                    {quest.requiredFirCount > 0 && (
                                                        <span className="rounded border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-300">
                                                            FiR x{quest.requiredFirCount}
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => togglePinnedQuest(quest.questId)}
                                                        className={`rounded p-1 transition-colors ${isPinned ? "text-sky-300" : "text-gray-600 hover:text-sky-300"}`}
                                                        title={isPinned ? "Unpin quest" : "Pin quest"}
                                                    >
                                                        <Pin size={12} className={isPinned ? "fill-current" : ""} />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleIgnoredQuest(quest.questId)}
                                                        className={`rounded p-1 transition-colors ${isIgnored ? "text-red-300" : "text-gray-600 hover:text-red-300"}`}
                                                        title={isIgnored ? "Stop ignoring" : "Ignore quest"}
                                                    >
                                                        <CircleSlash size={12} />
                                                    </button>
                                                    <Link
                                                        href={`/quests#quest-${quest.questId}`}
                                                        className="rounded p-1 text-gray-600 hover:text-gray-300 transition-colors"
                                                        title="View on quests page"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
