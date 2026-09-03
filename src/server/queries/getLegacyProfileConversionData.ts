import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { LegacyProfileConversionData } from "@/types/contracts";
import { getDefaultRepository } from "./query-utils";

export async function getLegacyProfileConversionData(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<LegacyProfileConversionData> {
    const dataRepository = repository ?? (await getDefaultRepository());

    try {
        const result = await dataRepository.hideout.getStations(mode);
        return {
            stations: result.data.map((station) => ({
                id: station.id,
                name: station.name,
                maxLevel: station.levels.reduce(
                    (highest, level) => Math.max(highest, level.level),
                    0,
                ),
            })),
            freshness: { stationsUpdatedAt: result.updatedAt },
            errors: { stations: null },
        };
    } catch {
        return {
            stations: [],
            freshness: { stationsUpdatedAt: null },
            errors: { stations: "Hideout station details could not be loaded." },
        };
    }
}
