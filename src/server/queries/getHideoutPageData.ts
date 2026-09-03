import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { HideoutPageData } from "@/types/contracts";
import {
    getDefaultRepository,
    getStationItemIds,
    mergePricedItems,
} from "./query-utils";

export async function getHideoutPageData(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<HideoutPageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const stationsResult = await Promise.allSettled([
        dataRepository.hideout.getStations(mode),
    ]).then(([result]) => result);

    if (stationsResult.status === "rejected") {
        return {
            stations: null,
            items: null,
            itemIds: [],
            unresolvedItemIds: [],
            freshness: {
                stationsUpdatedAt: null,
                itemsUpdatedAt: null,
                pricesUpdatedAt: null,
            },
            errors: {
                stations: "Hideout station data could not be loaded.",
                items: "Item data could not be loaded without hideout stations.",
                prices: "Price data could not be loaded without hideout stations.",
            },
        };
    }

    const stations = stationsResult.value.data;
    const itemIds = getStationItemIds(stations);
    const [itemsResult, pricesResult] = await Promise.allSettled([
        dataRepository.items.getByIds(mode, itemIds),
        dataRepository.prices.getCurrent(mode, itemIds),
    ]);
    const itemRecords = itemsResult.status === "fulfilled" ? itemsResult.value.data : null;
    const priceRecords = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};
    const merged = itemRecords
        ? mergePricedItems(itemIds, itemRecords, priceRecords)
        : { items: null, unresolvedItemIds: [...itemIds] };

    return {
        stations,
        items: merged.items,
        itemIds,
        unresolvedItemIds: merged.unresolvedItemIds,
        freshness: {
            stationsUpdatedAt: stationsResult.value.updatedAt,
            itemsUpdatedAt:
                itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
            pricesUpdatedAt:
                pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
        },
        errors: {
            stations: null,
            items:
                itemsResult.status === "rejected"
                    ? "Hideout item summaries could not be loaded."
                    : null,
            prices:
                pricesResult.status === "rejected"
                    ? "Hideout item prices could not be loaded."
                    : null,
        },
    };
}
