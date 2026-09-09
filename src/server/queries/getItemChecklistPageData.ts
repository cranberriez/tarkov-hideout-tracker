import { buildChecklistReferences } from "./checklist-references";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { ItemChecklistPageData } from "@/types/contracts";
import {
    getDefaultRepository,
    mergePricedItems,
} from "./query-utils";

export async function getItemChecklistPageData(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
    options: { includePrices?: boolean } = {},
): Promise<ItemChecklistPageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const [stationsResult, questsResult] = await Promise.allSettled([
        dataRepository.hideout.getStations(mode),
        dataRepository.quests.getAll(mode),
    ]);
    const stations = stationsResult.status === "fulfilled" ? stationsResult.value.data : null;
    const { questItemIndex, questAnyOfGroups, questAvailabilityQuests, itemIds } = buildChecklistReferences(
        mode, stations ?? [], questsResult.status === "fulfilled" ? questsResult.value.data : [],
    );

    if (stationsResult.status === "rejected" && questsResult.status === "rejected") {
        return {
            stations: null,
            items: null,
            itemIds,
            unresolvedItemIds: [],
            questItemIndex,
            questAnyOfGroups,
            questAvailabilityQuests,
            freshness: {
                stationsUpdatedAt: null,
                questsUpdatedAt: null,
                itemsUpdatedAt: null,
                pricesUpdatedAt: null,
            },
            errors: {
                stations: "Hideout station data could not be loaded.",
                quests: "Quest checklist data could not be loaded.",
                items: "Item data could not be loaded without checklist references.",
                prices: "Price data could not be loaded without checklist references.",
            },
        };
    }

    const [itemsResult, pricesResult] = await Promise.allSettled([
        dataRepository.items.getByIds(mode, itemIds),
        options.includePrices === false
            ? Promise.resolve({ data: {}, updatedAt: null })
            : dataRepository.prices.getCurrent(mode, itemIds),
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
        questItemIndex,
        questAnyOfGroups,
        questAvailabilityQuests,
        freshness: {
            stationsUpdatedAt:
                stationsResult.status === "fulfilled"
                    ? stationsResult.value.updatedAt
                    : null,
            questsUpdatedAt:
                questsResult.status === "fulfilled" ? questsResult.value.updatedAt : null,
            itemsUpdatedAt:
                itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
            pricesUpdatedAt:
                pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
        },
        errors: {
            stations:
                stationsResult.status === "rejected"
                    ? "Hideout station data could not be loaded."
                    : null,
            quests:
                questsResult.status === "rejected"
                    ? "Quest checklist data could not be loaded."
                    : null,
            items:
                itemsResult.status === "rejected"
                    ? "Checklist item summaries could not be loaded."
                    : null,
            prices:
                pricesResult.status === "rejected"
                    ? "Checklist item prices could not be loaded."
                    : null,
        },
    };
}
