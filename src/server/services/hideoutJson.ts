import { unstable_cache } from "next/cache";
import { cacheWhenEnabled } from "@/server/cache";
import { requiresFoundInRaid } from "@/lib/cfg/foundInRaid";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { wikiData } from "@/lib/data/wiki-data";
import { redis } from "@/server/redis";
import {
    fetchTarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import {
    isProgressionCacheUsable,
    parseNonEmptyTimedResponse,
} from "@/server/services/tarkovJson/cache";
import type {
    HideoutStationsPayload,
    ItemRequirement,
    RequirementAttribute,
    Station,
    TimedResponse,
} from "@/types";

function buildRedisKeys(gameMode: TarkovJsonGameMode) {
    const bodyKey = `hideout:stations:v${CACHE_VERSIONS.hideoutStations}:${gameMode}`;
    return { bodyKey, metaKey: `${bodyKey}:meta` };
}

interface JsonItem {
    id: string;
    name: string;
    shortName?: string;
    normalizedName: string;
    iconLink?: string;
    gridImageLink?: string;
}

interface JsonTrader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
}

interface JsonHideoutRequirement {
    id: string;
    item: string;
    count: number;
    attributes?: Record<string, string | number | boolean>;
}

interface JsonHideoutLevel {
    id: string;
    level: number;
    constructionTime: number;
    itemRequirements?: JsonHideoutRequirement[];
    stationLevelRequirements?: Array<{ station: string; level: number }>;
    skillRequirements?: Array<{ skill: string; level: number }>;
    traderRequirements?: Array<{ trader: string; value: number }>;
}

interface JsonHideoutStation {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
    levels?: JsonHideoutLevel[];
}

interface JsonItemsData {
    items: Record<string, JsonItem>;
    skills?: Array<{ id: string; name: string; imageLink?: string }>;
}

function mapAttributes(attributes: JsonHideoutRequirement["attributes"]): RequirementAttribute[] {
    return Object.entries(attributes ?? {}).map(([name, value]) => ({
        type: "functional",
        name: name === "foundInRaid" ? "found_in_raid" : name,
        value: String(value),
    }));
}

export async function getJsonHideoutStations(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<HideoutStationsPayload>> {
    const { bodyKey, metaKey } = buildRedisKeys(gameMode);
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        bodyKey,
        metaKey,
    );
    const cached = parseNonEmptyTimedResponse<HideoutStationsPayload>(
        cachedBody,
        (payload) => payload.stations,
    );

    if (cached && isProgressionCacheUsable(cachedMeta)) {
        console.log("Using cached hideout stations");
        return cached;
    }

    try {
        const [hideoutDataset, itemsDataset, tradersDataset] = await Promise.all([
            fetchTarkovJsonDataset<Record<string, JsonHideoutStation>>("hideout", gameMode),
            fetchTarkovJsonDataset<JsonItemsData>("items", gameMode),
            fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
        ]);

        const rawStations = Object.values(hideoutDataset.data);
        if (rawStations.length === 0 || Object.keys(itemsDataset.data.items ?? {}).length === 0) {
            throw new Error("Tarkov JSON hideout response contained no stations or items");
        }

        const stationsById = hideoutDataset.data;
        const tradersById = tradersDataset.data;
        const itemsById = itemsDataset.data.items;
        const skillsByName = new Map(
            (itemsDataset.data.skills ?? []).map((skill) => [skill.id, skill]),
        );

        const stations: Station[] = rawStations.map((station) => {
            const wikiStation = wikiData.find(
                (entry) => entry.normalizedName === station.normalizedName,
            );

            return {
                id: station.id,
                name: hideoutDataset.translate(station.name),
                normalizedName: station.normalizedName,
                imageLink: station.imageLink,
                levels: (station.levels ?? []).map((level) => {
                    const wikiLevel = wikiStation?.levels.find(
                        (entry) => entry.level === level.level,
                    );

                    let itemRequirements: ItemRequirement[] = (level.itemRequirements ?? []).map(
                        (requirement) => {
                            const item = itemsById[requirement.item];
                            if (!item) {
                                throw new Error(
                                    `Tarkov JSON hideout item ${requirement.item} was not found`,
                                );
                            }

                            const attributes = mapAttributes(requirement.attributes);
                            const wikiRequirement = wikiLevel?.requirements.find(
                                (entry) =>
                                    entry.type === "item" &&
                                    entry.name === item.normalizedName,
                            );
                            const quantity = wikiRequirement?.quantity ?? requirement.count ?? 0;
                            const isFir =
                                wikiRequirement?.foundInRaid ??
                                (requiresFoundInRaid as Record<
                                    string,
                                    Record<number, string[]>
                                >)[station.normalizedName]?.[level.level]?.includes(
                                    item.normalizedName,
                                ) ??
                                false;

                            if (
                                isFir &&
                                !attributes.some((attribute) => attribute.name === "found_in_raid")
                            ) {
                                attributes.push({
                                    type: "functional",
                                    name: "found_in_raid",
                                    value: "true",
                                });
                            }

                            return {
                                id: requirement.id,
                                item: {
                                    id: item.id,
                                    name: itemsDataset.translate(item.name),
                                    normalizedName: item.normalizedName,
                                    shortName: itemsDataset.translate(item.shortName),
                                    iconLink: item.iconLink,
                                    gridImageLink: item.gridImageLink,
                                },
                                count: quantity,
                                quantity,
                                attributes,
                            };
                        },
                    );

                    if (wikiLevel) {
                        const allowedItems = new Set(
                            wikiLevel.requirements
                                .filter((entry) => entry.type === "item")
                                .map((entry) => entry.name),
                        );
                        itemRequirements = itemRequirements.filter((requirement) =>
                            allowedItems.has(requirement.item.normalizedName),
                        );
                    }

                    return {
                        id: level.id,
                        level: level.level,
                        constructionTime: level.constructionTime,
                        itemRequirements,
                        stationLevelRequirements: (level.stationLevelRequirements ?? []).map(
                            (requirement) => ({
                                station: {
                                    normalizedName:
                                        stationsById[requirement.station]?.normalizedName ??
                                        requirement.station,
                                },
                                level: requirement.level,
                            }),
                        ),
                        skillRequirements: (level.skillRequirements ?? []).map((requirement) => {
                            const skill = skillsByName.get(requirement.skill);
                            return {
                                name: itemsDataset.translate(requirement.skill),
                                skill: {
                                    name: itemsDataset.translate(skill?.name ?? requirement.skill),
                                    imageLink: skill?.imageLink,
                                },
                                level: requirement.level,
                            };
                        }),
                        traderRequirements: (level.traderRequirements ?? []).map((requirement) => {
                            const trader = tradersById[requirement.trader];
                            return {
                                trader: {
                                    name: tradersDataset.translate(trader?.name ?? requirement.trader),
                                    normalizedName: trader?.normalizedName ?? requirement.trader,
                                    imageLink: trader?.imageLink,
                                },
                                value: requirement.value,
                            };
                        }),
                    };
                }),
            };
        });

        if (stations.length === 0) {
            throw new Error("Tarkov JSON hideout mapping produced no stations");
        }

        const updatedAt = Date.now();
        const localeResults = [
            hideoutDataset.locale,
            itemsDataset.locale,
            tradersDataset.locale,
        ];
        const body: TimedResponse<HideoutStationsPayload> = {
            data: { stations },
            updatedAt,
            diagnostics: {
                provider: "json",
                localePaths: [...new Set(localeResults.map((locale) => locale.resolvedPath))],
                usedRegularLocaleFallback: localeResults.some(
                    (locale) => locale.usedRegularFallback,
                ),
            },
        };
        await redis.mset({
            [bodyKey]: JSON.stringify(body),
            [metaKey]: { updatedAt },
        });
        return body;
    } catch (error) {
        console.error("Failed to refresh hideout stations from Tarkov JSON", error);
        if (cached) {
            console.log("Using stale cached stations due to JSON upstream error");
            return cached;
        }
        throw error;
    }
}

const cachedJsonHideoutStations = unstable_cache(
    getJsonHideoutStations,
    ["json-hideout-stations"],
    { revalidate: false, tags: ["hideout-data"] },
);

export const getCachedJsonHideoutStations = cacheWhenEnabled(
    getJsonHideoutStations,
    cachedJsonHideoutStations,
);
