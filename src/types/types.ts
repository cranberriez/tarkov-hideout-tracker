// Shared types for Hideout Tracker API and client state

export interface RequirementAttribute {
    type: string;
    name: string;
    value: string;
}

export interface HideoutItem {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
}

export interface ItemRequirement {
    id: string;
    item: HideoutItem;
    count?: number;
    quantity?: number;
    attributes: RequirementAttribute[];
}

export interface StationLevelRequirement {
    station: {
        normalizedName: string;
    };
    level: number;
}

export interface SkillRequirement {
    name: string;
    skill: {
        name: string;
        imageLink?: string;
    };
    level: number;
}

export interface TraderRequirement {
    trader: {
        name: string;
        normalizedName: string;
        imageLink?: string;
    };
    value: number;
}

export interface StationLevel {
    id: string;
    level: number;
    constructionTime: number;
    itemRequirements: ItemRequirement[];
    stationLevelRequirements: StationLevelRequirement[];
    skillRequirements: SkillRequirement[];
    traderRequirements: TraderRequirement[];
}

export interface Station {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
    levels: StationLevel[];
}

export interface HideoutStationsPayload {
    stations: Station[];
}

export interface ItemPrice {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
    avg24hPrice?: number;
    basePrice?: number;
    lastLowPrice?: number;
}

export interface ItemsPricesPayload {
    // itemId -> price info
    [itemId: string]: ItemPrice;
}

export interface TimedResponse<TPayload> {
    data: TPayload;
    updatedAt: number; // ms since epoch
}

export interface VendorPrice {
    vendor: {
        name: string;
        normalizedName: string;
    };
    currency: string;
    price: number;
    priceRUB: number;
}

export interface ItemDetails {
    id: string;
    name: string;
    normalizedName: string;
    iconLink?: string;
    gridImageLink?: string;
    link?: string;
    wikiLink?: string;
    category?: {
        name: string;
        normalizedName: string;
    };
}

export interface MarketPrice {
    price?: number;
    avg24hPrice?: number;
    avg7daysPrice?: number;
    updated?: string;
    link?: string;
    diff24h?: number;
    traderName?: string;
    traderPrice?: number;
    traderPriceCur?: string;
}

export interface ItemsPayload {
    items: ItemDetails[];
}

// ---- Quests ----

export interface QuestItem {
    id: string;
    name: string;
    normalizedName: string;
    iconLink?: string;
    gridImageLink?: string;
}

export interface QuestObjectiveItem {
    id: string;
    type: "giveItem";
    description: string;
    optional: boolean;
    count: number;
    foundInRaid: boolean;
    items: QuestItem[];
}

export interface QuestPrerequisite {
    task: { id: string; name: string };
    status: string[];
}

export interface Quest {
    id: string;
    name: string;
    normalizedName: string;
    wikiLink?: string | null;
    minPlayerLevel?: number | null;
    kappaRequired?: boolean | null;
    lightkeeperRequired?: boolean | null;
    factionName?: string | null;
    experience: number;
    trader: {
        id: string;
        name: string;
        normalizedName: string;
    };
    taskRequirements: QuestPrerequisite[];
    objectives: QuestObjectiveItem[];
}

export interface QuestsPayload {
    quests: Quest[];
}

// ---- Traders ----

export interface Trader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
    image4xLink?: string;
}

export interface TradersPayload {
    traders: Trader[];
}

// ---- Full Quest Types (all objective types, used by quests page) ----

export interface QuestMap {
    id: string;
    name: string;
    normalizedName: string;
}

export interface QuestObjectiveBase {
    id: string;
    type: string;
    description: string;
    optional: boolean;
    count?: number;
}

export interface QuestObjectiveItemType extends QuestObjectiveBase {
    type: "giveItem" | "findItem";
    count: number;
    foundInRaid: boolean;
    items: QuestItem[];
}

export interface QuestObjectiveShootType extends QuestObjectiveBase {
    type: "shoot";
    count: number;
    target: string;
    bodyParts: string[];
}

export interface QuestObjectiveExtractType extends QuestObjectiveBase {
    type: "extract";
    exitName: string | null;
}

export type FullQuestObjective =
    | QuestObjectiveItemType
    | QuestObjectiveShootType
    | QuestObjectiveExtractType
    | QuestObjectiveBase;

export interface QuestTraderRequirement {
    id: string;
    trader: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string | null;
        image4xLink?: string | null;
    };
    requirementType: string;
    compareMethod: string;
    value: number;
}

export interface QuestPrestige {
    id: string;
    name: string;
    prestigeLevel: number;
    imageLink?: string | null;
    iconLink?: string | null;
}

export interface FullQuest {
    id: string;
    name: string;
    normalizedName: string;
    wikiLink?: string | null;
    minPlayerLevel?: number | null;
    kappaRequired?: boolean | null;
    lightkeeperRequired?: boolean | null;
    factionName?: string | null;
    experience: number;
    map?: QuestMap | null;
    trader: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string | null;
        image4xLink?: string | null;
    };
    taskRequirements: QuestPrerequisite[];
    traderRequirements: QuestTraderRequirement[];
    requiredPrestige?: QuestPrestige | null;
    objectives: FullQuestObjective[];
}

export interface FullQuestsPayload {
    quests: FullQuest[];
}
