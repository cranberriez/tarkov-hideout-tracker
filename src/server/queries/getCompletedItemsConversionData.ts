import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { CompletedItemsConversionData } from "@/types/contracts";
import { dedupeIds, getDefaultRepository, getStationItemIds } from "./query-utils";

export async function getCompletedItemsConversionData(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<CompletedItemsConversionData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const stationsResult = await Promise.allSettled([
        dataRepository.hideout.getStations(mode),
    ]).then(([result]) => result);
    const stations =
        stationsResult.status === "fulfilled" ? stationsResult.value.data : [];
    const itemIds = dedupeIds(getStationItemIds(stations));
    const itemsResult =
        itemIds.length > 0
            ? await Promise.allSettled([dataRepository.items.getByIds(mode, itemIds)]).then(
                  ([result]) => result,
              )
            : null;
    const itemsById =
        itemsResult?.status === "fulfilled" ? itemsResult.value.data : {};

    return {
        stations: stations.map((station) => ({
            id: station.id,
            levels: station.levels.map((level) => ({
                level: level.level,
                itemRequirements: level.itemRequirements.map((requirement) => ({
                    id: requirement.id,
                    itemId: requirement.itemId,
                    count: requirement.count,
                    isFir: requirement.isFir,
                })),
            })),
        })),
        items: itemIds.flatMap((itemId) =>
            itemsById[itemId]
                ? [
                      {
                          id: itemsById[itemId].id,
                          name: itemsById[itemId].name,
                          normalizedName: itemsById[itemId].normalizedName,
                      },
                  ]
                : [],
        ),
        unresolvedItemIds: itemIds.filter((itemId) => !itemsById[itemId]),
        freshness: {
            stationsUpdatedAt:
                stationsResult.status === "fulfilled"
                    ? stationsResult.value.updatedAt
                    : null,
            itemsUpdatedAt:
                itemsResult?.status === "fulfilled" ? itemsResult.value.updatedAt : null,
        },
        errors: {
            stations:
                stationsResult.status === "rejected"
                    ? "Hideout station data could not be loaded."
                    : null,
            items:
                itemsResult?.status === "rejected"
                    ? "Hideout item names could not be loaded."
                    : null,
        },
    };
}
