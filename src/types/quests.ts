import type { MapPoint3D } from "./maps";

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

export interface QuestMap {
    id: string;
    name: string;
    normalizedName: string;
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
    attributes: Array<{
        name: string;
        requirement: { compareMethod: string; value: number };
    }>;
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
