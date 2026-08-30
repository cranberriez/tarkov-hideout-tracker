"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ItemDetails, Station } from "@/types";
import { X } from "lucide-react";
import { stationOrder } from "@/lib/cfg/stationOrder";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { computeNeeds } from "@/lib/utils/item-needs";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { hasItemMarketData } from "./ItemDetailMarket";
import { ItemDetailSidebar } from "./ItemDetailSidebar";
import { ItemDetailUsageTabs } from "./ItemDetailUsageTabs";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import { deriveQuestAnyOfGroups, deriveQuestItemState } from "@/lib/utils/quest-item-index";
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
    questAnyOfGroups?: QuestAnyOfGroupEntry[];
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
    questAnyOfGroups = [],
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

    const {
        completedQuests,
        failedQuests,
        ignoredQuests,
        pinnedQuests,
        playerLevel,
        prestigeLevel,
        questTraderLoyaltyLevels,
        questFaction,
        itemQuestVisibilityMode,
        itemQuestCustomLookahead,
        itemQuestCustomLevelLookahead,
        itemShowFutureFir,
        itemShowIgnored,
        questShowKappa,
        questShowLightkeeper,
        itemCounts,
        addItemCounts,
    } = useUserStore();
    const marketPrice = selectedItem?.marketPrice;

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

    const relativeUpdatedAt = formatRelativeUpdatedAt(marketPrice?.updatedAt ?? null);
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
            failedQuests,
            ignoredQuests,
            pinnedQuests,
            playerLevel,
            prestigeLevel,
            faction: questFaction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            quests: questAvailabilityQuests,
            visibilityMode: itemQuestVisibilityMode,
            customLookahead: itemQuestCustomLookahead,
            customLevelLookahead: itemQuestCustomLevelLookahead,
            showFutureFir: itemShowFutureFir,
            showIgnored: itemShowIgnored,
            includeCompleted: true,
            showKappa: questShowKappa,
            showLightkeeper: questShowLightkeeper,
        });
    }, [
        selectedItem,
        questItemIndex,
        completedQuests,
        failedQuests,
        ignoredQuests,
        pinnedQuests,
        playerLevel,
        prestigeLevel,
        questFaction,
        questTraderLoyaltyLevels,
        questAvailabilityQuests,
        itemQuestVisibilityMode,
        itemQuestCustomLookahead,
        itemQuestCustomLevelLookahead,
        itemShowFutureFir,
        itemShowIgnored,
        questShowKappa,
        questShowLightkeeper,
    ]);

    const questAnyOfGroupState = useMemo(() => {
        if (!selectedItem) return [];

        return deriveQuestAnyOfGroups(questAnyOfGroups, {
            completedQuests,
            failedQuests,
            ignoredQuests,
            pinnedQuests,
            playerLevel,
            prestigeLevel,
            faction: questFaction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            quests: questAvailabilityQuests,
            visibilityMode: itemQuestVisibilityMode,
            customLookahead: itemQuestCustomLookahead,
            customLevelLookahead: itemQuestCustomLevelLookahead,
            showFutureFir: itemShowFutureFir,
            showIgnored: itemShowIgnored,
            includeCompleted: true,
            showKappa: questShowKappa,
            showLightkeeper: questShowLightkeeper,
        }).filter((group) => group.items.some((groupItem) => groupItem.id === selectedItem.id));
    }, [
        selectedItem,
        questAnyOfGroups,
        completedQuests,
        failedQuests,
        ignoredQuests,
        pinnedQuests,
        playerLevel,
        prestigeLevel,
        questFaction,
        questTraderLoyaltyLevels,
        questAvailabilityQuests,
        itemQuestVisibilityMode,
        itemQuestCustomLookahead,
        itemQuestCustomLevelLookahead,
        itemShowFutureFir,
        itemShowIgnored,
        questShowKappa,
        questShowLightkeeper,
    ]);

    const hasQuestRequirements =
        (questItemState?.relatedQuests.length ?? 0) > 0 || questAnyOfGroupState.length > 0;
    const hideoutUseCount = stationRequirements.reduce((count, [, reqs]) => count + reqs.length, 0);
    const questUseCount =
        (questItemState?.relatedQuestCount ?? 0) + questAnyOfGroupState.length;

    if (!selectedItem) {
        return null;
    }

    const showInventory = !isRouble;
    const showMarket = !isRouble && hasItemMarketData(marketPrice);
    const showSidebar = showInventory || showMarket;
    const showUsage = stationRequirements.length > 0 || hasQuestRequirements;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden border-border-color bg-background p-0 sm:max-w-4xl lg:max-w-5xl"
            >
                <DialogTitle className="sr-only">{selectedItem.name}</DialogTitle>
                <header className="relative border-b border-border-color bg-gradient-to-br from-card via-card to-background py-3 pl-3 pr-12 sm:py-4 sm:pl-4 sm:pr-14">
                    <ItemDetailHeader
                        item={selectedItem}
                        totalCount={totalCount}
                        owned={owned}
                        needsBreakdown={needsBreakdown}
                        hideoutUseCount={hideoutUseCount}
                        questUseCount={questUseCount}
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border-color hover:bg-black/20 hover:text-foreground sm:right-4 sm:top-4"
                        aria-label="Close item details"
                    >
                        <X size={18} />
                    </button>
                </header>

                {(showSidebar || showUsage) && (
                    <div className="flex-1 overflow-y-auto">
                        <div
                            className={`grid grid-cols-1 gap-0 ${
                                showSidebar && showUsage
                                    ? "lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]"
                                    : ""
                            }`}
                        >
                            {showSidebar && (
                                <ItemDetailSidebar
                                    key={selectedItemId}
                                    itemId={selectedItemId}
                                    owned={owned}
                                    marketPrice={marketPrice}
                                    relativeUpdatedAt={relativeUpdatedAt}
                                    isFiat={isFiat}
                                    showMarket={showMarket}
                                    onAddItemCounts={addItemCounts}
                                />
                            )}

                            {showUsage && (
                                <ItemDetailUsageTabs
                                    key={`usage-${selectedItemId}`}
                                    className=""
                                    selectedItemId={selectedItem.id}
                                    selectedItemImageLink={
                                        selectedItem.iconLink ?? selectedItem.gridImageLink
                                    }
                                    stationRequirements={stationRequirements}
                                    stationLevels={stationLevels}
                                    hiddenStations={hiddenStations}
                                    questItemState={questItemState}
                                    anyOfGroups={questAnyOfGroupState}
                                />
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
