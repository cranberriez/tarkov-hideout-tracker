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
    price?: number | null;
    avg24hPrice?: number | null;
    high24hPrice?: number | null;
    low24hPrice?: number | null;
    lastLowPrice?: number | null;
    lastOfferCount?: number | null;
    changeLast48hPercent?: number | null;
    diff24h?: number | null;
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

export interface QuestFailConditionBase {
    id: string;
    type: string;
    description: string;
    optional?: boolean | null;
}

export interface QuestFailConditionTaskStatus extends QuestFailConditionBase {
    type: "taskStatus";
    status: string[];
    task: { id: string };
}

export type QuestFailCondition = QuestFailConditionTaskStatus | QuestFailConditionBase;

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
    failConditions?: QuestFailCondition[];
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

export type QuestItemObjectiveScope = "specific" | "anyOf" | "broadAny";

export interface QuestObjectiveBase {
    id: string;
    type: string;
    description: string;
    optional: boolean;
    count?: number;
    maps?: QuestMap[];
}

export interface QuestObjectiveItemType extends QuestObjectiveBase {
    type: "giveItem" | "findItem";
    count: number;
    foundInRaid: boolean;
    items: QuestItem[];
    itemScope?: QuestItemObjectiveScope;
    isPartial?: boolean;
    totalItemCount?: number;
}

export interface QuestObjectiveShootType extends QuestObjectiveBase {
    type: "shoot";
    count: number;
    target: string;
    targetNames?: string[];
    shotType?: string;
    zoneNames?: string[];
    bodyParts: string[];
}

export interface QuestObjectiveExtractType extends QuestObjectiveBase {
    type: "extract";
    exitName: string | null;
    exitStatus?: string[];
    zoneNames?: string[];
    requiredKeys?: QuestItem[][];
}

export interface QuestObjectiveBuildItemType extends QuestObjectiveBase {
    type: "buildItem";
    item: QuestItem;
    containsAll: QuestItem[];
    containsCategory: Array<{ id: string; name: string; normalizedName: string }>;
    attributes: Array<{ name: string; requirement: { compareMethod: string; value: number } }>;
}

export interface QuestObjectiveHideoutStationType extends QuestObjectiveBase {
    type: "hideoutStation";
    hideoutStation: { id: string; name: string; normalizedName: string };
    stationLevel?: number | null;
}

export interface QuestObjectiveQuestItemType extends QuestObjectiveBase {
    type: "pickupQuestItem" | "findQuestItem";
    questItem: QuestItem;
    count: number;
}

export interface QuestObjectiveTaskStatusType extends QuestObjectiveBase {
    type: "taskStatus";
    task: { id: string; name: string };
    status: string[];
}

export interface QuestObjectiveTraderLevelType extends QuestObjectiveBase {
    type: "traderLevel";
    trader: { id: string; name: string; normalizedName: string };
    level: number;
}

export interface QuestObjectiveTraderStandingType extends QuestObjectiveBase {
    type: "traderStanding";
    trader: { id: string; name: string; normalizedName: string };
    compareMethod: string;
    value: number;
}

export interface QuestObjectivePlayerLevelType extends QuestObjectiveBase {
    type: "playerLevel";
    playerLevel: number;
}

export interface QuestObjectiveUseItemType extends QuestObjectiveBase {
    type: "useItem";
    useAny: QuestItem[];
    compareMethod: string;
    count: number;
    zoneNames: string[];
}

export type FullQuestObjective =
    | QuestObjectiveItemType
    | QuestObjectiveShootType
    | QuestObjectiveExtractType
    | QuestObjectiveBuildItemType
    | QuestObjectiveHideoutStationType
    | QuestObjectiveQuestItemType
    | QuestObjectiveTaskStatusType
    | QuestObjectiveTraderLevelType
    | QuestObjectiveTraderStandingType
    | QuestObjectivePlayerLevelType
    | QuestObjectiveUseItemType
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
    failConditions?: QuestFailCondition[];
    traderRequirements: QuestTraderRequirement[];
    requiredPrestige?: QuestPrestige | null;
    objectives: FullQuestObjective[];
}

export interface FullQuestsPayload {
    quests: FullQuest[];
}
