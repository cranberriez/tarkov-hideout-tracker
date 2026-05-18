import { redis } from "@/server/redis";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import type {
    Quest,
    QuestsPayload,
    TimedResponse,
    FullQuest,
    FullQuestsPayload,
    FullQuestObjective,
    QuestTraderRequirement,
    QuestPrestige,
    QuestFailCondition,
} from "@/types";
import { unstable_cache } from "next/cache";

const CACHE_WINDOW_MS = 12 * 60 * 60 * 1000;
const REDIS_KEY = `quests:all:v${CACHE_VERSIONS.quests}`;
const REDIS_KEY_META = `${REDIS_KEY}:meta`;
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

const TASKS_QUERY = `
query Tasks {
  tasks(lang: en) {
    id
    name
    normalizedName
    wikiLink
    minPlayerLevel
    kappaRequired
    lightkeeperRequired
    factionName
    experience
    trader {
      id
      name
      normalizedName
    }
    taskRequirements {
      task {
        id
        name
      }
      status
    }
    failConditions {
      id
      type
      description
      ... on TaskObjectiveTaskStatus {
        status
        optional
        task {
          id
        }
      }
    }
    objectives {
      id
      type
      description
      optional
      ... on TaskObjectiveItem {
        count
        foundInRaid
        items {
          id
          name
          normalizedName
          iconLink
          gridImageLink
        }
      }
    }
    restartable
  }
}
`;

interface RawObjectiveItem {
    id: string;
    name: string;
    normalizedName: string;
    iconLink?: string;
    gridImageLink?: string;
}

interface RawObjective {
    id: string;
    type: string;
    description: string;
    optional: boolean;
    count?: number;
    foundInRaid?: boolean;
    items?: RawObjectiveItem[];
}

interface RawFailCondition {
    id: string;
    type: string;
    description: string;
    status?: string[];
    optional?: boolean | null;
    task?: { id: string } | null;
}

interface RawTask {
    id: string;
    name: string;
    normalizedName: string;
    wikiLink?: string;
    minPlayerLevel?: number;
    kappaRequired?: boolean;
    lightkeeperRequired?: boolean;
    factionName?: string;
    experience: number;
    trader: { id: string; name: string; normalizedName: string };
    taskRequirements: { task: { id: string; name: string }; status: string[] }[];
    failConditions: RawFailCondition[];
    objectives: RawObjective[];
    restartable: boolean;
}

interface TasksApiResponse {
    data: { tasks: RawTask[] };
}

type QuestLike = {
    id: string;
    name: string;
    minPlayerLevel?: number | null;
    taskRequirements: { task: { id: string } }[];
};

function mapFailCondition(condition: RawFailCondition): QuestFailCondition {
    const base = {
        id: condition.id,
        type: condition.type,
        description: condition.description,
        optional: condition.optional ?? null,
    };

    if (condition.type === "taskStatus" && condition.task) {
        return {
            ...base,
            type: "taskStatus",
            status: condition.status ?? [],
            task: { id: condition.task.id },
        };
    }

    return base;
}

export function orderQuestsByPrerequisites<T extends QuestLike>(quests: T[]): T[] {
    const questMap = new Map(quests.map((q) => [q.id, q]));
    const depthCache = new Map<string, number>();

    function getDepth(id: string, visiting: Set<string>): number {
        if (depthCache.has(id)) return depthCache.get(id)!;
        if (visiting.has(id)) return 0;

        const quest = questMap.get(id);
        if (!quest || quest.taskRequirements.length === 0) {
            depthCache.set(id, 0);
            return 0;
        }

        visiting.add(id);
        let maxPrereqDepth = -1;
        for (const req of quest.taskRequirements) {
            const d = getDepth(req.task.id, visiting);
            if (d > maxPrereqDepth) maxPrereqDepth = d;
        }
        visiting.delete(id);

        const depth = maxPrereqDepth + 1;
        depthCache.set(id, depth);
        return depth;
    }

    return [...quests].sort((a, b) => {
        const da = getDepth(a.id, new Set());
        const db = getDepth(b.id, new Set());
        if (da !== db) return da - db;
        const la = a.minPlayerLevel ?? 0;
        const lb = b.minPlayerLevel ?? 0;
        if (la !== lb) return la - lb;
        return a.name.localeCompare(b.name);
    });
}

async function getQuestData(): Promise<TimedResponse<QuestsPayload>> {
    const [cachedBody, cachedMeta] = await redis.mget<[string, { updatedAt: number }]>(
        REDIS_KEY,
        REDIS_KEY_META,
    );

    if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
        const age = Date.now() - cachedMeta.updatedAt;
        if (age < CACHE_WINDOW_MS) {
            console.log("Using cached quest data");
            if (typeof cachedBody === "object") return cachedBody as TimedResponse<QuestsPayload>;
            return JSON.parse(cachedBody) as TimedResponse<QuestsPayload>;
        }
    }

    console.log("Fetching fresh quest data from Tarkov.dev");
    let res: Response;
    try {
        res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: TASKS_QUERY }),
        });
    } catch (error) {
        console.error("Tarkov.dev tasks fetch threw", error);
        if (cachedBody) {
            console.log("Using stale quest cache due to fetch error");
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<QuestsPayload>;
        }
        throw error;
    }

    if (!res.ok) {
        const text = await res.text();
        console.error("Tarkov.dev tasks error", res.status, text);
        if (cachedBody) {
            console.log("Using stale quest cache due to upstream error");
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<QuestsPayload>;
        }
        throw new Error("Failed to fetch quest data");
    }

    const json = (await res.json()) as TasksApiResponse;
    const rawTasks = json.data?.tasks ?? [];

    const quests: Quest[] = rawTasks
        .filter((t) => t.objectives.some((o) => o.type === "giveItem"))
        .map(
            (t): Quest => ({
                id: t.id,
                name: t.name,
                normalizedName: t.normalizedName,
                wikiLink: t.wikiLink,
                minPlayerLevel: t.minPlayerLevel,
                kappaRequired: t.kappaRequired,
                lightkeeperRequired: t.lightkeeperRequired,
                factionName: t.factionName,
                experience: t.experience,
                trader: t.trader,
                taskRequirements: t.taskRequirements,
                failConditions: (t.failConditions ?? []).map(mapFailCondition),
                objectives: t.objectives
                    .filter((o) => o.type === "giveItem")
                    .map((o) => ({
                        id: o.id,
                        type: "giveItem" as const,
                        description: o.description,
                        optional: o.optional,
                        count: o.count ?? 0,
                        foundInRaid: o.foundInRaid ?? false,
                        items: o.items ?? [],
                    })),
            }),
        );

    const payload: QuestsPayload = { quests };
    const updatedAt = Date.now();
    const body: TimedResponse<QuestsPayload> = { data: payload, updatedAt };

    await redis.mset({
        [REDIS_KEY]: JSON.stringify(body),
        [REDIS_KEY_META]: { updatedAt },
    });

    console.log(`Cached ${quests.length} quests with giveItem objectives`);

    return body;
}

export const getCachedQuestData = unstable_cache(getQuestData, ["quests"], {
    revalidate: 43200,
});

// ---- Full quest service (all quests, all objective types, map data) ----

const FULL_REDIS_KEY = `quests:full:v${CACHE_VERSIONS.questsFull}`;
const FULL_REDIS_KEY_META = `${FULL_REDIS_KEY}:meta`;

const FULL_TASKS_QUERY = `
query TasksFull {
  tasks(lang: en) {
    id
    name
    normalizedName
    wikiLink
    minPlayerLevel
    kappaRequired
    lightkeeperRequired
    factionName
    experience
    map {
      id
      name
      normalizedName
    }
    trader {
      id
      name
      normalizedName
      imageLink
      image4xLink
    }
    taskRequirements {
      task {
        id
        name
      }
      status
    }
    failConditions {
      id
      type
      description
      ... on TaskObjectiveTaskStatus {
        status
        optional
        task {
          id
        }
      }
    }
    traderRequirements {
      id
      trader {
        id
        name
        normalizedName
        imageLink
        image4xLink
      }
      requirementType
      compareMethod
      value
    }
    requiredPrestige {
      id
      name
      prestigeLevel
      imageLink
      iconLink
    }
    objectives {
      id
      type
      description
      optional
      maps {
        id
        name
        normalizedName
      }
      ... on TaskObjectiveBasic {
        zones {
          id
          map {
            id
            name
            normalizedName
          }
        }
        requiredKeys {
          ...CompactItem
        }
      }
      ... on TaskObjectiveBuildItem {
        item {
          ...CompactItem
        }
        containsAll {
          ...CompactItem
        }
        containsCategory {
          id
          name
          normalizedName
        }
        attributes {
          name
          requirement {
            compareMethod
            value
          }
        }
      }
      ... on TaskObjectiveExperience {
        count
      }
      ... on TaskObjectiveItem {
        count
        foundInRaid
        dogTagLevel
        maxDurability
        minDurability
        items {
          id
        }
        requiredKeys {
          ...CompactItem
        }
      }
      ... on TaskObjectiveShoot {
        count
        targetNames
        shotType
        zoneNames
        target
        bodyParts
        usingWeapon {
          ...CompactItem
        }
        usingWeaponMods {
          ...CompactItem
        }
        wearing {
          ...CompactItem
        }
        notWearing {
          ...CompactItem
        }
        requiredKeys {
          ...CompactItem
        }
      }
      ... on TaskObjectiveExtract {
        exitStatus
        exitName
        zoneNames
        count
        requiredKeys {
          ...CompactItem
        }
      }
      ... on TaskObjectiveHideoutStation {
        hideoutStation {
          id
          name
          normalizedName
        }
        stationLevel
      }
      ... on TaskObjectiveMark {
        markerItem {
          ...CompactItem
        }
        requiredKeys {
          ...CompactItem
        }
      }
      ... on TaskObjectivePlayerLevel {
        playerLevel
      }
      ... on TaskObjectiveQuestItem {
        questItem {
          id
          name
          normalizedName
          iconLink
        }
        count
      }
      ... on TaskObjectiveSkill {
        skillLevel {
          name
          level
          skill {
            id
            name
            imageLink
          }
        }
      }
      ... on TaskObjectiveTaskStatus {
        task {
          id
          name
        }
        status
      }
      ... on TaskObjectiveTraderLevel {
        trader {
          id
          name
          normalizedName
        }
        level
      }
      ... on TaskObjectiveTraderStanding {
        trader {
          id
          name
          normalizedName
        }
        compareMethod
        value
      }
      ... on TaskObjectiveUseItem {
        useAny {
          ...CompactItem
        }
        compareMethod
        count
        zoneNames
      }
    }
  }
}

fragment CompactItem on Item {
  id
  name
  normalizedName
  iconLink
}
`;

const QUEST_ITEMS_QUERY = `
query QuestObjectiveItems($ids: [ID]) {
  items(ids: $ids, lang: en) {
    id
    name
    normalizedName
    iconLink
  }
}
`;

interface RawFullObjective {
    id: string;
    type: string;
    description: string;
    optional: boolean;
    maps?: RawQuestMap[];
    // TaskObjectiveItem
    count?: number;
    foundInRaid?: boolean;
    dogTagLevel?: number | null;
    maxDurability?: number | null;
    minDurability?: number | null;
    totalItemCount?: number;
    isPartial?: boolean;
    items?: RawObjectiveItem[];
    requiredKeys?: RawObjectiveItem[][];
    // TaskObjectiveShoot
    target?: string;
    targetNames?: string[];
    shotType?: string;
    bodyParts?: string[];
    zoneNames?: string[];
    usingWeapon?: RawObjectiveItem[];
    usingWeaponMods?: RawObjectiveItem[][];
    wearing?: RawObjectiveItem[][];
    notWearing?: RawObjectiveItem[];
    // TaskObjectiveExtract
    exitName?: string | null;
    exitStatus?: string[];
    // Other objective variants
    item?: RawObjectiveItem;
    containsAll?: RawObjectiveItem[];
    containsCategory?: RawItemCategory[];
    attributes?: RawAttributeThreshold[];
    hideoutStation?: { id: string; name: string; normalizedName: string };
    stationLevel?: number | null;
    markerItem?: RawObjectiveItem;
    playerLevel?: number;
    questItem?: RawObjectiveItem;
    skillLevel?: RawSkillLevel;
    task?: { id: string; name: string };
    status?: string[];
    trader?: { id: string; name: string; normalizedName: string };
    level?: number;
    compareMethod?: string;
    value?: number;
    useAny?: RawObjectiveItem[];
}

interface RawTraderRequirement {
    id: string;
    trader: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string;
        image4xLink?: string;
    };
    requirementType: string;
    compareMethod: string;
    value: number;
}

interface RawPrestige {
    id: string;
    name: string;
    prestigeLevel: number;
    imageLink?: string | null;
    iconLink?: string | null;
}

interface RawQuestMap {
    id: string;
    name: string;
    normalizedName: string;
}

interface RawItemCategory {
    id: string;
    name: string;
    normalizedName: string;
}

interface RawSkillLevel {
    name: string;
    level: number;
    skill: {
        id: string;
        name: string;
        imageLink?: string | null;
    };
}

interface RawAttributeThreshold {
    name: string;
    requirement: {
        compareMethod: string;
        value: number;
    };
}

interface RawFullTask {
    id: string;
    name: string;
    normalizedName: string;
    wikiLink?: string;
    minPlayerLevel?: number;
    kappaRequired?: boolean;
    lightkeeperRequired?: boolean;
    factionName?: string;
    experience: number;
    map?: RawQuestMap | null;
    trader: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string;
        image4xLink?: string;
    };
    taskRequirements: { task: { id: string; name: string }; status: string[] }[];
    failConditions: RawFailCondition[];
    traderRequirements: RawTraderRequirement[];
    requiredPrestige?: RawPrestige | null;
    objectives: RawFullObjective[];
}

interface FullTasksApiResponse {
    data: { tasks: RawFullTask[] };
}

function mapFullObjective(o: RawFullObjective): FullQuestObjective {
    const base = {
        id: o.id,
        type: o.type,
        description: o.description,
        optional: o.optional,
        maps: o.maps ?? [],
    };

    if ((o.type === "giveItem" || o.type === "findItem") && o.items) {
        return {
            ...base,
            type: o.type as "giveItem" | "findItem",
            count: o.count ?? 0,
            foundInRaid: o.foundInRaid ?? false,
            items: o.items,
            totalItemCount: o.totalItemCount ?? o.items.length,
            isPartial: o.isPartial ?? false,
        };
    }

    if (o.type === "shoot" && o.target !== undefined) {
        return {
            ...base,
            type: "shoot",
            count: o.count ?? 1,
            target: o.target,
            targetNames: o.targetNames ?? [],
            shotType: o.shotType,
            zoneNames: o.zoneNames ?? [],
            bodyParts: o.bodyParts ?? [],
        };
    }

    if (o.type === "extract") {
        return {
            ...base,
            type: "extract",
            exitName: o.exitName ?? null,
            count: o.count,
            exitStatus: o.exitStatus ?? [],
            zoneNames: o.zoneNames ?? [],
            requiredKeys: o.requiredKeys,
        };
    }

    if (o.type === "buildItem" && o.item) {
        return {
            ...base,
            type: "buildItem",
            item: o.item,
            containsAll: o.containsAll ?? [],
            containsCategory: o.containsCategory ?? [],
            attributes: o.attributes ?? [],
        };
    }

    if (o.type === "hideoutStation" && o.hideoutStation) {
        return {
            ...base,
            type: "hideoutStation",
            hideoutStation: o.hideoutStation,
            stationLevel: o.stationLevel ?? null,
        };
    }

    if ((o.type === "pickupQuestItem" || o.type === "findQuestItem") && o.questItem) {
        return {
            ...base,
            type: o.type,
            questItem: o.questItem,
            count: o.count ?? 1,
        };
    }

    if (o.type === "taskStatus" && o.task) {
        return {
            ...base,
            type: "taskStatus",
            task: o.task,
            status: o.status ?? [],
        };
    }

    if (o.type === "traderLevel" && o.trader) {
        return {
            ...base,
            type: "traderLevel",
            trader: o.trader,
            level: o.level ?? 1,
        };
    }

    if (o.type === "traderStanding" && o.trader) {
        return {
            ...base,
            type: "traderStanding",
            trader: o.trader,
            compareMethod: o.compareMethod ?? ">=",
            value: o.value ?? 0,
        };
    }

    if (o.type === "playerLevel" && o.playerLevel != null) {
        return {
            ...base,
            type: "playerLevel",
            playerLevel: o.playerLevel,
        };
    }

    if (o.type === "useItem") {
        return {
            ...base,
            type: "useItem",
            useAny: o.useAny ?? [],
            compareMethod: o.compareMethod ?? ">=",
            count: o.count ?? 1,
            zoneNames: o.zoneNames ?? [],
        };
    }

    return base;
}

function shouldHydrateFullObjectiveItems(objective: RawFullObjective, itemIndex: number) {
    if (objective.type !== "giveItem" && objective.type !== "findItem") return false;
    const total = objective.items?.length ?? 0;
    if (total <= 1) return true;
    return itemIndex < 15;
}

async function fetchQuestObjectiveItemsById(
    itemIds: string[],
): Promise<Map<string, RawObjectiveItem>> {
    if (itemIds.length === 0) return new Map();

    const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: QUEST_ITEMS_QUERY, variables: { ids: itemIds } }),
    });

    if (!res.ok) {
        throw new Error("Failed to fetch quest objective item details");
    }

    const json = (await res.json()) as { data?: { items?: RawObjectiveItem[] } };
    return new Map((json.data?.items ?? []).map((item) => [item.id, item]));
}

async function hydrateFullQuestObjectiveItems(rawTasks: RawFullTask[]) {
    const itemIds = new Set<string>();

    for (const task of rawTasks) {
        for (const objective of task.objectives) {
            objective.items?.forEach((item, index) => {
                if (shouldHydrateFullObjectiveItems(objective, index)) itemIds.add(item.id);
            });
        }
    }

    const itemsById = await fetchQuestObjectiveItemsById([...itemIds]);

    for (const task of rawTasks) {
        for (const objective of task.objectives) {
            if (!objective.items) continue;

            const totalItemCount = objective.items.length;
            const shouldLimit = totalItemCount > 15;
            const itemsToKeep = shouldLimit ? objective.items.slice(0, 15) : objective.items;

            objective.totalItemCount = totalItemCount;
            objective.isPartial = shouldLimit;
            objective.items = itemsToKeep.map((item) => itemsById.get(item.id) ?? item);
        }
    }
}

async function getFullQuestData(): Promise<TimedResponse<FullQuestsPayload>> {
    const [cachedBody, cachedMeta] = await redis.mget<[string, { updatedAt: number }]>(
        FULL_REDIS_KEY,
        FULL_REDIS_KEY_META,
    );

    if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
        const age = Date.now() - cachedMeta.updatedAt;
        if (age < CACHE_WINDOW_MS) {
            console.log("Using cached full quest data");
            if (typeof cachedBody === "object")
                return cachedBody as TimedResponse<FullQuestsPayload>;
            return JSON.parse(cachedBody) as TimedResponse<FullQuestsPayload>;
        }
    }

    console.log("Fetching fresh full quest data from Tarkov.dev");
    let res: Response;
    try {
        res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: FULL_TASKS_QUERY }),
        });
    } catch (error) {
        console.error("Tarkov.dev full tasks fetch threw", error);
        if (cachedBody) {
            console.log("Using stale full quest cache due to fetch error");
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<FullQuestsPayload>;
        }
        throw error;
    }

    if (!res.ok) {
        const text = await res.text();
        console.error("Tarkov.dev full tasks error", res.status, text);
        if (cachedBody) {
            console.log("Using stale full quest cache due to upstream error");
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<FullQuestsPayload>;
        }
        throw new Error("Failed to fetch full quest data");
    }

    const json = (await res.json()) as FullTasksApiResponse;
    const rawTasks = json.data?.tasks ?? [];
    await hydrateFullQuestObjectiveItems(rawTasks);

    // Tasks with minPlayerLevel < 1 are Fence/scav-karma quests that don't apply to normal PMC progression
    const quests: FullQuest[] = rawTasks
        .filter(
            (t) =>
                t.minPlayerLevel === undefined ||
                t.minPlayerLevel === null ||
                t.minPlayerLevel >= 1,
        )
        .map(
            (t): FullQuest => ({
                id: t.id,
                name: t.name,
                normalizedName: t.normalizedName,
                wikiLink: t.wikiLink,
                minPlayerLevel: t.minPlayerLevel,
                kappaRequired: t.kappaRequired,
                lightkeeperRequired: t.lightkeeperRequired,
                factionName: t.factionName,
                experience: t.experience,
                map: t.map ?? null,
                trader: {
                    id: t.trader.id,
                    name: t.trader.name,
                    normalizedName: t.trader.normalizedName,
                    imageLink: t.trader.imageLink,
                    image4xLink: t.trader.image4xLink,
                },
                taskRequirements: t.taskRequirements,
                failConditions: (t.failConditions ?? []).map(mapFailCondition),
                traderRequirements: (t.traderRequirements ?? []).map(
                    (r): QuestTraderRequirement => ({
                        id: r.id,
                        trader: {
                            id: r.trader.id,
                            name: r.trader.name,
                            normalizedName: r.trader.normalizedName,
                            imageLink: r.trader.imageLink,
                            image4xLink: r.trader.image4xLink,
                        },
                        requirementType: r.requirementType,
                        compareMethod: r.compareMethod,
                        value: r.value,
                    }),
                ),
                requiredPrestige: t.requiredPrestige
                    ? ({
                          id: t.requiredPrestige.id,
                          name: t.requiredPrestige.name,
                          prestigeLevel: t.requiredPrestige.prestigeLevel,
                          imageLink: t.requiredPrestige.imageLink,
                          iconLink: t.requiredPrestige.iconLink,
                      } satisfies QuestPrestige)
                    : null,
                objectives: t.objectives.map(mapFullObjective),
            }),
        );

    const payload: FullQuestsPayload = { quests };
    const updatedAt = Date.now();
    const body: TimedResponse<FullQuestsPayload> = { data: payload, updatedAt };

    await redis.mset({
        [FULL_REDIS_KEY]: JSON.stringify(body),
        [FULL_REDIS_KEY_META]: { updatedAt },
    });

    console.log(`Cached ${quests.length} full quests`);

    return body;
}

export const getCachedFullQuestData = unstable_cache(getFullQuestData, ["quests-full"], {
    revalidate: 43200,
});
