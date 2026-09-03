"use client";

import type { ItemCraftRecipe, ItemTraderOffer } from "./item-detail-types";
import type { ItemSummary } from "@/types/items";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { computeNeeds } from "@/lib/utils/item-needs";
import { deriveQuestAnyOfGroups, deriveQuestItemState } from "@/lib/utils/quest-item-index";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { evaluateBarters, evaluateCrafts } from "@/lib/price-calculation";
import { useManualPriceOverrides } from "@/features/profit-pages/useManualPriceOverrides";
import { hasItemMarketData } from "./ItemDetailMarket";
import { summarizeItemDetailDemand } from "./item-detail-summary";
import { buildStationRequirements, mergeItemDetailItems } from "./item-detail-data";
import { useItemDetailNavigationController } from "./useItemDetailNavigationController";
import { useItemDetailRequestController } from "./useItemDetailRequestController";

function indexByOutput<T>(records: T[], getItemId: (record: T) => string) {
    const index: Record<string, T[]> = Object.create(null) as Record<string, T[]>;
    for (const record of records) (index[getItemId(record)] ??= []).push(record);
    return index;
}

export function useItemDetailModalController({
    item,
    isOpen,
    onClose,
}: {
    item: ItemSummary | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    const navigation = useItemDetailNavigationController({ item, isOpen, onClose });
    const { activeItemId, navigatedItemsById } = navigation;
    const store = useUserStore();
    const { overrides } = useManualPriceOverrides(store.gameMode);
    const tarkovMode = toTarkovJsonGameMode(store.gameMode);
    const requests = useItemDetailRequestController({ activeItemId, isOpen, mode: tarkovMode });
    const itemRelations = requests.relations;
    const itemUsage = requests.usage;
    const acquisitionTree = requests.tree;
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
    const marketPrice = selectedItem?.marketPrice;
    const stationRequirements = buildStationRequirements(itemRelations, store.stationLevels);
    const questItemIndex = itemRelations?.questItemIndex ?? [];
    const questRewardIndex = itemRelations?.questRewardIndex ?? [];
    const questAnyOfGroups = itemRelations?.questAnyOfGroups ?? [];
    const questAvailabilityQuests = itemRelations?.questAvailabilityQuests ?? [];
    const isRouble = selectedItem?.normalizedName === "roubles";
    const isFiat =
        selectedItem?.normalizedName === "dollars" || selectedItem?.normalizedName === "euros";
    const relativeUpdatedAt = formatRelativeUpdatedAt(marketPrice?.updatedAt ?? null);
    const owned = store.itemCounts[selectedItemId] ?? { have: 0, haveFir: 0 };
    const questDerivationOptions = {
        completedQuests: store.completedQuests,
        failedQuests: store.failedQuests,
        ignoredQuests: store.ignoredQuests,
        pinnedQuests: store.pinnedQuests,
        playerLevel: store.playerLevel,
        prestigeLevel: store.prestigeLevel,
        faction: store.questFaction,
        traderLoyaltyLevels: store.questTraderLoyaltyLevels,
        quests: questAvailabilityQuests,
        visibilityMode: store.itemQuestVisibilityMode,
        customLookahead: store.itemQuestCustomLookahead,
        customLevelLookahead: store.itemQuestCustomLevelLookahead,
        showFutureFir: store.itemShowFutureFir,
        showIgnored: store.itemShowIgnored,
        includeCompleted: true,
        showKappa: store.questShowKappa,
        showLightkeeper: store.questShowLightkeeper,
    } as const;
    const questItemEntry = selectedItem
        ? questItemIndex.find((entry) => entry.itemId === selectedItem.id)
        : null;
    const questItemState = questItemEntry
        ? deriveQuestItemState(questItemEntry, questDerivationOptions)
        : null;
    const questAnyOfGroupState = selectedItem
        ? deriveQuestAnyOfGroups(questAnyOfGroups, questDerivationOptions).filter((group) =>
              group.itemIds.includes(selectedItem.id),
          )
        : [];
    const questRewards =
        questRewardIndex.find((entry) => entry.itemId === selectedItemId)?.quests ?? [];
    const demandSummary = summarizeItemDetailDemand({
        stationRequirements,
        completedRequirements: store.completedRequirements,
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
        const context = {
            itemsById: itemDetailsById,
            bartersByItemId: indexByOutput(
                acquisitionTree.barters,
                (barter) => barter.offeredItemId,
            ),
            craftsByItemId: indexByOutput(
                acquisitionTree.crafts,
                (craft) => craft.productItemId,
            ),
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
    const traders = new Map(
        questAvailabilityQuests.map((quest) => [quest.trader.id, quest.trader]),
    );
    const quests = new Map(questAvailabilityQuests.map((quest) => [quest.id, quest]));
    const traderOffers: ItemTraderOffer[] = (itemUsage?.barters ?? []).map((barter) => {
        const trader = itemUsage?.tradersById?.[barter.traderId] ?? traders.get(barter.traderId);
        const unlock = barter.taskUnlockId
            ? itemUsage?.taskUnlocksById?.[barter.taskUnlockId] ?? quests.get(barter.taskUnlockId)
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
                ? { id: barter.taskUnlockId, name: unlock?.name ?? "Quest unlock", wikiLink: unlock?.wikiLink }
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
    const crafts: ItemCraftRecipe[] = (itemUsage?.crafts ?? []).map((craft) => {
        const station = itemUsage?.stationsById?.[craft.stationId];
        const unlock = craft.taskUnlockId
            ? itemUsage?.taskUnlocksById?.[craft.taskUnlockId] ?? quests.get(craft.taskUnlockId)
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
                ? { ...station }
                : { id: craft.stationId, name: "Unknown station", normalizedName: craft.stationId },
            level: craft.level,
            duration: craft.duration,
            taskUnlock: craft.taskUnlockId
                ? { id: craft.taskUnlockId, name: unlock?.name ?? "Quest unlock", wikiLink: unlock?.wikiLink }
                : null,
            requiredItems: craft.requiredItems.map(toAmount),
            requiredQuestItems: craft.requiredQuestItems.map(toAmount),
            gameEditions: craft.gameEditions,
            productCount: craft.productCount,
        };
    });
    const usagePresentationError = itemUsage
        ? [itemUsage.itemsError, itemUsage.pricesError, itemUsage.presentationError]
              .filter((error): error is string => Boolean(error))
              .join(" ") || null
        : null;
    const showInventory = !isRouble;
    const showMarket = !isRouble && hasItemMarketData(marketPrice);
    const showPriceHistory =
        !isRouble &&
        !isFiat &&
        (marketPrice?.avg24hPrice != null || marketPrice?.lastLowPrice != null);
    const showSidebar = showInventory || showMarket;
    const showDebug = navigation.debugItemId === selectedItemId;
    const debugData = {
        item: selectedItem,
        inventory: { owned, needsBreakdown, demandSummary },
        hideout: { stationRequirements },
        quests: {
            relationsLoading: requests.relationsLoading,
            relationsError: requests.relationsError,
            itemState: questItemState,
            anyOfGroups: questAnyOfGroupState,
            rewards: questRewards,
        },
        acquisition: {
            usage: itemUsage,
            usageLoading: requests.usageLoading,
            usageError: requests.usageError,
            traderOffers,
            crafts,
            tree: acquisitionTree,
            profitLoading: requests.treeLoading,
            profitError: requests.treeError,
        },
    };

    return {
        selectedItem,
        selectedItemId,
        marketPrice,
        relativeUpdatedAt,
        owned,
        stationRequirements,
        questItemState,
        questAnyOfGroupState,
        questRewards,
        demandSummary,
        needsBreakdown,
        itemDetailsById,
        traderOffers,
        crafts,
        barterEvaluationsById,
        craftEvaluationsById,
        usagePresentationError,
        isFiat,
        showMarket,
        showPriceHistory,
        showSidebar,
        showDebug,
        debugData,
        previousItem: navigation.previousItem,
        isDevelopment: process.env.NODE_ENV === "development",
        stationLevels: store.stationLevels,
        hiddenStations: store.hiddenStations,
        completedQuests: store.completedQuests,
        traderLoyaltyLevels: store.questTraderLoyaltyLevels,
        playerLevel: store.playerLevel,
        gameEdition: store.gameEdition,
        tarkovMode,
        addItemCounts: store.addItemCounts,
        relationsLoading: requests.relationsLoading,
        relationsError: requests.relationsError,
        usageLoading: requests.usageLoading,
        usageError: requests.usageError,
        barterError: itemUsage?.bartersError ?? requests.usageError,
        craftError: itemUsage?.craftsError ?? requests.usageError,
        profitLoading: requests.treeLoading,
        profitError: requests.treeError,
        close: navigation.close,
        back: navigation.back,
        openItem(itemId: string) {
            const nextItem = itemDetailsById[itemId];
            if (nextItem) navigation.navigate(nextItem);
        },
        toggleDebug() {
            navigation.toggleDebug(selectedItemId);
        },
    };
}
