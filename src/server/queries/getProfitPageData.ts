import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { ProfitPageData } from "@/types/contracts";
import {
    dedupeIds,
    getDefaultRepository,
    getRecipeGraphItemIds,
    mergePricedItems,
} from "./query-utils";

export async function getProfitPageData(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<ProfitPageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const [bartersResult, craftsResult] = await Promise.allSettled([
        dataRepository.recipes.getBarters(mode),
        dataRepository.recipes.getCrafts(mode),
    ]);
    const barters = bartersResult.status === "fulfilled" ? bartersResult.value.data : [];
    const crafts = craftsResult.status === "fulfilled" ? craftsResult.value.data : [];
    const itemIds = getRecipeGraphItemIds(barters, crafts);
    const barterTraderIds = dedupeIds(barters.map((barter) => barter.traderId));
    const stationIds = new Set(crafts.map((craft) => craft.stationId));

    const [itemsResult, pricesResult, tradersResult, stationsResult] =
        await Promise.allSettled([
            dataRepository.items.getByIds(mode, itemIds),
            dataRepository.prices.getCurrent(mode, itemIds),
            // The catalog is small. Loading it beside items avoids a follow-up read
            // after buyFromTrader offer IDs are known, then we serialize only the
            // traders referenced by the recipe graph.
            dataRepository.traders.getAll(mode),
            stationIds.size > 0
                ? dataRepository.hideout.getStations(mode)
                : Promise.resolve(null),
        ]);
    const itemRecords = itemsResult.status === "fulfilled" ? itemsResult.value.data : null;
    // Unlock requirements come from the recipes/offers; only resolve their labels
    // by known ID. Never scan quest rewards to infer acquisition eligibility.
    const taskUnlockIds = dedupeIds([
        ...barters.flatMap((recipe) => recipe.taskUnlockId ? [recipe.taskUnlockId] : []),
        ...crafts.flatMap((recipe) => recipe.taskUnlockId ? [recipe.taskUnlockId] : []),
        ...Object.values(itemRecords ?? {}).flatMap((item) =>
            (item.buyFromTrader ?? []).flatMap((offer) => offer.taskUnlockId ? [offer.taskUnlockId] : []),
        ),
    ]);
    const [taskUnlocksResult] = await Promise.allSettled([
        taskUnlockIds.length ? dataRepository.quests.getByIds(mode, taskUnlockIds) : Promise.resolve(null),
    ]);
    const taskUnlocksValue = taskUnlocksResult.status === "fulfilled" ? taskUnlocksResult.value : null;
    const taskUnlocksById = Object.fromEntries(taskUnlockIds.flatMap((id) => {
        const quest = taskUnlocksValue?.data[id];
        return quest ? [[id, { id, name: quest.name, wikiLink: quest.wikiLink }]] : [];
    }));
    const unresolvedTaskUnlockIds = taskUnlockIds.filter((id) => !taskUnlocksById[id]);
    const priceRecords = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};
    const merged = itemRecords
        ? mergePricedItems(itemIds, itemRecords, priceRecords)
        : { items: null, unresolvedItemIds: [...itemIds] };
    const tradersValue = tradersResult.status === "fulfilled" ? tradersResult.value : null;
    const stationsValue = stationsResult.status === "fulfilled" ? stationsResult.value : null;
    const traderIds = new Set([
        ...barterTraderIds,
        ...(merged.items ?? []).flatMap((item) =>
            (item.buyFromTrader ?? []).map((offer) => offer.traderId),
        ),
    ]);
    const traders = tradersValue
        ? tradersValue.data.filter((trader) => traderIds.has(trader.id))
        : [];
    const stations = stationsValue
        ? stationsValue.data
              .filter((station) => stationIds.has(station.id))
              .map(({ id, name, normalizedName, imageLink }) => ({
                  id,
                  name,
                  normalizedName,
                  imageLink,
              }))
        : [];

    return {
        barters,
        crafts,
        items: merged.items,
        itemIds,
        unresolvedItemIds: merged.unresolvedItemIds,
        traders,
        stations,
        taskUnlocksById,
        unresolvedTaskUnlockIds,
        freshness: {
            bartersUpdatedAt:
                bartersResult.status === "fulfilled"
                    ? bartersResult.value.updatedAt
                    : null,
            craftsUpdatedAt:
                craftsResult.status === "fulfilled" ? craftsResult.value.updatedAt : null,
            itemsUpdatedAt:
                itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
            pricesUpdatedAt:
                pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
            tradersUpdatedAt: tradersValue?.updatedAt ?? null,
            stationsUpdatedAt: stationsValue?.updatedAt ?? null,
            taskUnlocksUpdatedAt: taskUnlocksValue?.updatedAt ?? null,
        },
        errors: {
            taskUnlocks: taskUnlocksResult.status === "rejected"
                ? "Quest names could not be loaded. Unlock requirements still apply."
                : unresolvedTaskUnlockIds.length ? "Some quest names are unavailable. Unlock requirements still apply." : null,
            barters:
                bartersResult.status === "rejected"
                    ? "Barter data could not be loaded."
                    : null,
            crafts:
                craftsResult.status === "rejected"
                    ? "Craft data could not be loaded."
                    : null,
            items:
                itemsResult.status === "rejected"
                    ? "Recipe item summaries could not be loaded."
                    : null,
            prices:
                pricesResult.status === "rejected"
                    ? "Recipe item prices could not be loaded."
                    : null,
            traders:
                tradersResult.status === "rejected"
                    ? "Trader source data could not be loaded."
                    : null,
            stations:
                stationsResult.status === "rejected"
                    ? "Hideout station source data could not be loaded."
                    : null,
        },
    };
}
