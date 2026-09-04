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
        },
        errors: {
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
