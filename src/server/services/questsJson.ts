import { unstable_cache } from "next/cache";
import { cacheWhenEnabled, DATA_CACHE_REVALIDATE_SECONDS } from "@/server/cache";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { redis, writeRedisAfterResponse } from "@/server/redis";
import {
    fetchTarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import {
    mapQuestOtherRequirements,
    type RawQuestOtherRequirement,
} from "@/server/services/quest-requirements";
import {
    isProgressionCacheUsable,
    markStaleFallback,
    parseNonEmptyTimedResponse,
} from "@/server/services/tarkovJson/cache";
import { normalizeQuestObjectiveLocations } from "@/server/services/quest-objective-locations";
import type {
    FullQuest,
    FullQuestObjective,
    FullQuestsPayload,
    Quest,
    QuestFailCondition,
    QuestItem,
    QuestMap,
    QuestObjectiveItemType,
    QuestPrestige,
    QuestsPayload,
    QuestTraderStandingReward,
    TimedResponse,
} from "@/types";

function buildQuestRedisKeys(gameMode: TarkovJsonGameMode) {
    const questsBodyKey = `quests:all:v${CACHE_VERSIONS.quests}:${gameMode}`;
    const fullBodyKey = `quests:full:v${CACHE_VERSIONS.questsFull}:${gameMode}`;
    return {
        questsBodyKey,
        questsMetaKey: `${questsBodyKey}:meta`,
        fullBodyKey,
        fullMetaKey: `${fullBodyKey}:meta`,
    };
}

interface JsonItem {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
}

interface JsonItemCategory {
    id: string;
    name: string;
    normalizedName: string;
}

interface JsonTrader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string | null;
    image4xLink?: string | null;
}

interface JsonMap {
    id: string;
    name: string;
    normalizedName: string;
}

interface JsonRewardSet {
    traderStanding?: Array<{ trader: string; standing: number }>;
}

interface JsonTaskRequirement {
    task: string;
    status?: string[];
}

interface JsonTraderRequirement {
    id: string;
    trader: string;
    requirementType: string;
    compareMethod: string;
    value: number;
}

interface JsonObjective {
    id: string;
    type: string;
    description?: string;
    optional?: boolean;
    count?: number;
    maps?: string[];
    zones?: Array<{
        id?: string;
        name?: string;
        map?: string;
        position?: unknown;
        outline?: unknown;
        top?: unknown;
        bottom?: unknown;
    }>;
    possibleLocations?: Array<{ map?: string; positions?: unknown }>;
    requiredKeys?: string[] | string[][];
    items?: string[];
    foundInRaid?: boolean;
    target?: string;
    targetNames?: string[];
    shotType?: string;
    bodyParts?: string[];
    exitName?: string | null;
    exitStatus?: string[];
    item?: string;
    containsAll?: string[];
    containsCategory?: string[];
    buildAttributes?: Array<{
        name: string;
        requirement: { compareMethod: string; value: number };
    }>;
    hideoutStation?: string;
    station?: string;
    stationLevel?: number | null;
    questItem?: string;
    task?: string;
    status?: string[];
    trader?: string;
    level?: number;
    compareMethod?: string;
    value?: number;
    playerLevel?: number;
    useAny?: string[];
}

interface JsonFailCondition extends JsonObjective {
    task?: string;
}

interface JsonTask {
    id: string;
    name: string;
    normalizedName: string;
    taskImageLink?: string | null;
    wikiLink?: string | null;
    minPlayerLevel?: number | null;
    kappaRequired?: boolean | null;
    lightkeeperRequired?: boolean | null;
    factionName?: string | null;
    experience: number;
    map?: string | null;
    trader: string;
    taskRequirements?: JsonTaskRequirement[];
    traderRequirements?: JsonTraderRequirement[];
    otherRequirements?: RawQuestOtherRequirement[];
    failConditions?: JsonFailCondition[];
    requiredPrestige?: string | null;
    finishRewards?: JsonRewardSet;
    failureOutcome?: JsonRewardSet;
    objectives?: JsonObjective[];
}

interface JsonPrestige {
    id: string;
    name: string;
    prestigeLevel: number;
    imageLink?: string | null;
    iconLink?: string | null;
}

interface JsonTasksData {
    tasks: Record<string, JsonTask>;
    questItems?: Record<string, JsonItem>;
    prestige?: JsonPrestige[];
}

interface JsonItemsData {
    items: Record<string, JsonItem>;
    itemCategories?: Record<string, JsonItemCategory>;
}

interface JsonMapsData {
    maps: Record<string, JsonMap>;
}

interface MappingContext {
    tasks: Record<string, JsonTask>;
    items: Record<string, JsonItem>;
    questItems: Record<string, JsonItem>;
    categories: Record<string, JsonItemCategory>;
    traders: Record<string, JsonTrader>;
    maps: Record<string, JsonMap>;
    hideout: Record<string, { id: string; name: string; normalizedName: string }>;
    prestige: Record<string, JsonPrestige>;
    translateTask: (key: string | null | undefined) => string;
    translateItem: (key: string | null | undefined) => string;
    translateTrader: (key: string | null | undefined) => string;
    translateMap: (key: string | null | undefined) => string;
    translateHideout: (key: string | null | undefined) => string;
}

function toQuestItem(id: string, context: MappingContext): QuestItem | null {
    const item = context.items[id] ?? context.questItems[id];
    if (!item) return null;
    const translate = context.items[id] ? context.translateItem : context.translateTask;
    return {
        id: item.id,
        name: translate(item.name),
        normalizedName: item.normalizedName,
        shortName: item.shortName ? translate(item.shortName) : undefined,
        iconLink: item.iconLink,
        gridImageLink: item.gridImageLink,
    };
}

function toQuestItems(ids: string[] | undefined, context: MappingContext): QuestItem[] {
    return (ids ?? [])
        .map((id) => toQuestItem(id, context))
        .filter((item): item is QuestItem => item !== null);
}

function toRequiredKeyGroups(
    ids: JsonObjective["requiredKeys"],
    context: MappingContext,
): QuestItem[][] | undefined {
    if (!ids?.length) return undefined;
    const groups = Array.isArray(ids[0]) ? (ids as string[][]) : [ids as string[]];
    const mapped = groups.map((group) => toQuestItems(group, context)).filter((group) => group.length);
    return mapped.length ? mapped : undefined;
}

function toQuestMap(id: string | null | undefined, context: MappingContext): QuestMap | null {
    if (!id) return null;
    const map = context.maps[id];
    if (!map) return null;
    return {
        id: map.id,
        name: context.translateMap(map.name),
        normalizedName: map.normalizedName,
    };
}

function mapObjective(objective: JsonObjective, context: MappingContext): FullQuestObjective {
    const maps = (objective.maps ?? [])
        .map((id) => toQuestMap(id, context))
        .filter((map): map is QuestMap => map !== null);
    const requiredKeys = toRequiredKeyGroups(objective.requiredKeys, context);
    const locations = normalizeQuestObjectiveLocations(
        objective,
        (mapId) => toQuestMap(mapId, context),
    );
    const base = {
        id: objective.id,
        type: objective.type,
        description: context.translateTask(objective.description),
        optional: objective.optional ?? false,
        maps,
        requiredKeys,
        locations,
    };

    if (["giveItem", "findItem", "plantItem"].includes(objective.type)) {
        const allItems = toQuestItems(objective.items, context);
        const totalItemCount = allItems.length;
        const isPartial = totalItemCount > 15;
        return {
            ...base,
            type: objective.type as "giveItem" | "findItem" | "plantItem",
            count: objective.count ?? 0,
            foundInRaid: objective.foundInRaid ?? false,
            // Keep the full set for the selected-quest expandable item table.
            // Demand classification still uses isPartial/totalItemCount and does
            // not treat broad any-of groups as exact checklist requirements.
            items: allItems,
            totalItemCount,
            isPartial,
        };
    }

    if (objective.type === "shoot") {
        return {
            ...base,
            type: "shoot",
            count: objective.count ?? 1,
            target: objective.target ?? "",
            targetNames: (objective.targetNames ?? []).map(context.translateTask),
            shotType: objective.shotType,
            zoneNames: (objective.zones ?? []).map((zone) =>
                context.translateTask(zone.name),
            ),
            bodyParts: (objective.bodyParts ?? []).map(context.translateTask),
        };
    }

    if (objective.type === "extract") {
        return {
            ...base,
            type: "extract",
            exitName: objective.exitName ? context.translateTask(objective.exitName) : null,
            count: objective.count,
            exitStatus: (objective.exitStatus ?? []).map(context.translateTask),
            zoneNames: (objective.zones ?? []).map((zone) =>
                context.translateTask(zone.name),
            ),
        };
    }

    if ((objective.type === "buildWeapon" || objective.type === "buildItem") && objective.item) {
        const item = toQuestItem(objective.item, context);
        if (item) {
            return {
                ...base,
                type: "buildItem",
                item,
                containsAll: toQuestItems(objective.containsAll, context),
                containsCategory: (objective.containsCategory ?? [])
                    .map((id) => context.categories[id])
                    .filter(Boolean)
                    .map((category) => ({
                        id: category.id,
                        name: context.translateItem(category.name),
                        normalizedName: category.normalizedName,
                    })),
                attributes: objective.buildAttributes ?? [],
            };
        }
    }

    if (objective.type === "hideoutStation") {
        const stationId = objective.hideoutStation ?? objective.station;
        const station = stationId ? context.hideout[stationId] : undefined;
        if (station) {
            return {
                ...base,
                type: "hideoutStation",
                hideoutStation: {
                    id: station.id,
                    name: context.translateHideout(station.name),
                    normalizedName: station.normalizedName,
                },
                stationLevel: objective.stationLevel ?? null,
            };
        }
    }

    if (["findQuestItem", "giveQuestItem", "pickupQuestItem"].includes(objective.type)) {
        const questItem = objective.questItem
            ? toQuestItem(objective.questItem, context)
            : null;
        if (questItem) {
            return {
                ...base,
                type: objective.type === "findQuestItem" ? "findQuestItem" : "pickupQuestItem",
                questItem,
                count: objective.count ?? 1,
            };
        }
    }

    if (objective.type === "taskStatus" && objective.task) {
        return {
            ...base,
            type: "taskStatus",
            task: {
                id: objective.task,
                name: context.translateTask(context.tasks[objective.task]?.name),
            },
            status: objective.status ?? [],
        };
    }

    if (objective.type === "traderLevel" && objective.trader) {
        const trader = context.traders[objective.trader];
        if (trader) {
            return {
                ...base,
                type: "traderLevel",
                trader: {
                    id: trader.id,
                    name: context.translateTrader(trader.name),
                    normalizedName: trader.normalizedName,
                },
                level: objective.level ?? 1,
            };
        }
    }

    if (objective.type === "traderStanding" && objective.trader) {
        const trader = context.traders[objective.trader];
        if (trader) {
            return {
                ...base,
                type: "traderStanding",
                trader: {
                    id: trader.id,
                    name: context.translateTrader(trader.name),
                    normalizedName: trader.normalizedName,
                },
                compareMethod: objective.compareMethod ?? ">=",
                value: objective.value ?? 0,
            };
        }
    }

    if (objective.type === "playerLevel" && objective.playerLevel != null) {
        return { ...base, type: "playerLevel", playerLevel: objective.playerLevel };
    }

    if (objective.type === "useItem") {
        return {
            ...base,
            type: "useItem",
            useAny: toQuestItems(objective.useAny, context),
            compareMethod: objective.compareMethod ?? ">=",
            count: objective.count ?? 1,
            zoneNames: (objective.zones ?? []).map((zone) =>
                context.translateTask(zone.name),
            ),
        };
    }

    return base;
}

function mapFailCondition(condition: JsonFailCondition, context: MappingContext): QuestFailCondition {
    const base = {
        id: condition.id,
        type: condition.type,
        description: context.translateTask(condition.description),
        optional: condition.optional ?? null,
    };
    if (condition.type === "taskStatus" && condition.task) {
        return {
            ...base,
            type: "taskStatus",
            status: condition.status ?? [],
            task: { id: condition.task },
        };
    }
    return base;
}

function mapStandingRewards(
    rewards: JsonRewardSet | undefined,
    context: MappingContext,
): QuestTraderStandingReward[] {
    const mapped: QuestTraderStandingReward[] = [];
    for (const reward of rewards?.traderStanding ?? []) {
        const trader = context.traders[reward.trader];
        if (trader) {
            mapped.push({
                trader: {
                    id: trader.id,
                    name: context.translateTrader(trader.name),
                    normalizedName: trader.normalizedName,
                    imageLink: trader.imageLink,
                    image4xLink: trader.image4xLink,
                },
                standing: reward.standing,
            });
        }
    }
    return mapped;
}

async function fetchAndMapFullQuests(gameMode: TarkovJsonGameMode): Promise<FullQuest[]> {
    const [tasksDataset, itemsDataset, tradersDataset, mapsDataset, hideoutDataset] =
        await Promise.all([
            fetchTarkovJsonDataset<JsonTasksData>("tasks", gameMode),
            fetchTarkovJsonDataset<JsonItemsData>("items", gameMode),
            fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
            fetchTarkovJsonDataset<JsonMapsData>("maps", gameMode),
            fetchTarkovJsonDataset<
                Record<string, { id: string; name: string; normalizedName: string }>
            >("hideout", gameMode),
        ]);

    const rawTasks = Object.values(tasksDataset.data.tasks ?? {});
    if (rawTasks.length === 0 || Object.keys(itemsDataset.data.items ?? {}).length === 0) {
        throw new Error("Tarkov JSON task response contained no tasks or items");
    }

    const context: MappingContext = {
        tasks: tasksDataset.data.tasks,
        items: itemsDataset.data.items,
        questItems: tasksDataset.data.questItems ?? {},
        categories: itemsDataset.data.itemCategories ?? {},
        traders: tradersDataset.data,
        maps: mapsDataset.data.maps ?? {},
        hideout: hideoutDataset.data,
        prestige: Object.fromEntries(
            (tasksDataset.data.prestige ?? []).map((entry) => [entry.id, entry]),
        ),
        translateTask: tasksDataset.translate,
        translateItem: itemsDataset.translate,
        translateTrader: tradersDataset.translate,
        translateMap: mapsDataset.translate,
        translateHideout: hideoutDataset.translate,
    };

    return rawTasks.map((task): FullQuest => {
            const trader = context.traders[task.trader];
            if (!trader) throw new Error(`Tarkov JSON quest trader ${task.trader} was not found`);

            const prestige = task.requiredPrestige
                ? context.prestige[task.requiredPrestige]
                : undefined;
            const requiredPrestige: QuestPrestige | null = prestige
                ? {
                      id: prestige.id,
                      name: context.translateTask(prestige.name),
                      prestigeLevel: prestige.prestigeLevel,
                      imageLink: prestige.imageLink,
                      iconLink: prestige.iconLink,
                  }
                : null;

            return {
                id: task.id,
                name: context.translateTask(task.name),
                normalizedName: task.normalizedName,
                taskImageLink: task.taskImageLink,
                wikiLink: task.wikiLink,
                minPlayerLevel: task.minPlayerLevel,
                kappaRequired: task.kappaRequired,
                lightkeeperRequired: task.lightkeeperRequired,
                factionName: task.factionName,
                experience: task.experience,
                map: toQuestMap(task.map, context),
                trader: {
                    id: trader.id,
                    name: context.translateTrader(trader.name),
                    normalizedName: trader.normalizedName,
                    imageLink: trader.imageLink,
                    image4xLink: trader.image4xLink,
                },
                taskRequirements: (task.taskRequirements ?? []).map((requirement) => ({
                    task: {
                        id: requirement.task,
                        name: context.translateTask(context.tasks[requirement.task]?.name),
                    },
                    status: requirement.status ?? [],
                })),
                failConditions: (task.failConditions ?? []).map((condition) =>
                    mapFailCondition(condition, context),
                ),
                traderRequirements: (task.traderRequirements ?? [])
                    .map((requirement) => {
                        const requirementTrader = context.traders[requirement.trader];
                        if (!requirementTrader) return null;
                        return {
                            id: requirement.id,
                            trader: {
                                id: requirementTrader.id,
                                name: context.translateTrader(requirementTrader.name),
                                normalizedName: requirementTrader.normalizedName,
                                imageLink: requirementTrader.imageLink,
                                image4xLink: requirementTrader.image4xLink,
                            },
                            requirementType: requirement.requirementType,
                            compareMethod: requirement.compareMethod,
                            value: requirement.value,
                        };
                    })
                    .filter((requirement): requirement is NonNullable<typeof requirement> => requirement !== null),
                otherRequirements: mapQuestOtherRequirements(task.otherRequirements),
                requiredPrestige,
                finishTraderStandingRewards: mapStandingRewards(task.finishRewards, context),
                failureTraderStandingRewards: mapStandingRewards(task.failureOutcome, context),
                objectives: (task.objectives ?? []).map((objective) =>
                    mapObjective(objective, context),
                ),
            };
    });
}

export async function getJsonFullQuestData(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<FullQuestsPayload>> {
    const { fullBodyKey, fullMetaKey } = buildQuestRedisKeys(gameMode);
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        fullBodyKey,
        fullMetaKey,
    );
    const cached = parseNonEmptyTimedResponse<FullQuestsPayload>(
        cachedBody,
        (payload) => payload.quests,
    );
    if (cached && isProgressionCacheUsable(cachedMeta)) return cached;

    try {
        const quests = await fetchAndMapFullQuests(gameMode);
        if (quests.length === 0) throw new Error("Tarkov JSON task mapping produced no quests");
        const updatedAt = Date.now();
        const body: TimedResponse<FullQuestsPayload> = {
            data: { quests },
            updatedAt,
            diagnostics: { provider: "json", upstreamStatus: "ok" },
        };
        await writeRedisAfterResponse({
            [fullBodyKey]: JSON.stringify(body),
            [fullMetaKey]: { updatedAt },
        }, "full quests");
        return body;
    } catch (error) {
        console.error("Failed to refresh full quests from Tarkov JSON", error);
        if (cached) {
            console.log("Using stale full quest cache due to JSON upstream error");
            return markStaleFallback(cached);
        }
        throw error;
    }
}

export async function getJsonQuestData(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<QuestsPayload>> {
    const { questsBodyKey, questsMetaKey } = buildQuestRedisKeys(gameMode);
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        questsBodyKey,
        questsMetaKey,
    );
    const cached = parseNonEmptyTimedResponse<QuestsPayload>(
        cachedBody,
        (payload) => payload.quests,
    );
    if (cached && isProgressionCacheUsable(cachedMeta)) return cached;

    try {
        const full = await getJsonFullQuestData(gameMode);
        const isGiveItemObjective = (
            objective: FullQuestObjective,
        ): objective is QuestObjectiveItemType =>
            objective.type === "giveItem" && "items" in objective && "foundInRaid" in objective;
        const quests: Quest[] = full.data.quests
            .filter((quest) => quest.objectives.some(isGiveItemObjective))
            .map((quest) => ({
                id: quest.id,
                name: quest.name,
                normalizedName: quest.normalizedName,
                wikiLink: quest.wikiLink,
                minPlayerLevel: quest.minPlayerLevel,
                kappaRequired: quest.kappaRequired,
                lightkeeperRequired: quest.lightkeeperRequired,
                factionName: quest.factionName,
                experience: quest.experience,
                trader: {
                    id: quest.trader.id,
                    name: quest.trader.name,
                    normalizedName: quest.trader.normalizedName,
                },
                taskRequirements: quest.taskRequirements,
                failConditions: quest.failConditions,
                objectives: quest.objectives
                    .filter(isGiveItemObjective)
                    .map((objective) => ({
                        id: objective.id,
                        type: "giveItem" as const,
                        description: objective.description,
                        optional: objective.optional,
                        count: objective.count ?? 0,
                        foundInRaid: objective.foundInRaid,
                        items: objective.items,
                    })),
            }));
        if (quests.length === 0) throw new Error("Tarkov JSON mapping produced no item quests");

        const updatedAt = Date.now();
        const body: TimedResponse<QuestsPayload> = {
            data: { quests },
            updatedAt,
            diagnostics: { provider: "json", upstreamStatus: "ok" },
        };
        await writeRedisAfterResponse({
            [questsBodyKey]: JSON.stringify(body),
            [questsMetaKey]: { updatedAt },
        }, "item quests");
        return body;
    } catch (error) {
        console.error("Failed to refresh quests from Tarkov JSON", error);
        if (cached) {
            console.log("Using stale quest cache due to JSON upstream error");
            return markStaleFallback(cached);
        }
        throw error;
    }
}

const cachedJsonQuestData = unstable_cache(getJsonQuestData, ["json-quests"], {
    revalidate: DATA_CACHE_REVALIDATE_SECONDS,
    tags: ["quests"],
});

const cachedJsonFullQuestData = unstable_cache(
    getJsonFullQuestData,
    ["json-quests-full"],
    { revalidate: DATA_CACHE_REVALIDATE_SECONDS, tags: ["quests"] },
);

export const getCachedJsonQuestData = cacheWhenEnabled(
    getJsonQuestData,
    cachedJsonQuestData,
);

export const getCachedJsonFullQuestData = cacheWhenEnabled(
    getJsonFullQuestData,
    cachedJsonFullQuestData,
);
