import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { FullQuest } from "@/types/quests";
import type { KappaChecklistPageData } from "@/types/contracts";
import { getDefaultRepository } from "./query-utils";

export const COLLECTOR_QUEST_ID_BY_MODE: Record<TarkovDataMode, string> = {
    regular: "5c51aac186f77432ea65c552",
    pve: "5c51aac186f77432ea65c552",
    "pvp-season": "5c51aac186f77432ea65c552",
};

function getCollectorRequiredItemIds(collector: Pick<FullQuest, "objectives">): string[] {
    const itemIds = new Set<string>();
    for (const objective of collector.objectives) {
        if (objective.type !== "giveItem" || !("itemIds" in objective)) continue;
        for (const itemId of objective.itemIds) itemIds.add(itemId);
    }

    return [...itemIds];
}

export async function getKappaChecklistPageData(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<KappaChecklistPageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const collectorId = COLLECTOR_QUEST_ID_BY_MODE[mode];
    const questsResult = await Promise.allSettled([
        dataRepository.quests.getByIds(mode, [collectorId]),
    ]).then(([result]) => result);

    if (questsResult.status === "rejected") {
        return {
            collectorQuest: null,
            items: [],
            unresolvedItemIds: [],
            freshness: {
                questsUpdatedAt: null,
                itemsUpdatedAt: null,
                pricesUpdatedAt: null,
            },
            errors: {
                quests: "Collector quest data could not be loaded.",
                items: null,
                prices: null,
            },
        };
    }

    const collectorQuest = questsResult.value.data[collectorId] ?? null;
    const itemIds = collectorQuest ? getCollectorRequiredItemIds(collectorQuest) : [];
    const [itemsResult, pricesResult] = await Promise.allSettled([
        dataRepository.items.getByIds(mode, itemIds),
        dataRepository.prices.getCurrent(mode, itemIds),
    ]);
    const itemsById = itemsResult.status === "fulfilled" ? itemsResult.value.data : {};
    const pricesById = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};

    const unresolvedItemIds = itemIds.filter((itemId) => !itemsById[itemId]);
    const items = itemIds.flatMap((itemId) => {
        const item = itemsById[itemId];
        if (!item) return [];
        return [
            {
                ...item,
                marketPrice: pricesById[itemId] ?? null,
            },
        ];
    });

    return {
        collectorQuest: collectorQuest
            ? {
                  id: collectorQuest.id,
                  name: collectorQuest.name,
                  traderImageLink: collectorQuest.trader.imageLink,
                  traderImage4xLink: collectorQuest.trader.image4xLink,
              }
            : null,
        items,
        unresolvedItemIds,
        freshness: {
            questsUpdatedAt: questsResult.value.updatedAt,
            itemsUpdatedAt:
                itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
            pricesUpdatedAt:
                pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
        },
        errors: {
            quests: null,
            items:
                itemsResult.status === "rejected"
                    ? "Collector item summaries could not be loaded."
                    : null,
            prices:
                pricesResult.status === "rejected"
                    ? "Collector item prices could not be loaded."
                    : null,
        },
    };
}
