import type { DataDiagnostics, TarkovDataMode } from "./common";
import type { Station, GlobalSkill, ItemRequirement } from "./hideout";
import type { ItemIdentity, ItemSummary } from "./items";
import type { PriceHistoryPoint } from "./prices";
import type { FullQuest } from "./quests";
import type { BarterRecord, CraftRecord } from "./recipes";
import type { Trader } from "./traders";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry, QuestRewardIndexEntry } from "@/lib/quests/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/quests/quest-availability";

export interface SkillsPayload {
	skills: GlobalSkill[];
}

export interface BartersPayload {
	bartersByItemId: Record<string, BarterRecord[]>;
}

export interface CraftsPayload {
	craftsByItemId: Record<string, CraftRecord[]>;
}

export interface ItemUsageData {
	barters: BarterRecord[];
	crafts: CraftRecord[];
	/** Recipes that consume the item (including as a tool or quest item). */
	usedInBarters: BarterRecord[];
	usedInCrafts: CraftRecord[];
	items: ItemSummary[];
	itemIds: string[];
	unresolvedItemIds: string[];
	tradersById: Record<string, Trader>;
	taskUnlocksById: Record<string, { id: string; name: string; wikiLink?: string | null }>;
	stationsById: Record<string, { id: string; name: string; normalizedName: string; imageLink?: string }>;
	freshness: {
		bartersUpdatedAt: number | null;
		craftsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
		tradersUpdatedAt: number | null;
		taskUnlocksUpdatedAt: number | null;
		stationsUpdatedAt: number | null;
	};
	bartersError?: string;
	craftsError?: string;
	presentationError?: string;
	itemsError?: string;
	pricesError?: string;
}

export interface ItemAcquisitionTreeData {
	rootItemId: string;
	barters: BarterRecord[];
	crafts: CraftRecord[];
	itemIds: string[];
	truncated: boolean;
	items: ItemSummary[];
	unresolvedItemIds: string[];
	freshness: {
		bartersUpdatedAt: number | null;
		craftsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
	};
	errors: {
		barters: string | null;
		crafts: string | null;
		items: string | null;
		prices: string | null;
	};
	/** Read-time labels for the graph's traders, stations, and unlock quests (recipe breakdowns). */
	tradersById?: ItemUsageData["tradersById"];
	stationsById?: ItemUsageData["stationsById"];
	taskUnlocksById?: ItemUsageData["taskUnlocksById"];
	/** Labels failed to load; recipe and price data remain usable. */
	presentationError?: string;
}

export interface ItemHideoutRequirementRelation {
	station: {
		id: string;
		name: string;
		normalizedName: string;
		imageLink?: string;
	};
	stationMaxLevel: number;
	level: number;
	requirement: ItemRequirement;
}

export interface ItemRelationsPayload {
	item: ItemSummary | null;
	relatedItems: ItemSummary[];
	unresolvedItemIds: string[];
	hideoutRequirements: ItemHideoutRequirementRelation[];
	questItemIndex: QuestItemIndexEntry[];
	questRewardIndex: QuestRewardIndexEntry[];
	questAnyOfGroups: QuestAnyOfGroupEntry[];
	questAvailabilityQuests: QuestAvailabilityQuest[];
	freshness: {
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
		stationsUpdatedAt: number | null;
		questsUpdatedAt: number | null;
	};
	errors: {
		items: string | null;
		prices: string | null;
		stations: string | null;
		quests: string | null;
	};
}

export interface ItemPriceHistoryPayload {
	data: PriceHistoryPoint[];
	fetchedAt: number;
}

/** One item's latest market-analyzer observation; see market-analyzer/README.md for each field. */
export interface ItemMarketAnalytics {
	itemId: string;
	calculatedAt: number;
	/** Latest upstream observation the analysis covered. */
	sourceUpdatedAt: number;
	confidence: "high" | "medium" | "low";
	confidenceReasons: string[];
	marketValue: number | null;
	currentLevel: number | null;
	livePriceMin: number | null;
	liveOfferCount: number | null;
	median24h: number | null;
	median7d: number | null;
	median30d: number | null;
	rangeLow7d: number | null;
	rangeHigh7d: number | null;
	/** Fractions (0.1 = +10%). */
	change6h: number | null;
	change24h: number | null;
	change7d: number | null;
	change24hRub: number | null;
	change7dRub: number | null;
	move12h: number | null;
	/** Share of the last 30 days spent below the market value (0–1). */
	percentile30d: number | null;
	volatility7d: number | null;
	trend: "rising" | "falling" | "stable" | "unknown";
	persistenceHours: number | null;
	depthMedian24h: number | null;
	coverage: { day: number; week: number; month: number };
	shock: {
		phase: "holding" | "retracing" | "settled" | "reverted";
		baseline: number | null;
		extreme: number | null;
		at: number | null;
		retracement: number | null;
	} | null;
	basePrice: number | null;
	traderValue: number | null;
	traderId: string | null;
	fleaFee: number | null;
	fleaNet: number | null;
	traderBreakEven: number | null;
	practicalBreakEven: number | null;
	maxNetPrice: number | null;
	maxNet: number | null;
}

export interface ItemMarketAnalyticsPayload {
	data: ItemMarketAnalytics;
}

/** One flea-sellable item's latest observation, trimmed to the fields the market page shows. */
export type MarketOverviewItem = Pick<
	ItemMarketAnalytics,
	| "calculatedAt"
	| "confidence"
	| "trend"
	| "marketValue"
	| "currentLevel"
	| "liveOfferCount"
	| "median7d"
	| "median30d"
	| "rangeLow7d"
	| "rangeHigh7d"
	| "change24h"
	| "change7d"
	| "change24hRub"
	| "change7dRub"
	| "move12h"
	| "percentile30d"
	| "volatility7d"
	| "depthMedian24h"
	| "traderValue"
	| "traderId"
	| "fleaFee"
	| "fleaNet"
> & {
	id: string;
	name: string;
	shortName: string | null;
	category: string | null;
	shock: {
		phase: "holding" | "retracing" | "settled" | "reverted";
		baseline: number | null;
		extreme: number | null;
		retracement: number | null;
	} | null; /** Recent minimum-listing flea prices (about a day, roughly evenly spaced), oldest first; null with fewer than two. */
	sparkline: { from: number; to: number; prices: number[] } | null;
};

export interface MarketPageData {
	mode: TarkovDataMode;
	latestRun: { startedAt: number; completedAt: number; status: string } | null;
	/** Flea-sellable items with at least one analyzer observation in this mode. */
	items: MarketOverviewItem[];
	/** Malformed or out-of-range observation rows left out of `items`. */
	invalidCount: number;
	/** Set when the analytics tables are missing; items is then empty. */
	error: string | null;
}

/**
 * One Higher or Lower card: a confident flea 7-day median, else the cheapest rouble trader price; presets without
 * either are estimated from their parts.
 */
export interface HigherLowerItem {
	id: string;
	name: string;
	value: number;
	source: "flea" | "trader" | "parts";
	/** Only when the 512px image does not follow the standard pattern; read through itemImageUrl. */
	image512pxLink?: string;
}

export interface HigherLowerPageData {
	mode: TarkovDataMode;
	items: HigherLowerItem[];
	/** Set when the analytics tables or catalog preset columns are missing; items is then empty. */
	error: string | null;
}

export interface TraderAlibiItemCount {
	itemId: string;
	count: number;
}

/** Clues for Trader Alibi; item names and images come from the search manifest. */
export interface TraderAlibiPageData {
	mode: TarkovDataMode;
	/**
	 * Single objectives of each trader's quests (removed quests excluded), without quest names. Trader names
	 * in the text are replaced. Single-item hand-ins carry the item so the client can show it.
	 */
	objectives: Array<{
		traderId: string;
		type: string;
		text: string;
		count: number;
		itemId?: string;
		foundInRaid?: boolean;
		/** Maps the text does not already name. */
		maps: string[];
	}>;
	barters: Array<{
		traderId: string;
		level: number;
		output: TraderAlibiItemCount;
		inputs: TraderAlibiItemCount[];
	}>;
	/** Items a trader sells for cash, at the loyalty level that unlocks them. */
	offers: Array<{ traderId: string; itemId: string; level: number }>;
}

export interface HideoutStationsPayload {
	stations: Station[];
}

export interface ItemsPayload {
	items: ItemSummary[];
}

export const ITEM_SEARCH_MAX_QUERY_LENGTH = 80;
export const ITEM_SEARCH_QUICK_RESULT_LIMIT = 10;
export const ITEM_SEARCH_PAGE_RESULT_LIMIT = 50;

export interface ItemSearchPayload {
	items: ItemSummary[];
}

export interface DataStatusDomain {
	available: boolean;
	updatedAt: number | null;
	diagnostics: DataDiagnostics | null;
	error: string | null;
}

export interface DataStatusPayload {
	mode: TarkovDataMode;
	releaseId: string;
	stations: DataStatusDomain;
	items: DataStatusDomain;
	quests: DataStatusDomain;
	crafts: DataStatusDomain;
	barters: DataStatusDomain;
	prices: {
		changedAt: number | null;
		checkedAt: number | null;
		error: string | null;
	};
}

export interface LegacyConversionStation {
	id: string;
	name: string;
	maxLevel: number;
}

export interface LegacyProfileConversionData {
	stations: LegacyConversionStation[];
	freshness: { stationsUpdatedAt: number | null };
	errors: { stations: string | null };
}

export interface KappaCollectorPresentation {
	id: string;
	name: string;
	traderImageLink?: string | null;
	traderImage4xLink?: string | null;
}

export interface KappaChecklistPageData {
	collectorQuest: KappaCollectorPresentation | null;
	items: ItemSummary[];
	unresolvedItemIds: string[];
	freshness: {
		questsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
	};
	errors: {
		quests: string | null;
		items: string | null;
		prices: string | null;
	};
}

export interface CompletedItemsConversionStation {
	id: string;
	levels: Array<{
		level: number;
		itemRequirements: Array<{
			id: string;
			itemId: string;
			count: number;
			isFir: boolean;
		}>;
	}>;
}

export interface CompletedItemsConversionData {
	stations: CompletedItemsConversionStation[];
	items: ItemIdentity[];
	unresolvedItemIds: string[];
	freshness: {
		stationsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
	};
	errors: {
		stations: string | null;
		items: string | null;
	};
}

export interface TradersPayload {
	traders: Trader[];
}

export interface FullQuestsPayload {
	quests: FullQuest[];
}

export interface HideoutPageData {
	stations: Station[] | null;
	items: ItemSummary[] | null;
	itemIds: string[];
	unresolvedItemIds: string[];
	freshness: {
		stationsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
	};
	errors: {
		stations: string | null;
		items: string | null;
		prices: string | null;
	};
}

export interface ItemChecklistPageData {
	stations: Station[] | null;
	items: ItemSummary[] | null;
	itemIds: string[];
	unresolvedItemIds: string[];
	questItemIndex: QuestItemIndexEntry[];
	questAnyOfGroups: QuestAnyOfGroupEntry[];
	questAvailabilityQuests: QuestAvailabilityQuest[];
	freshness: {
		stationsUpdatedAt: number | null;
		questsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
	};
	errors: {
		stations: string | null;
		quests: string | null;
		items: string | null;
		prices: string | null;
	};
}

export interface QuestWorkspacePageData {
	quests: FullQuest[] | null;
	items: ItemSummary[] | null;
	itemIds: string[];
	unresolvedItemIds: string[];
	freshness: {
		questsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
	};
	errors: {
		quests: string | null;
		items: string | null;
		prices: string | null;
	};
}

export interface ProfitPageData {
	barters: BarterRecord[];
	crafts: CraftRecord[];
	items: ItemSummary[] | null;
	itemIds: string[];
	unresolvedItemIds: string[];
	traders: Trader[];
	stations: Array<Pick<Station, "id" | "name" | "normalizedName" | "imageLink">>;
	taskUnlocksById: ItemUsageData["taskUnlocksById"];
	unresolvedTaskUnlockIds: string[];
	freshness: {
		bartersUpdatedAt: number | null;
		craftsUpdatedAt: number | null;
		itemsUpdatedAt: number | null;
		pricesUpdatedAt: number | null;
		tradersUpdatedAt: number | null;
		stationsUpdatedAt: number | null;
		taskUnlocksUpdatedAt: number | null;
	};
	errors: {
		barters: string | null;
		crafts: string | null;
		items: string | null;
		prices: string | null;
		traders: string | null;
		stations: string | null;
		taskUnlocks: string | null;
	};
}

/** `/items/[itemId]` route payload: one standard item summary, unpriced. */
export interface ItemDetailPageData {
	/** `null` with `error: null` means the ID is not a standard item in this mode. */
	item: ItemSummary | null;
	error: string | null;
}
