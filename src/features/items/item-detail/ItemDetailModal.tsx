"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type {
    ItemCraftRecipe,
    ItemDetails,
    ItemTraderOffer,
    ItemUsagePayload,
    Station,
} from "@/types";
import { X } from "lucide-react";
import { stationOrder } from "@/lib/cfg/stationOrder";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { computeNeeds } from "@/lib/utils/item-needs";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { hasItemMarketData } from "./ItemDetailMarket";
import { ItemDetailSidebar } from "./ItemDetailSidebar";
import { ItemDetailUsageTabs } from "./ItemDetailUsageTabs";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry, QuestRewardIndexEntry } from "@/lib/utils/quest-item-index";
import { deriveQuestAnyOfGroups, deriveQuestItemState } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { useDataContext } from "@/app/(data)/_dataContext";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { isCompleteItemUsagePayload } from "@/lib/utils/item-usage";

const itemUsageCache = new Map<string, ItemUsagePayload>();

export interface ItemDetailModalProps {
    item: ItemDetails | null;
    isOpen: boolean;
    onClose: () => void;
    stations: Station[] | null;
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    completedRequirements: Record<string, boolean>;
    questItemIndex?: QuestItemIndexEntry[];
    questRewardIndex?: QuestRewardIndexEntry[];
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
    questRewardIndex = [],
    questAnyOfGroups = [],
    questAvailabilityQuests = [],
}: ItemDetailModalProps) {
    const { items: catalogItems, itemById } = useDataContext();
    const selectedItem = useMemo(() => {
        if (!item) return null;
        return itemById[item.id] ?? item;
    }, [itemById, item]);
    const selectedItemId = selectedItem?.id ?? "";
    const selectedNormalizedName = selectedItem?.normalizedName ?? "";

    const stationRequirements = useMemo(() => {
        if (!selectedItem || !stations) return [];

        const reqs: {
            stationName: string;
            stationNormalizedName: string;
            stationId: string;
            stationImageLink?: string;
            stationMaxLevel: number;
            level: number;
            count: number;
            isFir: boolean;
            isCompleted: boolean;
            isStationMaxed: boolean;
            requirementId: string;
        }[] = [];

        stations.forEach((station) => {
            const currentLevel = stationLevels[station.id] ?? 0;
            const maxLevel = station.levels.reduce(
                (highestLevel, level) => Math.max(highestLevel, level.level),
                0,
            );
            const isStationMaxed = currentLevel >= maxLevel;

            station.levels.forEach((level) => {
                level.itemRequirements.forEach((req) => {
                    if (req.itemId === selectedItem.id) {
                        reqs.push({
                            stationName: station.name,
                            stationNormalizedName: station.normalizedName,
                            stationId: station.id,
                            stationImageLink: station.imageLink,
                            stationMaxLevel: maxLevel,
                            level: level.level,
                            count: req.count,
                            isFir: req.isFir,
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
        gameEdition,
        gameMode,
    } = useUserStore();
    const usageKey = `${toTarkovJsonGameMode(gameMode)}:${selectedItemId}`;
    const [usageResult, setUsageResult] = useState<{ key: string; data: ItemUsagePayload } | null>(
        () => {
            const cached = itemUsageCache.get(usageKey);
            return cached ? { key: usageKey, data: cached } : null;
        },
    );
    const [usageErrorResult, setUsageErrorResult] = useState<{
        key: string;
        message: string;
    } | null>(null);
    const marketPrice = selectedItem?.marketPrice;

    useEffect(() => {
        if (!isOpen || !selectedItemId || itemUsageCache.has(usageKey)) return;

        const controller = new AbortController();
        const mode = toTarkovJsonGameMode(gameMode);

        fetch(`/api/items/${encodeURIComponent(selectedItemId)}/usage?mode=${mode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Item usage request failed (${response.status})`);
                return (await response.json()) as ItemUsagePayload;
            })
            .then((data) => {
                if (isCompleteItemUsagePayload(data)) {
                    itemUsageCache.set(usageKey, data);
                }
                setUsageErrorResult(null);
                setUsageResult({ key: usageKey, data });
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setUsageErrorResult({
                    key: usageKey,
                    message: "Trader and crafting data could not be loaded.",
                });
            });

        return () => controller.abort();
    }, [gameMode, isOpen, selectedItemId, usageKey]);

    const itemUsage =
        itemUsageCache.get(usageKey) ??
        (usageResult?.key === usageKey ? usageResult.data : null);
    const usageRequestError =
        usageErrorResult?.key === usageKey ? usageErrorResult.message : null;
    const isUsageLoading =
        isOpen &&
        selectedItemId.length > 0 &&
        itemUsage === null &&
        usageRequestError === null;

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
        }).filter((group) => group.itemIds.includes(selectedItem.id));
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

    const questRewards = useMemo(
        () => questRewardIndex.find((entry) => entry.itemId === selectedItemId)?.quests ?? [],
        [questRewardIndex, selectedItemId],
    );

    const itemDetailsById = useMemo(() => {
        const details: Record<string, ItemDetails> = {};
        for (const catalogItem of catalogItems ?? []) {
            details[catalogItem.id] = catalogItem;
        }
        if (selectedItem) {
            details[selectedItem.id] = selectedItem;
        }
        return details;
    }, [catalogItems, selectedItem]);

    const traderOffers = useMemo<ItemTraderOffer[]>(() => {
        const traders = new Map(
            questAvailabilityQuests.map((quest) => [quest.trader.id, quest.trader]),
        );
        const quests = new Map(questAvailabilityQuests.map((quest) => [quest.id, quest]));
        return (itemUsage?.barters ?? []).map((barter) => {
            const trader =
                itemUsage?.tradersById?.[barter.traderId] ?? traders.get(barter.traderId);
            const unlock = barter.taskUnlockId
                ? itemUsage?.taskUnlocksById?.[barter.taskUnlockId] ??
                  quests.get(barter.taskUnlockId)
                : null;
            return {
                id: barter.id,
                trader: trader ?? {
                    id: barter.traderId,
                    name: "Unknown trader",
                    normalizedName: barter.traderId,
                },
                minTraderLevel: barter.minTraderLevel,
                taskUnlock: barter.taskUnlockId
                    ? {
                          id: barter.taskUnlockId,
                          name: unlock?.name ?? "Quest unlock",
                          wikiLink: unlock?.wikiLink,
                      }
                    : null,
                requiredItems: barter.requiredItems.map((entry) => ({
                    item: itemById[entry.itemId] ?? {
                        id: entry.itemId,
                        name: "Unknown item",
                        normalizedName: entry.itemId,
                    },
                    count: entry.count,
                    isTool: entry.isTool,
                })),
                offeredCount: barter.offeredCount,
                buyLimit: barter.buyLimit,
            };
        });
    }, [itemById, itemUsage, questAvailabilityQuests]);

    const crafts = useMemo<ItemCraftRecipe[]>(() => {
        const stationsById = new Map((stations ?? []).map((station) => [station.id, station]));
        const quests = new Map(questAvailabilityQuests.map((quest) => [quest.id, quest]));
        return (itemUsage?.crafts ?? []).map((craft) => {
            const station = stationsById.get(craft.stationId);
            const unlock = craft.taskUnlockId
                ? itemUsage?.taskUnlocksById?.[craft.taskUnlockId] ??
                  quests.get(craft.taskUnlockId)
                : null;
            const toAmount = (entry: (typeof craft.requiredItems)[number]) => ({
                item: itemById[entry.itemId] ?? {
                    id: entry.itemId,
                    name: "Quest item",
                    normalizedName: entry.itemId,
                },
                count: entry.count,
                isTool: entry.isTool,
            });
            return {
                id: craft.id,
                station: station
                    ? {
                          id: station.id,
                          name: station.name,
                          normalizedName: station.normalizedName,
                          imageLink: station.imageLink,
                      }
                    : {
                          id: craft.stationId,
                          name: "Unknown station",
                          normalizedName: craft.stationId,
                      },
                level: craft.level,
                duration: craft.duration,
                taskUnlock: craft.taskUnlockId
                    ? {
                          id: craft.taskUnlockId,
                          name: unlock?.name ?? "Quest unlock",
                          wikiLink: unlock?.wikiLink,
                      }
                    : null,
                requiredItems: craft.requiredItems.map(toAmount),
                requiredQuestItems: craft.requiredQuestItems.map(toAmount),
                gameEditions: craft.gameEditions,
                productCount: craft.productCount,
            };
        });
    }, [itemById, itemUsage, questAvailabilityQuests, stations]);

    const hasQuestRequirements =
        (questItemState?.relatedQuests.length ?? 0) > 0 ||
        questAnyOfGroupState.length > 0 ||
        questRewards.length > 0;
    const hideoutUseCount = stationRequirements.reduce((count, [, reqs]) => count + reqs.length, 0);
    const questUseCount =
        (questItemState?.relatedQuestCount ?? 0) + questAnyOfGroupState.length + questRewards.length;

    if (!selectedItem) {
        return null;
    }

    const showInventory = !isRouble;
    const showMarket = !isRouble && hasItemMarketData(marketPrice);
    const showPriceHistory =
        !isRouble &&
        !isFiat &&
        (marketPrice?.avg24hPrice != null || marketPrice?.lastLowPrice != null);
    const showSidebar = showInventory || showMarket;
    const showUsage =
        stationRequirements.length > 0 ||
        hasQuestRequirements ||
        traderOffers.length > 0 ||
        crafts.length > 0 ||
        isUsageLoading ||
        usageRequestError !== null ||
        itemUsage?.bartersError != null ||
        itemUsage?.craftsError != null ||
        showPriceHistory;

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
                                    minLevelForFlea={selectedItem.minLevelForFlea}
                                    playerLevel={playerLevel}
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
                                    questRewards={questRewards}
                                    anyOfGroups={questAnyOfGroupState}
                                    itemDetailsById={itemDetailsById}
                                    traderOffers={traderOffers}
                                    crafts={crafts}
                                    acquisitionLoading={isUsageLoading}
                                    barterError={itemUsage?.bartersError ?? usageRequestError}
                                    craftError={itemUsage?.craftsError ?? usageRequestError}
                                    completedQuests={completedQuests}
                                    traderLoyaltyLevels={questTraderLoyaltyLevels}
                                    gameEdition={gameEdition}
                                    gameMode={toTarkovJsonGameMode(gameMode)}
                                    showPriceHistory={showPriceHistory}
                                />
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
