import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { ItemUsageData } from "@/types/contracts";
import { dedupeIds, getDefaultRepository, getRecipeGraphItemIds, mergePricedItems } from "./query-utils";

function sourceError(domain: string) {
    return `${domain} data is temporarily unavailable`;
}

export async function getItemUsageData(
    itemId: string,
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<ItemUsageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const [bartersResult, craftsResult] = await Promise.allSettled([
        dataRepository.recipes.getBarters(mode),
        dataRepository.recipes.getCrafts(mode),
    ]);
    const allBarters = bartersResult.status === "fulfilled" ? bartersResult.value.data : [];
    const allCrafts = craftsResult.status === "fulfilled" ? craftsResult.value.data : [];
    const barters = allBarters.filter((barter) => barter.offeredItemId === itemId);
    const crafts = allCrafts.filter((craft) => craft.productItemId === itemId);
    const itemIds = dedupeIds([itemId, ...getRecipeGraphItemIds(barters, crafts)]);
    const stationIds = dedupeIds(crafts.map((craft) => craft.stationId));
    const recipeTaskUnlockIds = dedupeIds([
        ...barters.flatMap((barter) =>
            barter.taskUnlockId ? [barter.taskUnlockId] : [],
        ),
        ...crafts.flatMap((craft) =>
            craft.taskUnlockId ? [craft.taskUnlockId] : [],
        ),
    ]);

    const [itemsResult, pricesResult, stationsResult] =
        await Promise.allSettled([
            dataRepository.items.getByIds(mode, itemIds),
            dataRepository.prices.getCurrent(mode, itemIds),
            stationIds.length > 0
                ? dataRepository.hideout.getStations(mode)
                : Promise.resolve(null),
        ]);
    const itemRecords = itemsResult.status === "fulfilled" ? itemsResult.value.data : null;
    const purchaseOffers = itemRecords?.[itemId]?.buyFromTrader ?? [];
    const traderIds = dedupeIds([
        ...barters.map((barter) => barter.traderId),
        ...purchaseOffers.map((offer) => offer.traderId),
    ]);
    const taskUnlockIds = dedupeIds([
        ...recipeTaskUnlockIds,
        ...purchaseOffers.flatMap((offer) =>
            offer.taskUnlockId ? [offer.taskUnlockId] : [],
        ),
    ]);
    const [tradersResult, taskUnlocksResult] = await Promise.allSettled([
        traderIds.length > 0
            ? dataRepository.traders.getByIds(mode, traderIds)
            : Promise.resolve(null),
        taskUnlockIds.length > 0
            ? dataRepository.quests.getByIds(mode, taskUnlockIds)
            : Promise.resolve(null),
    ]);
    const priceRecords = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};
    const merged = itemRecords
        ? mergePricedItems(itemIds, itemRecords, priceRecords)
        : { items: [], unresolvedItemIds: [...itemIds] };
    const tradersValue = tradersResult.status === "fulfilled" ? tradersResult.value : null;
    const taskUnlocksValue =
        taskUnlocksResult.status === "fulfilled" ? taskUnlocksResult.value : null;
    const stationsValue =
        stationsResult.status === "fulfilled" ? stationsResult.value : null;
    const presentationFailed =
        (traderIds.length > 0 && tradersResult.status === "rejected") ||
        (taskUnlockIds.length > 0 && taskUnlocksResult.status === "rejected") ||
        (stationIds.length > 0 && stationsResult.status === "rejected");

    return {
        barters,
        crafts,
        items: merged.items,
        itemIds,
        unresolvedItemIds: merged.unresolvedItemIds,
        tradersById: tradersValue
            ? Object.fromEntries(
                  traderIds.flatMap((traderId) => {
                      const trader = tradersValue.data[traderId];
                      return trader ? [[traderId, trader]] : [];
                  }),
              )
            : {},
        taskUnlocksById: taskUnlocksValue
            ? Object.fromEntries(
                  taskUnlockIds.flatMap((questId) => {
                      const quest = taskUnlocksValue.data[questId];
                      return quest
                          ? [
                                [
                                    quest.id,
                                    {
                                        id: quest.id,
                                        name: quest.name,
                                        wikiLink: quest.wikiLink,
                                    },
                                ],
                            ]
                          : [];
                  }),
              )
            : {},
        stationsById: stationsValue
            ? Object.fromEntries(
                  stationsValue.data.flatMap((station) =>
                      stationIds.includes(station.id)
                          ? [
                                [
                                    station.id,
                                    {
                                        id: station.id,
                                        name: station.name,
                                        normalizedName: station.normalizedName,
                                        ...(station.imageLink
                                            ? { imageLink: station.imageLink }
                                            : {}),
                                    },
                                ],
                            ]
                          : [],
                  ),
              )
            : {},
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
            taskUnlocksUpdatedAt: taskUnlocksValue?.updatedAt ?? null,
            stationsUpdatedAt: stationsValue?.updatedAt ?? null,
        },
        ...(bartersResult.status === "rejected"
            ? { bartersError: sourceError("Barter") }
            : {}),
        ...(craftsResult.status === "rejected"
            ? { craftsError: sourceError("Craft") }
            : {}),
        ...(itemsResult.status === "rejected"
            ? { itemsError: sourceError("Recipe item") }
            : {}),
        ...(pricesResult.status === "rejected"
            ? { pricesError: sourceError("Recipe price") }
            : {}),
        ...(presentationFailed
            ? { presentationError: "Acquisition labels are temporarily unavailable" }
            : {}),
    };
}
