// Shared types for Hideout Tracker API and client state

export interface RequirementAttribute {
    type: string;
    name: string;
    value: string;
}

export interface ItemCategory {
    id?: string;
    name: string;
    normalizedName: string;
}

export interface VendorPrice {
    vendor: {
        name: string;
        normalizedName: string;
        imageLink?: string | null;
    };
    currency?: string;
    price?: number;
    priceRUB: number;
}

export interface MarketPrice {
    price?: number | null;
    avg24hPrice?: number | null;
    high24hPrice?: number | null;
    low24hPrice?: number | null;
    lastLowPrice?: number | null;
    lastOfferCount?: number | null;
    changeLast48h?: number | null;
    changeLast48hPercent?: number | null;
    diff24h?: number | null;
    updatedAt?: number | null;
    sellFor?: VendorPrice[];
}

export interface GlobalItemVendorPrice {
    vendor: {
        id?: string;
        name: string;
        normalizedName: string;
        imageLink?: string | null;
    };
    priceRUB: number;
}

export interface GlobalItemMarketPrice {
    avg24hPrice?: number | null;
    high24hPrice?: number | null;
    low24hPrice?: number | null;
    lastLowPrice?: number | null;
    lastOfferCount?: number | null;
    changeLast48hPercent?: number | null;
    updatedAt?: number | null;
    sellFor?: GlobalItemVendorPrice[];
}

/** A standard item from the mode-specific Tarkov JSON `/items` catalog. */
export interface GlobalItem {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
    image512pxLink?: string;
    baseImageLink?: string;
    link?: string;
    wikiLink?: string;
    minLevelForFlea?: number | null;
    category?: ItemCategory;
    marketPrice?: GlobalItemMarketPrice;
}

export interface GlobalSkill {
    id: string;
    name: string;
    imageLink?: string;
}

export interface SkillsPayload {
    skills: GlobalSkill[];
}

export interface ItemAmountRef {
    itemId: string;
    count: number;
    isTool?: boolean;
}

export interface BarterRecord {
    id: string;
    offeredItemId: string;
    offeredCount: number;
    traderId: string;
    minTraderLevel: number;
    taskUnlockId?: string;
    requiredItems: ItemAmountRef[];
    buyLimit?: number | null;
}

export interface CraftRecord {
    id: string;
    productItemId: string;
    productCount: number;
    stationId: string;
    level: number;
    duration: number;
    taskUnlockId?: string;
    requiredItems: ItemAmountRef[];
    requiredQuestItems: ItemAmountRef[];
    gameEditions: string[];
}

export interface BartersPayload {
    bartersByItemId: Record<string, BarterRecord[]>;
}

export interface CraftsPayload {
    craftsByItemId: Record<string, CraftRecord[]>;
}

export interface ItemUsagePayload {
    barters: BarterRecord[];
    crafts: CraftRecord[];
    tradersById?: Record<string, Trader>;
    taskUnlocksById?: Record<
        string,
        { id: string; name: string; wikiLink?: string | null }
    >;
    bartersError?: string;
    craftsError?: string;
    presentationError?: string;
}

export interface ItemAmount {
    item: {
        id: string;
        name: string;
        normalizedName: string;
        iconLink?: string;
        gridImageLink?: string;
    };
    count: number;
    isTool?: boolean;
}

export interface ItemUnlockQuest {
    id: string;
    name: string;
    wikiLink?: string | null;
}

export interface ItemTraderOffer {
    id: string;
    trader: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string | null;
    };
    minTraderLevel: number;
    taskUnlock?: ItemUnlockQuest | null;
    requiredItems: ItemAmount[];
    offeredCount: number;
    buyLimit?: number | null;
}

export interface ItemCraftRecipe {
    id: string;
    station: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string;
    };
    level: number;
    duration: number;
    taskUnlock?: ItemUnlockQuest | null;
    requiredItems: ItemAmount[];
    requiredQuestItems: ItemAmount[];
    gameEditions: string[];
    productCount: number;
}

export interface ItemDetails {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    description?: string;
    updated?: string;
    width?: number;
    height?: number;
    weight?: number;
    types?: string[];
    iconLink?: string;
    gridImageLink?: string;
    baseImageLink?: string;
    inspectImageLink?: string;
    image512pxLink?: string;
    image8xLink?: string;
    link?: string;
    wikiLink?: string;
    basePrice?: number | null;
    minLevelForFlea?: number | null;
    category?: ItemCategory;
    marketPrice?: MarketPrice | null;
    traderOffers?: ItemTraderOffer[];
    crafts?: ItemCraftRecipe[];
}

export type HideoutItem = ItemDetails;

export interface ItemRequirement {
    id: string;
    itemId: string;
    count: number;
    isFir: boolean;
    isTool: boolean;
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

export interface TimedResponse<TPayload> {
    data: TPayload;
    updatedAt: number; // ms since epoch
    diagnostics?: DataResponseDiagnostics;
}

export interface DataResponseDiagnostics {
    provider: "json" | "graphql";
    localePaths?: string[];
    usedRegularLocaleFallback?: boolean;
    upstreamStatus?: "ok" | "stale-fallback";
}

export interface ItemsPayload {
    items: GlobalItem[];
}

// ---- Quests ----

export interface QuestItem {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
}

/** Compact presentation owned by the task dataset, never an inventory item. */
export interface QuestSpecificItem extends QuestItem {
    source: "questSpecific";
}

export interface QuestObjectiveItem {
    id: string;
    type: "giveItem";
    description: string;
    optional: boolean;
    count: number;
    foundInRaid: boolean;
    itemIds: string[];
    questSpecificItems?: QuestSpecificItem[];
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

export interface MapPoint3D {
    x: number;
    y: number;
    z: number;
}

export interface QuestMapLocation {
    map: QuestMap;
    position?: MapPoint3D;
    outline: MapPoint3D[];
    top?: number;
    bottom?: number;
    source: "zone" | "possibleLocation";
}

export type QuestItemObjectiveScope = "specific" | "anyOf" | "broadAny";

export interface QuestObjectiveBase {
    id: string;
    type: string;
    description: string;
    optional: boolean;
    count?: number;
    maps?: QuestMap[];
    requiredKeyIds?: string[][];
    locations?: QuestMapLocation[];
}

export interface QuestObjectiveItemType extends QuestObjectiveBase {
    type: "giveItem" | "findItem" | "plantItem";
    count: number;
    foundInRaid: boolean;
    itemIds: string[];
    questSpecificItems?: QuestSpecificItem[];
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
}

export interface QuestObjectiveBuildItemType extends QuestObjectiveBase {
    type: "buildItem";
    itemId: string;
    containsAllItemIds: string[];
    containsCategoryIds: string[];
    attributes: Array<{ name: string; requirement: { compareMethod: string; value: number } }>;
}

export interface QuestObjectiveHideoutStationType extends QuestObjectiveBase {
    type: "hideoutStation";
    hideoutStation: { id: string; name: string; normalizedName: string };
    stationLevel?: number | null;
}

export interface QuestObjectiveQuestItemType extends QuestObjectiveBase {
    type: "pickupQuestItem" | "findQuestItem";
    questItem: QuestSpecificItem;
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
    useAnyItemIds: string[];
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

/**
 * Progression gates that are not represented by task or trader requirements.
 *
 * The JSON provider can add new gate kinds without a corresponding client
 * behavior yet. Keep the known discriminator fields typed while retaining all
 * upstream properties so a newer gate is not silently discarded.
 */
export interface QuestOtherRequirement {
    id?: string | null;
    type: string;
    requirementType?: string | null;
    variableId?: string | null;
    compareMethod?: string | null;
    value?: number | string | boolean | null;
    [key: string]: unknown;
}

export interface QuestPrestige {
    id: string;
    name: string;
    prestigeLevel: number;
    imageLink?: string | null;
    iconLink?: string | null;
}

export interface QuestTraderStandingReward {
    trader: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string | null;
        image4xLink?: string | null;
    };
    standing: number;
}

export interface QuestItemReward {
    itemId: string;
    count: number;
}

export interface FullQuest {
    id: string;
    name: string;
    normalizedName: string;
    removed?: boolean;
    taskImageLink?: string | null;
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
    otherRequirements: QuestOtherRequirement[];
    requiredPrestige?: QuestPrestige | null;
    finishItemRewards?: QuestItemReward[];
    finishTraderStandingRewards?: QuestTraderStandingReward[];
    failureTraderStandingRewards?: QuestTraderStandingReward[];
    objectives: FullQuestObjective[];
}

export interface FullQuestsPayload {
    quests: FullQuest[];
}
