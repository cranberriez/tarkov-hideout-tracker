import { redis } from "@/server/redis";
import { requiresFoundInRaid } from "@/lib/cfg/foundInRaid";
import { wikiData } from "@/lib/data/wiki-data";
import { unstable_cache } from "next/cache";
import {
    HideoutStationsPayload,
    TimedResponse,
    Station,
    StationLevel,
    ItemRequirement,
    StationLevelRequirement,
    SkillRequirement,
    TraderRequirement,
} from "@/types";

const CACHE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const REDIS_KEY = "hideout:stations:v6";
const REDIS_KEY_META = `${REDIS_KEY}:meta`;
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

interface TarkovHideoutItemRequirement {
    id: string;
    count?: number;
    quantity?: number;
    item: {
        id: string;
        name: string;
        normalizedName: string;
        shortName?: string;
        iconLink?: string;
        gridImageLink?: string;
    };
    attributes: {
        type: string;
        name: string;
        value: string;
    }[];
}

interface TarkovHideoutLevel {
    id: string;
    level: number;
    constructionTime: number;
    itemRequirements: TarkovHideoutItemRequirement[];
    stationLevelRequirements: {
        station: {
            normalizedName: string;
        };
        level: number;
    }[];
    skillRequirements: {
        name: string;
        skill: {
            name: string;
            imageLink?: string;
        };
        level: number;
    }[];
    traderRequirements: {
        trader: {
            name: string;
            normalizedName: string;
            imageLink?: string;
        };
        value: number;
    }[];
}

interface TarkovHideoutStation {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
    levels: TarkovHideoutLevel[];
}

interface TarkovHideoutStationsResponse {
    data: {
        hideoutStations: TarkovHideoutStation[];
    };
}

const HIDEOUT_STATIONS_QUERY = `
   query HideoutStations {
     hideoutStations(lang: en) {
       id
       name
       normalizedName
       imageLink
       levels {
         id
         level
		 constructionTime
         itemRequirements {
           id
           count
           quantity
           item {
             id
             name
             normalizedName
             shortName
             iconLink
             gridImageLink
           }
           attributes {
             type
             name
             value
           }
         }
         stationLevelRequirements {
             station {
                 normalizedName
             }
             level
         }
         skillRequirements {
             name
             skill {
                 name
                 imageLink
             }
             level
         }
         traderRequirements {
             trader {
                 name
                 normalizedName
                 imageLink
             }
             value
         }
       }
     }
   }
 `;

export async function getHideoutStations(): Promise<TimedResponse<HideoutStationsPayload>> {
    // 1. Try Redis cache first
    const [cachedBody, cachedMeta] = await redis.mget<[string, { updatedAt: number }]>(
        REDIS_KEY,
        REDIS_KEY_META
    );

    let isFresh = false;

    if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
        const age = Date.now() - cachedMeta.updatedAt;
        if (age < CACHE_WINDOW_MS) {
            isFresh = true;
        }
    }

    if (isFresh && cachedBody) {
        console.log("Using cached hideout stations");
        if (typeof cachedBody === "object") {
            return cachedBody as TimedResponse<HideoutStationsPayload>;
        }
        return JSON.parse(cachedBody) as TimedResponse<HideoutStationsPayload>;
    }

    // 2. Fetch from Tarkov.dev
    console.log("Fetching fresh hideout stations from Tarkov.dev");
    const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: HIDEOUT_STATIONS_QUERY }),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("Tarkov.dev hideoutStations error", res.status, text);
        if (cachedBody) {
            console.log("Using stale cached stations due to upstream error");
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<HideoutStationsPayload>;
        }
        throw new Error("Failed to fetch hideout stations");
    }

    const json = (await res.json()) as TarkovHideoutStationsResponse;

    const stations: Station[] = (json.data?.hideoutStations ?? []).map((s): Station => {
        const wikiStation = wikiData.find((ws) => ws.normalizedName === s.normalizedName);

        const levels = (s.levels ?? []).map((lvl): StationLevel => {
            const wikiLevel = wikiStation?.levels.find((wl) => wl.level === lvl.level);

            // Map API Item Requirements
            let itemRequirements = (lvl.itemRequirements ?? []).map((req): ItemRequirement => {
                const attributes = [...(req.attributes ?? [])];

                // Check Wiki Data for overrides
                let quantity = req.count ?? req.quantity ?? 0;
                let isFir = false;

                if (wikiLevel) {
                    const wikiReq = wikiLevel.requirements.find(
                        (wr) => wr.type === "item" && wr.name === req.item.normalizedName
                    );

                    if (wikiReq) {
                        quantity = wikiReq.quantity ?? quantity;
                        isFir = wikiReq.foundInRaid ?? false;
                    }
                } else {
                    // Fallback to config
                    isFir = (requiresFoundInRaid as Record<string, Record<number, string[]>>)[
                        s.normalizedName
                    ]?.[lvl.level]?.includes(req.item.normalizedName);
                }

                if (isFir) {
                    // Check if attribute exists, if not add it
                    const hasFirAttr = attributes.some((a) => a.name === "found_in_raid");
                    if (!hasFirAttr) {
                        attributes.push({
                            type: "functional",
                            name: "found_in_raid",
                            value: "true",
                        });
                    }
                }

                return {
                    id: req.id,
                    item: {
                        id: req.item.id,
                        name: req.item.name,
                        normalizedName: req.item.normalizedName,
                        shortName: req.item.shortName,
                        iconLink: req.item.iconLink,
                        gridImageLink: req.item.gridImageLink,
                    },
                    count: quantity,
                    quantity: quantity,
                    attributes: attributes,
                };
            });

            // If we have wiki data, strictly filter/add requirements based on wiki
            if (wikiLevel) {
                const wikiItemNames = new Set(
                    wikiLevel.requirements.filter((r) => r.type === "item").map((r) => r.name)
                );

                // Filter API reqs to only include those in Wiki
                itemRequirements = itemRequirements.filter((req) =>
                    wikiItemNames.has(req.item.normalizedName)
                );
            }

            return {
                id: lvl.id,
                level: lvl.level,
                constructionTime: lvl.constructionTime,
                itemRequirements,
                stationLevelRequirements: (lvl.stationLevelRequirements ?? []).map(
                    (req): StationLevelRequirement => ({
                        station: {
                            normalizedName: req.station.normalizedName,
                        },
                        level: req.level,
                    })
                ),
                skillRequirements: (lvl.skillRequirements ?? []).map(
                    (req): SkillRequirement => ({
                        name: req.name,
                        skill: {
                            name: req.skill.name,
                            imageLink: req.skill.imageLink,
                        },
                        level: req.level,
                    })
                ),
                traderRequirements: (lvl.traderRequirements ?? []).map(
                    (req): TraderRequirement => ({
                        trader: {
                            name: req.trader.name,
                            normalizedName: req.trader.normalizedName,
                            imageLink: req.trader.imageLink,
                        },
                        value: req.value,
                    })
                ),
            } as StationLevel;
        });

        return {
            id: s.id,
            name: s.name,
            normalizedName: s.normalizedName,
            imageLink: s.imageLink,
            levels,
        };
    });

    const payload: HideoutStationsPayload = { stations };

    const updatedAt = Date.now();

    const body: TimedResponse<HideoutStationsPayload> = {
        data: payload,
        updatedAt,
    };

    // 3. Store in Redis
    const jsonBody = JSON.stringify(body);

    await redis.mset({
        [REDIS_KEY]: jsonBody,
        [REDIS_KEY_META]: { updatedAt },
    });

    return body;
}

export const getCachedHideoutStations = unstable_cache(
    async () => {
        return getHideoutStations();
    },
    ["hideout-stations"],
    { revalidate: 12 * 60 * 60 }
);
