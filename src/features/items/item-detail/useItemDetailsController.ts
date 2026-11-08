"use client";

import { craftingDuration } from "@/lib/price-calculation/crafting-skill";
import { isDev } from "@/lib/is-dev";
import { craftRequiredItems, isTrackedCraft } from "@/lib/price-calculation/craft-rules";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import { useMemo, useState } from "react";
import type { ItemBarterOffer, ItemCraftRecipe, ItemTraderOffer } from "./item-detail-types";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { ItemSummary } from "@/types/items";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { computeNeeds } from "@/lib/utils/item-needs";
import { deriveQuestAnyOfGroups, deriveQuestItemState } from "@/lib/quests/quest-item-index";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { createRecipeCalculator } from "@/lib/price-calculation";
import { useManualPriceOverrides } from "@/features/profit-pages/useManualPriceOverrides";
import { hasItemMarketData } from "./ItemDetailMarket";
import { summarizeItemDetailDemand } from "./item-detail-summary";
import { buildStationRequirements, mergeItemDetailItems } from "./item-detail-data";
import { useItemDetailRequestController, type InitialItemDetailViews } from "./useItemDetailRequestController";
import { useItemPrices } from "../useItemPrices";
import { isPriceItemId } from "@/lib/query/price-contract";
import { useUIStore } from "@/lib/stores/useUIStore";
import type { ItemDetailModalProps } from "./ItemDetailModal";
import type { UsageTab } from "./ItemDetailUsageTabs";

const EMPTY_OWNED = { have: 0, haveFir: 0 };

/** Profile values the item details read; subscribing to the whole store re-renders on any change. */
function selectItemDetailState(state: ReturnType<typeof useUserStore.getState>) {
	return {
		addItemCounts: state.addItemCounts,
		completedQuests: state.completedQuests,
		completedRequirements: state.completedRequirements,
		failedQuests: state.failedQuests,
		gameEdition: state.gameEdition,
		gameMode: state.gameMode,
		hiddenStations: state.hiddenStations,
		ignoredQuests: state.ignoredQuests,
		itemCounts: state.itemCounts,
		itemQuestCustomLevelLookahead: state.itemQuestCustomLevelLookahead,
		itemQuestCustomLookahead: state.itemQuestCustomLookahead,
		itemQuestVisibilityMode: state.itemQuestVisibilityMode,
		itemShowFutureFir: state.itemShowFutureFir,
		itemShowIgnored: state.itemShowIgnored,
		pinnedQuests: state.pinnedQuests,
		playerLevel: state.playerLevel,
		prestigeLevel: state.prestigeLevel,
		questFaction: state.questFaction,
		questFenceReputation: state.questFenceReputation,
		questTraderLoyaltyLevels: state.questTraderLoyaltyLevels,
		stationLevels: state.stationLevels,
	};
}

/**
 * Item data and derived values shared by the item dialog and the item page.
 * `knownItems` seeds summaries already on hand (the opened items or route item);
 * `enabled` gates the mode-aware detail requests.
 */
export function useItemDetailsController({
	activeItemId,
	knownItems,
	enabled,
	mode,
	initialViews,
}: {
	activeItemId: string;
	knownItems: readonly ItemSummary[];
	enabled: boolean;
	/** Route data mode (item page); the dialog follows the active profile's mode. */
	mode?: TarkovJsonGameMode;
	initialViews?: InitialItemDetailViews;
}) {
	const isOpen = enabled;
	const liveStore = useUserStore(useShallow(selectItemDetailState));
	// Rows always render from item data; profile-dependent values use the initial profile
	// until the saved one loads, so server HTML and the hydration render agree.
	const profileReady = useUserStoreHydrated();
	const store = profileReady
		? liveStore
		: { ...selectItemDetailState(useUserStore.getInitialState()), addItemCounts: liveStore.addItemCounts };
	const { overrides } = useManualPriceOverrides(store.gameMode);
	const { craftingSkillLevel, hideoutManagementSkillLevel, ignorePlayerLevel } = useProfitOptions(store.gameMode);
	const tarkovMode = mode ?? toTarkovJsonGameMode(store.gameMode);
	const tabScope = `${tarkovMode}:${activeItemId}`;
	const [tabSelection, setTabSelection] = useState<{ scope: string; tab: UsageTab; recipesOpened: boolean }>({
		scope: tabScope,
		tab: "hideout",
		recipesOpened: false,
	});
	const sameScope = tabSelection.scope === tabScope;
	const activeTab = sameScope ? tabSelection.tab : "hideout";
	// Keep recipe queries and prices subscribed after the first visit for this item.
	const loadRecipes = sameScope && tabSelection.recipesOpened;
	if (!sameScope) setTabSelection({ scope: tabScope, tab: "hideout", recipesOpened: false });
	const requests = useItemDetailRequestController({
		activeItemId,
		isOpen,
		mode: tarkovMode,
		initial: initialViews,
		loadRecipes,
	});
	const itemRelations = requests.relations;
	const itemUsage = requests.usage;
	const acquisitionTree = requests.tree;
	const unpricedItemsById = useMemo(
		() =>
			mergeItemDetailItems(
				knownItems,
				itemRelations?.relatedItems,
				itemRelations?.item ? [itemRelations.item] : [],
				acquisitionTree?.items,
				itemUsage?.items,
			),
		[acquisitionTree, knownItems, itemRelations, itemUsage],
	);
	// Only requested graphs delay prices; unopened recipe tabs never fetch ingredient prices.
	const metadataReady = !requests.relationsLoading && !requests.usageLoading && !requests.treeLoading;
	const priceIds = useMemo(
		() =>
			isOpen
				? [
						...new Set([
							activeItemId,
							...(loadRecipes && metadataReady
								? [...(itemUsage?.items ?? []), ...(acquisitionTree?.items ?? [])].map((item) => item.id)
								: []),
						]),
					].filter(isPriceItemId)
				: [],
		[isOpen, metadataReady, activeItemId, loadRecipes, itemUsage, acquisitionTree],
	);
	const prices = useItemPrices(tarkovMode, priceIds);
	const itemDetailsById = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(unpricedItemsById).map(([id, summary]) => [
					id,
					{
						...summary,
						marketPrice: prices.prices[id] ?? null,
						priceLoadState: prices.states[id] ?? (isPriceItemId(id) ? "pending" : "ready"),
					},
				]),
			),
		[unpricedItemsById, prices.prices, prices.states],
	);
	const pricesLoading = isOpen && metadataReady && prices.state === "pending";
	const priceError =
		prices.state === "error" ? "Item prices could not be updated. Reload the page to try again." : null;
	const pricesReady = Object.values(prices.states).every((state) => state === "ready") && metadataReady;
	const selectedItem = itemDetailsById[activeItemId] ?? null;
	const selectedItemId = selectedItem?.id ?? activeItemId;
	const purchaseOffers = selectedItem?.buyFromTrader;
	const marketPrice = selectedItem?.marketPrice;
	const stationRequirements = useMemo(
		() => buildStationRequirements(itemRelations, store.stationLevels),
		[itemRelations, store.stationLevels],
	);
	const isRouble = selectedItem?.normalizedName === "roubles";
	const isFiat = selectedItem?.normalizedName === "dollars" || selectedItem?.normalizedName === "euros";
	const relativeUpdatedAt = formatRelativeUpdatedAt(marketPrice?.updatedAt ?? null);
	const owned = store.itemCounts[selectedItemId] ?? EMPTY_OWNED;
	const { questItemState, questAnyOfGroupState, questRewards } = useMemo(() => {
		const questDerivationOptions = {
			completedQuests: store.completedQuests,
			failedQuests: store.failedQuests,
			ignoredQuests: store.ignoredQuests,
			pinnedQuests: store.pinnedQuests,
			playerLevel: store.playerLevel,
			prestigeLevel: store.prestigeLevel,
			faction: store.questFaction,
			traderLoyaltyLevels: store.questTraderLoyaltyLevels,
			fenceReputation: store.questFenceReputation,
			quests: itemRelations?.questAvailabilityQuests ?? [],
			visibilityMode: store.itemQuestVisibilityMode,
			customLookahead: store.itemQuestCustomLookahead,
			customLevelLookahead: store.itemQuestCustomLevelLookahead,
			showFutureFir: store.itemShowFutureFir,
			showIgnored: store.itemShowIgnored,
			includeCompleted: true,
		} as const;
		const questItemEntry = itemRelations?.questItemIndex.find((entry) => entry.itemId === selectedItemId);
		const anyOfGroups = itemRelations?.questAnyOfGroups.filter((group) => group.itemIds.includes(selectedItemId));
		return {
			questItemState: questItemEntry ? deriveQuestItemState(questItemEntry, questDerivationOptions) : null,
			questAnyOfGroupState: anyOfGroups?.length ? deriveQuestAnyOfGroups(anyOfGroups, questDerivationOptions) : [],
			questRewards: itemRelations?.questRewardIndex.find((entry) => entry.itemId === selectedItemId)?.quests ?? [],
		};
	}, [
		itemRelations,
		selectedItemId,
		store.completedQuests,
		store.failedQuests,
		store.ignoredQuests,
		store.pinnedQuests,
		store.playerLevel,
		store.prestigeLevel,
		store.questFaction,
		store.questTraderLoyaltyLevels,
		store.questFenceReputation,
		store.itemQuestVisibilityMode,
		store.itemQuestCustomLookahead,
		store.itemQuestCustomLevelLookahead,
		store.itemShowFutureFir,
		store.itemShowIgnored,
	]);
	const demandSummary = summarizeItemDetailDemand({
		stationRequirements,
		completedRequirements: store.completedRequirements,
		questItemState,
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
	const pricingPlayerLevel = ignorePlayerLevel ? undefined : store.playerLevel;
	const recipeCalculator = useMemo(
		() =>
			loadRecipes && acquisitionTree && pricesReady
				? createRecipeCalculator({
						itemsById: itemDetailsById,
						barters: acquisitionTree.barters,
						crafts: acquisitionTree.crafts,
						overrides,
						craftingSkillLevel,
						hideoutManagementSkillLevel,
						traderLoyaltyLevels: store.questTraderLoyaltyLevels,
						completedQuests: store.completedQuests,
						playerLevel: pricingPlayerLevel,
						stationLevels: store.stationLevels,
					})
				: null,
		[
			loadRecipes,
			acquisitionTree,
			pricesReady,
			craftingSkillLevel,
			hideoutManagementSkillLevel,
			itemDetailsById,
			overrides,
			store.completedQuests,
			store.questTraderLoyaltyLevels,
			pricingPlayerLevel,
			store.stationLevels,
		],
	);
	const { barterEvaluationsById, craftEvaluationsById } = useMemo(() => {
		if (!itemUsage || !recipeCalculator) {
			return { barterEvaluationsById: {}, craftEvaluationsById: {} };
		}
		return {
			barterEvaluationsById: Object.fromEntries(
				recipeCalculator.evaluateBarters(itemUsage.barters).map((evaluation) => [evaluation.id, evaluation]),
			),
			craftEvaluationsById: Object.fromEntries(
				recipeCalculator.evaluateCrafts(itemUsage.crafts).map((evaluation) => [evaluation.id, evaluation]),
			),
		};
	}, [itemUsage, recipeCalculator]);
	const { traderOffers, crafts, usedInBarters, usedInCrafts } = useMemo(() => {
		const questAvailabilityQuests = itemRelations?.questAvailabilityQuests ?? [];
		const traders = new Map(questAvailabilityQuests.map((quest) => [quest.trader.id, quest.trader]));
		const quests = new Map(questAvailabilityQuests.map((quest) => [quest.id, quest]));
		const toBarterOffer = (barter: BarterRecord): ItemBarterOffer => {
			const trader = itemUsage?.tradersById?.[barter.traderId] ?? traders.get(barter.traderId);
			const unlock = barter.taskUnlockId
				? (itemUsage?.taskUnlocksById?.[barter.taskUnlockId] ?? quests.get(barter.taskUnlockId))
				: null;
			return {
				id: barter.id,
				kind: "barter" as const,
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
		};
		const traderOffers: ItemTraderOffer[] = (itemUsage?.barters ?? []).map(toBarterOffer);
		const selectedItemPurchaseOffers: ItemTraderOffer[] = (purchaseOffers ?? []).map((offer, index) => {
			const trader = itemUsage?.tradersById?.[offer.traderId] ?? traders.get(offer.traderId);
			const unlock = offer.taskUnlockId
				? (itemUsage?.taskUnlocksById?.[offer.taskUnlockId] ?? quests.get(offer.taskUnlockId))
				: null;
			return {
				id: `buy-${selectedItemId}-${offer.traderId}-${index}`,
				kind: "buy" as const,
				trader: trader ?? {
					id: offer.traderId,
					name: "Unknown trader",
					normalizedName: offer.traderId,
				},
				minTraderLevel: offer.minTraderLevel,
				taskUnlock: offer.taskUnlockId
					? {
							id: offer.taskUnlockId,
							name: unlock?.name ?? "Quest unlock",
							wikiLink: unlock?.wikiLink,
						}
					: null,
				offeredCount: 1,
				buyLimit: offer.buyLimit,
				price: offer.price,
				priceRUB: offer.priceRUB,
				currency: offer.currency,
				requiredItems: [],
			};
		});
		traderOffers.push(...selectedItemPurchaseOffers);
		const toCraftRecipe = (craft: CraftRecord): ItemCraftRecipe => {
			const station = itemUsage?.stationsById?.[craft.stationId];
			const unlock = craft.taskUnlockId
				? (itemUsage?.taskUnlocksById?.[craft.taskUnlockId] ?? quests.get(craft.taskUnlockId))
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
				duration: craftingDuration(craft, craftingSkillLevel),
				taskUnlock: craft.taskUnlockId
					? { id: craft.taskUnlockId, name: unlock?.name ?? "Quest unlock", wikiLink: unlock?.wikiLink }
					: null,
				requiredItems: craftRequiredItems(craft, hideoutManagementSkillLevel).map(toAmount),
				requiredQuestItems: craft.requiredQuestItems.map(toAmount),
				gameEditions: craft.gameEditions,
				productCount: craft.productCount,
			};
		};
		const crafts: ItemCraftRecipe[] = (itemUsage?.crafts ?? []).filter(isTrackedCraft).map(toCraftRecipe);
		const recipeOutput = (itemId: string): ItemSummary =>
			itemDetailsById[itemId] ?? { id: itemId, name: "Unknown item", normalizedName: itemId };
		const usedInBarters: ItemBarterOffer[] = (itemUsage?.usedInBarters ?? []).map((barter) => ({
			...toBarterOffer(barter),
			outputItem: recipeOutput(barter.offeredItemId),
		}));
		const usedInCrafts: ItemCraftRecipe[] = (itemUsage?.usedInCrafts ?? []).filter(isTrackedCraft).map((craft) => ({
			...toCraftRecipe(craft),
			outputItem: recipeOutput(craft.productItemId),
		}));
		return { traderOffers, crafts, usedInBarters, usedInCrafts };
	}, [
		itemRelations,
		itemUsage,
		purchaseOffers,
		selectedItemId,
		itemDetailsById,
		craftingSkillLevel,
		hideoutManagementSkillLevel,
	]);
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
		(marketPrice?.price != null || marketPrice?.avg24hPrice != null || marketPrice?.lastLowPrice != null);
	const showSidebar = showInventory || showMarket;
	const debugData = {
		item: selectedItem,
		inventory: { owned, needsBreakdown, demandSummary },
		hideout: { stationRequirements },
		quests: {
			relationsLoading: requests.relationsLoading,
			relationErrors: requests.relationErrors,
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
			usedInBarters,
			usedInCrafts,
			tree: acquisitionTree,
			profitLoading: requests.treeLoading,
			profitError: requests.treeError,
		},
	};

	return {
		overrides,
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
		usedInBarters,
		usedInCrafts,
		barterEvaluationsById,
		craftEvaluationsById,
		usagePresentationError,
		isFiat,
		showMarket,
		showPriceHistory,
		showSidebar,
		debugData,
		isDevelopment: isDev,
		profileReady,
		stationLevels: store.stationLevels,
		hiddenStations: store.hiddenStations,
		completedQuests: store.completedQuests,
		traderLoyaltyLevels: store.questTraderLoyaltyLevels,
		playerLevel: store.playerLevel,
		gameEdition: store.gameEdition,
		tarkovMode,
		addItemCounts: store.addItemCounts,
		relationsLoading: requests.relationsLoading,
		relationErrors: requests.relationErrors,
		retryRelations: requests.retryRelations,
		activeTab,
		setActiveTab: (tab: UsageTab) => {
			if (tab !== activeTab) {
				setTabSelection({
					scope: tabScope,
					tab,
					recipesOpened: loadRecipes || tab === "traders" || tab === "crafting",
				});
			}
		},
		usageLoaded: itemUsage !== null,
		initialDetailLoading: requests.relationsLoading,
		usageLoading: requests.usageLoading,
		usageError: requests.usageError,
		retryUsage: requests.retryUsage,
		barterError: itemUsage?.bartersError ?? requests.usageError,
		craftError: itemUsage?.craftsError ?? requests.usageError,
		profitLoading: requests.treeLoading || pricesLoading,
		profitError: requests.treeError ?? priceError,
		priceError,
		retryProfit: requests.retryTree,
	};
}

/**
 * Dialog data adapter. The global dialog owns navigation even while this UI loads.
 */
export function useItemDetailModalController({ item, isOpen, onClose, previousEntry, onBack }: ItemDetailModalProps) {
	const [debugItemId, setDebugItemId] = useState<string | null>(null);
	const openedItems = useUIStore((state) => state.itemDetailKnownItems);
	const knownItems = useMemo(() => [...Object.values(openedItems), ...(item ? [item] : [])], [item, openedItems]);
	const details = useItemDetailsController({ activeItemId: item?.id ?? "", knownItems, enabled: isOpen });
	return {
		...details,
		showDebug: debugItemId === details.selectedItemId,
		previousEntry,
		close: onClose,
		back: onBack,
		toggleDebug() {
			setDebugItemId((current) => (current === details.selectedItemId ? null : details.selectedItemId));
		},
	};
}
