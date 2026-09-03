import type { DataDiagnostics } from "./common";
import type { Station, GlobalSkill, ItemRequirement } from "./hideout";
import type { ItemIdentity, ItemSummary } from "./items";
import type { PriceHistoryPoint } from "./prices";
import type { FullQuest } from "./quests";
import type { BarterRecord, CraftRecord } from "./recipes";
import type { Trader } from "./traders";
import type {
    QuestAnyOfGroupEntry,
    QuestItemIndexEntry,
    QuestRewardIndexEntry,
} from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

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
    items: ItemSummary[];
    itemIds: string[];
    unresolvedItemIds: string[];
    tradersById: Record<string, Trader>;
    taskUnlocksById: Record<
        string,
        { id: string; name: string; wikiLink?: string | null }
    >;
    stationsById: Record<
        string,
        { id: string; name: string; normalizedName: string; imageLink?: string }
    >;
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
    stations: DataStatusDomain;
    items: DataStatusDomain;
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
    freshness: {
        bartersUpdatedAt: number | null;
        craftsUpdatedAt: number | null;
        itemsUpdatedAt: number | null;
        pricesUpdatedAt: number | null;
        tradersUpdatedAt: number | null;
        stationsUpdatedAt: number | null;
    };
    errors: {
        barters: string | null;
        crafts: string | null;
        items: string | null;
        prices: string | null;
        traders: string | null;
        stations: string | null;
    };
}
