import { requiresFoundInRaid } from "@/lib/cfg/foundInRaid";
import { wikiData } from "@/lib/data/wiki-data";
import { getGlobalItemList, getGlobalSkillList } from "@/server/services/itemsJson";
import { resolveItemReferences } from "@/server/services/itemReferences";
import {
    resolveHideoutRequirementValues,
    usesReviewedHideoutOverrides,
} from "@/lib/utils/hideout-requirement-overrides";
import {
    fetchTarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import type { HideoutStationsPayload } from "@/types/contracts";
import type { ItemRequirement, Station } from "@/types/hideout";
import type { DataResult } from "@/types/common";

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

export async function getJsonHideoutStations(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<DataResult<HideoutStationsPayload>> {
    try {
        const [hideoutDataset, catalogResponse, skillsDataset, tradersDataset] = await Promise.all([
            fetchTarkovJsonDataset<Record<string, JsonHideoutStation>>("hideout", gameMode),
            getGlobalItemList(gameMode),
            getGlobalSkillList(gameMode),
            fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
        ]);

        const rawStations = Object.values(hideoutDataset.data);
        if (rawStations.length === 0 || catalogResponse.data.items.length === 0) {
            throw new Error("Tarkov JSON hideout response contained no stations or items");
        }

        const stationsById = hideoutDataset.data;
        const tradersById = tradersDataset.data;
        const itemsById = new Map(catalogResponse.data.items.map((item) => [item.id, item]));
        const skillsByName = new Map(
            skillsDataset.data.skills.map((skill) => [skill.id, skill]),
        );

        const stations: Station[] = rawStations.map((station) => {
            const wikiStation = usesReviewedHideoutOverrides(gameMode)
                ? wikiData.find(
                      (entry) => entry.normalizedName === station.normalizedName,
                  )
                : undefined;

            return {
                id: station.id,
                name: hideoutDataset.translate(station.name),
                normalizedName: station.normalizedName,
                imageLink: station.imageLink,
                levels: (station.levels ?? []).map((level) => {
                    const wikiLevel = wikiStation?.levels.find(
                        (entry) => entry.level === level.level,
                    );

                    let itemRequirements: ItemRequirement[] = resolveItemReferences(
                        level.itemRequirements ?? [],
                        itemsById,
                        (requirement) => {
                            console.warn(
                                `Skipping Tarkov JSON hideout requirement ${requirement.id}: item ${requirement.item} was not found in the ${gameMode} catalog`,
                            );
                        },
                    ).map(({ requirement, item }) => {
                        const wikiRequirement = wikiLevel?.requirements.find(
                            (entry) =>
                                entry.type === "item" && entry.name === item.normalizedName,
                        );
                        const upstreamFoundInRaid =
                            requirement.attributes?.foundInRaid === true ||
                            requirement.attributes?.foundInRaid === "true";
                        const values = resolveHideoutRequirementValues({
                            gameMode,
                            upstreamCount: requirement.count ?? 0,
                            upstreamFoundInRaid,
                            reviewedQuantity: wikiRequirement?.quantity,
                            reviewedFoundInRaid: wikiRequirement?.foundInRaid,
                            fallbackFoundInRaid:
                                (requiresFoundInRaid as Record<
                                    string,
                                    Record<number, string[]>
                                >)[station.normalizedName]?.[level.level]?.includes(
                                    item.normalizedName,
                                ) ?? false,
                        });

                        return {
                            id: requirement.id,
                            itemId: item.id,
                            count: values.count,
                            isFir: values.isFir,
                            isTool: requirement.attributes?.tool === true,
                        };
                    });

                    if (wikiLevel) {
                        const allowedItems = new Set(
                            wikiLevel.requirements
                                .filter((entry) => entry.type === "item")
                                .map((entry) => entry.name),
                        );
                        itemRequirements = itemRequirements.filter((requirement) =>
                            allowedItems.has(itemsById.get(requirement.itemId)?.normalizedName ?? ""),
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
                                name: skill?.name ?? requirement.skill,
                                skill: {
                                    name: skill?.name ?? requirement.skill,
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
            ...(skillsDataset.diagnostics?.localePaths ?? []).map((resolvedPath) => ({
                resolvedPath,
                usedRegularFallback:
                    skillsDataset.diagnostics?.usedRegularLocaleFallback ?? false,
            })),
            tradersDataset.locale,
        ];
        const body: DataResult<HideoutStationsPayload> = {
            data: { stations },
            updatedAt,
            diagnostics: {
                provider: "json",
                localePaths: [...new Set(localeResults.map((locale) => locale.resolvedPath))],
                usedRegularLocaleFallback: localeResults.some(
                    (locale) => locale.usedRegularFallback,
                ),
                upstreamStatus: "ok",
            },
        };
        return body;
    } catch (error) {
        console.error("Failed to load hideout stations from Tarkov JSON", error);
        throw error;
    }
}
