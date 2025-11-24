import { NextResponse } from "next/server";
import type {
    HideoutStationsPayload,
    TimedResponse,
    Station,
    StationLevel,
    ItemRequirement,
    StationLevelRequirement,
    SkillRequirement,
    TraderRequirement,
} from "@/app/types";
import { redis } from "@/app/server/redis";
import { requiresFoundInRaid } from "@/app/lib/cfg/foundInRaid";

const CACHE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const REDIS_KEY = "hideout:stations:v4";
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

export async function GET() {
    try {
        // 1. Try Redis cache first
        const cached = await redis.get<TimedResponse<HideoutStationsPayload>>(REDIS_KEY);

        if (cached && typeof cached === "object" && "updatedAt" in cached) {
            const age = Date.now() - cached.updatedAt;
            if (age < CACHE_WINDOW_MS) {
                console.log("Using cached hideout stations");
                return NextResponse.json(cached as TimedResponse<HideoutStationsPayload>, {
                    status: 200,
                });
            }
        }

        // 2. Fetch from Tarkov.dev
        const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: HIDEOUT_STATIONS_QUERY }),
            // Do not cache at the fetch layer; Redis is our cache.
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Tarkov.dev hideoutStations error", res.status, text);
            if (cached) {
                return NextResponse.json(cached as TimedResponse<HideoutStationsPayload>, {
                    status: 200,
                });
            }
            return NextResponse.json(
                { error: "Failed to fetch hideout stations" },
                { status: 502 }
            );
        }

        const json = (await res.json()) as TarkovHideoutStationsResponse;

        const stations: Station[] = (json.data?.hideoutStations ?? []).map(
            (s): Station => ({
                id: s.id,
                name: s.name,
                normalizedName: s.normalizedName,
                imageLink: s.imageLink,
                levels: (s.levels ?? []).map(
                    (lvl): StationLevel => ({
                        id: lvl.id,
                        level: lvl.level,
                        itemRequirements: (lvl.itemRequirements ?? []).map(
                            (req): ItemRequirement => {
                                const attributes = [...(req.attributes ?? [])];
                                const isFir = (
                                    requiresFoundInRaid as Record<string, Record<number, string[]>>
                                )[s.normalizedName]?.[lvl.level]?.includes(req.item.normalizedName);

                                if (isFir) {
                                    attributes.push({
                                        type: "functional",
                                        name: "found_in_raid",
                                        value: "true",
                                    });
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
                                    count: req.count,
                                    quantity: req.quantity,
                                    attributes: attributes,
                                };
                            }
                        ),
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
                    })
                ),
            })
        );

        const payload: HideoutStationsPayload = { stations };

        const body: TimedResponse<HideoutStationsPayload> = {
            data: payload,
            updatedAt: Date.now(),
        };

        // 3. Store in Redis
        await redis.set(REDIS_KEY, body);

        return NextResponse.json(body, { status: 200 });
    } catch (error) {
        console.error("/api/hideout/stations unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
