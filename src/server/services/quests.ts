import { redis } from "@/server/redis";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import type { Quest, QuestsPayload, TimedResponse } from "@/types";
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
    objectives: RawObjective[];
}

interface TasksApiResponse {
    data: { tasks: RawTask[] };
}

export function orderQuestsByPrerequisites(quests: Quest[]): Quest[] {
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
    const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: TASKS_QUERY }),
    });

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
