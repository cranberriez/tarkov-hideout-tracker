"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import type { ItemCraftRecipe, ItemTraderOffer } from "@/features/items/item-detail/item-detail-types";
import type { ItemSummary } from "@/types/items";
import type {
    ItemAcquisitionTreeData,
    ItemRelationsPayload,
    ItemUsageData,
} from "@/types/contracts";
import { ArrowLeft, Bug, PackageOpen, X } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { computeNeeds } from "@/lib/utils/item-needs";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { hasItemMarketData } from "./ItemDetailMarket";
import { ItemDetailSidebar } from "./ItemDetailSidebar";
import { ItemDetailUsageTabs } from "./ItemDetailUsageTabs";
import { deriveQuestAnyOfGroups, deriveQuestItemState } from "@/lib/utils/quest-item-index";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { isCompleteItemUsageData } from "@/lib/utils/item-usage";
import { summarizeItemDetailDemand } from "./item-detail-summary";
import { evaluateBarters, evaluateCrafts } from "@/lib/price-calculation";
import { useManualPriceOverrides } from "@/features/profit-pages/useManualPriceOverrides";
import {
    emptyItemNavigation,
    popItemNavigation,
    pushItemNavigation,
    reconcileItemNavigation,
    toItemNavigationEntry,
} from "./item-detail-navigation";
import {
    buildStationRequirements,
    getItemRelationsError,
    hasCompleteItemRelations,
    mergeItemDetailItems,
} from "./item-detail-data";

const itemRelationsCache = new Map<string, ItemRelationsPayload>();
const itemUsageCache = new Map<string, ItemUsageData>();
const acquisitionTreeCache = new Map<string, ItemAcquisitionTreeData>();

function indexByOutput<T>(records: T[], getItemId: (record: T) => string) {
    const index: Record<string, T[]> = Object.create(null) as Record<string, T[]>;
    for (const record of records) (index[getItemId(record)] ??= []).push(record);
    return index;
}

export interface ItemDetailModalProps {
    item: ItemSummary | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ItemDetailModal({
    item,
    isOpen,
    onClose,
}: ItemDetailModalProps) {
    const sourceNavigationItem = item ? toItemNavigationEntry(item) : null;
    const [storedItemNavigation, setItemNavigation] = useState(emptyItemNavigation);
    const [navigatedItemsById, setNavigatedItemsById] = useState<
        Record<string, ItemSummary>
    >({});
    const itemNavigation = reconcileItemNavigation(
        storedItemNavigation,
        sourceNavigationItem,
        isOpen,
    );
    if (itemNavigation !== storedItemNavigation) {
        setItemNavigation(itemNavigation);
    }
    const activeItemId = itemNavigation.entries.at(-1)?.id ?? "";

    const {
        stationLevels,
        hiddenStations,
        completedRequirements,
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
    const { overrides } = useManualPriceOverrides(gameMode);
    const tarkovMode = toTarkovJsonGameMode(gameMode);
    const requestKey = `${tarkovMode}:${activeItemId}`;
    const [relationsResult, setRelationsResult] = useState<{
        key: string;
        data: ItemRelationsPayload;
    } | null>(() => {
        const cached = itemRelationsCache.get(requestKey);
        return cached ? { key: requestKey, data: cached } : null;
    });
    const [relationsErrorResult, setRelationsErrorResult] = useState<{
        key: string;
        message: string;
    } | null>(null);
    const [usageResult, setUsageResult] = useState<{ key: string; data: ItemUsageData } | null>(
        () => {
            const cached = itemUsageCache.get(requestKey);
            return cached ? { key: requestKey, data: cached } : null;
        },
    );
    const [usageErrorResult, setUsageErrorResult] = useState<{
        key: string;
        message: string;
    } | null>(null);
    const [treeResult, setTreeResult] = useState<{
        key: string;
        data: ItemAcquisitionTreeData;
    } | null>(() => {
        const cached = acquisitionTreeCache.get(requestKey);
        return cached ? { key: requestKey, data: cached } : null;
    });
    const [treeErrorResult, setTreeErrorResult] = useState<{
        key: string;
        message: string;
    } | null>(null);
    const [debugItemId, setDebugItemId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !activeItemId || itemRelationsCache.has(requestKey)) return;

        const controller = new AbortController();
        fetch(`/api/items/${encodeURIComponent(activeItemId)}/relations?mode=${tarkovMode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Item relations request failed (${response.status})`);
                }
                return (await response.json()) as ItemRelationsPayload;
            })
            .then((data) => {
                if (hasCompleteItemRelations(data)) {
                    itemRelationsCache.set(requestKey, data);
                }
                setRelationsErrorResult(null);
                setRelationsResult({ key: requestKey, data });
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setRelationsErrorResult({
                    key: requestKey,
                    message: "Hideout and quest relations could not be loaded.",
                });
            });

        return () => controller.abort();
    }, [activeItemId, isOpen, requestKey, tarkovMode]);

    useEffect(() => {
        if (!isOpen || !activeItemId || itemUsageCache.has(requestKey)) return;

        const controller = new AbortController();
        fetch(`/api/items/${encodeURIComponent(activeItemId)}/usage?mode=${tarkovMode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Item usage request failed (${response.status})`);
                return (await response.json()) as ItemUsageData;
            })
            .then((data) => {
                if (isCompleteItemUsageData(data)) {
                    itemUsageCache.set(requestKey, data);
                }
                setUsageErrorResult(null);
                setUsageResult({ key: requestKey, data });
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setUsageErrorResult({
                    key: requestKey,
                    message: "Trader and crafting data could not be loaded.",
                });
            });

        return () => controller.abort();
    }, [activeItemId, isOpen, requestKey, tarkovMode]);

    useEffect(() => {
        if (!isOpen || !activeItemId || acquisitionTreeCache.has(requestKey)) return;

        const controller = new AbortController();
        fetch(`/api/items/${encodeURIComponent(activeItemId)}/acquisition-tree?mode=${tarkovMode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Acquisition tree request failed (${response.status})`);
                return (await response.json()) as ItemAcquisitionTreeData;
            })
            .then((data) => {
                acquisitionTreeCache.set(requestKey, data);
                setTreeErrorResult(null);
                setTreeResult({ key: requestKey, data });
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setTreeErrorResult({
                    key: requestKey,
                    message: "Profit recommendations could not be loaded.",
                });
            });

        return () => controller.abort();
    }, [activeItemId, isOpen, requestKey, tarkovMode]);

    const itemRelations =
        itemRelationsCache.get(requestKey) ??
        (relationsResult?.key === requestKey ? relationsResult.data : null);
    const relationsRequestError =
        relationsErrorResult?.key === requestKey
            ? relationsErrorResult.message
            : null;
    const relationsError = getItemRelationsError(itemRelations, relationsRequestError);
    const isRelationsLoading =
        isOpen &&
        activeItemId.length > 0 &&
        itemRelations === null &&
        relationsRequestError === null;
    const itemUsage =
        itemUsageCache.get(requestKey) ??
        (usageResult?.key === requestKey ? usageResult.data : null);
    const usageRequestError =
        usageErrorResult?.key === requestKey ? usageErrorResult.message : null;
    const isUsageLoading =
        isOpen &&
        activeItemId.length > 0 &&
        itemUsage === null &&
        usageRequestError === null;
    const acquisitionTree =
        acquisitionTreeCache.get(requestKey) ??
        (treeResult?.key === requestKey ? treeResult.data : null);
    const profitError =
        treeErrorResult?.key === requestKey ? treeErrorResult.message : null;
    const isProfitLoading =
        isOpen &&
        activeItemId.length > 0 &&
        acquisitionTree === null &&
        profitError === null;

    const itemDetailsById = mergeItemDetailItems(
        item ? [item] : [],
        Object.values(navigatedItemsById),
        acquisitionTree?.items,
        itemUsage?.items,
        itemRelations?.relatedItems,
        itemRelations?.item ? [itemRelations.item] : [],
    );
    const selectedItem = itemDetailsById[activeItemId] ?? null;
    const selectedItemId = selectedItem?.id ?? activeItemId;
    const selectedNormalizedName = selectedItem?.normalizedName ?? "";
    const marketPrice = selectedItem?.marketPrice;
    const stationRequirements = buildStationRequirements(itemRelations, stationLevels);
    const questItemIndex = itemRelations?.questItemIndex ?? [];
    const questRewardIndex = itemRelations?.questRewardIndex ?? [];
    const questAnyOfGroups = itemRelations?.questAnyOfGroups ?? [];
    const questAvailabilityQuests = itemRelations?.questAvailabilityQuests ?? [];

    const isRouble = selectedNormalizedName === "roubles";
    const isDollar = selectedNormalizedName === "dollars";
    const isEuro = selectedNormalizedName === "euros";
    const isFiat = isDollar || isEuro;

    const relativeUpdatedAt = formatRelativeUpdatedAt(marketPrice?.updatedAt ?? null);
    const owned = itemCounts[selectedItemId] ?? { have: 0, haveFir: 0 };

    const questDerivationOptions = {
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
    } as const;
    const questItemEntry = selectedItem
        ? questItemIndex.find((entry) => entry.itemId === selectedItem.id)
        : null;
    const questItemState = questItemEntry
        ? deriveQuestItemState(questItemEntry, questDerivationOptions)
        : null;
    const questAnyOfGroupState = selectedItem
        ? deriveQuestAnyOfGroups(questAnyOfGroups, questDerivationOptions).filter(
              (group) => group.itemIds.includes(selectedItem.id),
          )
        : [];

    const questRewards =
        questRewardIndex.find((entry) => entry.itemId === selectedItemId)?.quests ?? [];

    const demandSummary = summarizeItemDetailDemand({
        stationRequirements,
        completedRequirements,
        questItemState,
        anyOfGroups: questAnyOfGroupState,
    });

    const needsBreakdown =
        demandSummary.totalRequiredCount === 0
            ? null
            : computeNeeds({
                  totalRequired: demandSummary.totalRequiredCount,
                  requiredFir: demandSummary.totalRequiredFirCount,
                  haveNonFir: owned.have,
                  haveFir: owned.haveFir,
              });

    const { barterEvaluationsById, craftEvaluationsById } = (() => {
        if (!itemUsage || !acquisitionTree) {
            return { barterEvaluationsById: {}, craftEvaluationsById: {} };
        }
        const bartersByItemId = indexByOutput(
            acquisitionTree.barters,
            (barter) => barter.offeredItemId,
        );
        const craftsByItemId = indexByOutput(
            acquisitionTree.crafts,
            (craft) => craft.productItemId,
        );
        const context = {
            itemsById: itemDetailsById,
            bartersByItemId,
            craftsByItemId,
            overrides,
        };
        return {
            barterEvaluationsById: Object.fromEntries(
                evaluateBarters(itemUsage.barters, context).map((evaluation) => [
                    evaluation.id,
                    evaluation,
                ]),
            ),
            craftEvaluationsById: Object.fromEntries(
                evaluateCrafts(itemUsage.crafts, context).map((evaluation) => [
                    evaluation.id,
                    evaluation,
                ]),
            ),
        };
    })();

    const traderOffers: ItemTraderOffer[] = (() => {
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
                    item: itemDetailsById[entry.itemId] ?? {
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
    })();

    const crafts: ItemCraftRecipe[] = (() => {
        const quests = new Map(questAvailabilityQuests.map((quest) => [quest.id, quest]));
        return (itemUsage?.crafts ?? []).map((craft) => {
            const station = itemUsage?.stationsById[craft.stationId];
            const unlock = craft.taskUnlockId
                ? itemUsage?.taskUnlocksById?.[craft.taskUnlockId] ??
                  quests.get(craft.taskUnlockId)
                : null;
            const toAmount = (entry: (typeof craft.requiredItems)[number]) => ({
                item: itemDetailsById[entry.itemId] ?? {
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
    })();

    const usagePresentationError = itemUsage
        ? [itemUsage.itemsError, itemUsage.pricesError, itemUsage.presentationError]
              .filter((error): error is string => Boolean(error))
              .join(" ") || null
        : null;

    const hasQuestRequirements =
        (questItemState?.relatedQuests.length ?? 0) > 0 ||
        questAnyOfGroupState.length > 0 ||
        questRewards.length > 0;
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
        isRelationsLoading ||
        relationsError !== null ||
        showPriceHistory;
    const isDevelopment = process.env.NODE_ENV === "development";
    const showDebug = debugItemId === selectedItemId;
    const previousItem = itemNavigation.entries.at(-2) ?? null;
    const handleClose = () => {
        setDebugItemId(null);
        setItemNavigation(emptyItemNavigation);
        setNavigatedItemsById({});
        onClose();
    };
    const handleItemClick = (itemId: string) => {
        const nextItem = itemDetailsById[itemId];
        if (!nextItem || itemId === selectedItemId) return;
        setDebugItemId(null);
        setNavigatedItemsById((items) => ({ ...items, [nextItem.id]: nextItem }));
        setItemNavigation(pushItemNavigation(itemNavigation, toItemNavigationEntry(nextItem)));
    };
    const handleBack = () => {
        setDebugItemId(null);
        setItemNavigation(popItemNavigation(itemNavigation));
    };
    const debugData = {
        item: selectedItem,
        inventory: {
            owned,
            needsBreakdown,
            demandSummary,
        },
        hideout: {
            stationRequirements,
        },
        quests: {
            relationsLoading: isRelationsLoading,
            relationsError,
            itemState: questItemState,
            anyOfGroups: questAnyOfGroupState,
            rewards: questRewards,
        },
        acquisition: {
            usage: itemUsage,
            usageLoading: isUsageLoading,
            usageError: usageRequestError,
            traderOffers,
            crafts,
            tree: acquisitionTree,
            profitLoading: isProfitLoading,
            profitError,
        },
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                showCloseButton={false}
                className="w-full overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-w-4xl lg:max-w-5xl"
            >
                <DialogTitle className="sr-only">{selectedItem.name}</DialogTitle>
                {previousItem && (
                    <button
                        type="button"
                        onClick={handleBack}
                        className="absolute bottom-full left-0 mb-2 inline-flex h-10 items-center gap-2 rounded-md bg-background px-3 text-sm font-medium text-foreground shadow-2xl transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tarkov-green/70"
                        aria-label="Back to previous item"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        {previousItem.iconLink ? (
                            <Image
                                src={previousItem.iconLink}
                                alt=""
                                width={28}
                                height={28}
                                unoptimized
                                className="h-7 w-7 object-contain"
                            />
                        ) : (
                            <PackageOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span>Back</span>
                    </button>
                )}
                <div
                    className={`flex w-full flex-col overflow-hidden rounded-lg border border-border-color bg-background shadow-2xl ${
                        previousItem ? "max-h-[calc(92vh-3rem)]" : "max-h-[92vh]"
                    }`}
                >
                    {showDebug && isDevelopment ? (
                        <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden bg-[#0b0c0e]">
                            <header className="flex items-center justify-between border-b border-border-color px-4 py-3">
                                <div>
                                    <p className="text-xs font-semibold text-white">Item debug data</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        Item and related modal data, excluding pricing
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                                    aria-label="Close item details"
                                >
                                    <X size={18} />
                                </button>
                            </header>
                            <pre className="min-h-0 flex-1 overflow-auto p-4 text-[10px] leading-relaxed text-gray-400">
                                {JSON.stringify(
                                    debugData,
                                    (key, value) => (key === "marketPrice" ? undefined : value),
                                    2,
                                )}
                            </pre>
                        </section>
                    ) : (
                        <>
                            <header className="relative border-b border-border-color bg-gradient-to-br from-card via-card to-background py-3 pl-3 pr-20 sm:py-4 sm:pl-4 sm:pr-24">
                                <ItemDetailHeader
                                    item={selectedItem}
                                    totalRequiredCount={demandSummary.totalRequiredCount}
                                    needsBreakdown={needsBreakdown}
                                    hideoutRequiredCount={demandSummary.hideoutRequiredCount}
                                    questRequiredCount={demandSummary.questRequiredCount}
                                />
                                <button
                                    type="button"
                                    onClick={handleClose}
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
                                                relationsLoading={isRelationsLoading}
                                                relationsError={relationsError}
                                                acquisitionLoading={isUsageLoading}
                                                barterError={itemUsage?.bartersError ?? usageRequestError}
                                                craftError={itemUsage?.craftsError ?? usageRequestError}
                                                acquisitionWarning={usagePresentationError}
                                                completedQuests={completedQuests}
                                                traderLoyaltyLevels={questTraderLoyaltyLevels}
                                                gameEdition={gameEdition}
                                                gameMode={tarkovMode}
                                                showPriceHistory={showPriceHistory}
                                                barterEvaluationsById={barterEvaluationsById}
                                                craftEvaluationsById={craftEvaluationsById}
                                                profitLoading={isProfitLoading}
                                                profitError={profitError}
                                                onItemClick={handleItemClick}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                {isDevelopment && (
                    <button
                        type="button"
                        onClick={() =>
                            setDebugItemId((currentItemId) =>
                                currentItemId === selectedItemId ? null : selectedItemId,
                            )
                        }
                        aria-label={showDebug ? "Hide item debug data" : "Show item debug data"}
                        aria-expanded={showDebug}
                        className={`absolute -bottom-2.5 -right-2.5 z-[60] flex h-6 w-6 items-center justify-center rounded-full border bg-[#111316] shadow-xl transition-colors ${
                            showDebug
                                ? "border-tarkov-green/50 text-tarkov-green"
                                : "border-white/15 text-gray-600 hover:border-white/30 hover:text-gray-300"
                        }`}
                    >
                        <Bug size={11} />
                    </button>
                )}
            </DialogContent>
        </Dialog>
    );
}
