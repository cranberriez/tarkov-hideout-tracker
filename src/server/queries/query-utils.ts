import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import type { FullQuest } from "@/types/quests";
import type { BarterRecord, CraftRecord } from "@/types/recipes";

export async function getDefaultRepository(): Promise<TarkovDataRepository> {
    const { tursoTarkovDataRepository } = await import(
        "@/server/repositories/tarkov-data/turso-repository"
    );
    return tursoTarkovDataRepository;
}

export function dedupeIds(ids: Iterable<string>): string[] {
    return [...new Set(ids)];
}

export function getStationItemIds(stations: readonly Station[]): string[] {
    return dedupeIds(
        stations.flatMap((station) =>
            station.levels.flatMap((level) =>
                level.itemRequirements.map((requirement) => requirement.itemId),
            ),
        ),
    );
}

export function getQuestReferencedItemIds(quests: readonly FullQuest[]): string[] {
    const itemIds: string[] = [];

    for (const quest of quests) {
        for (const reward of quest.finishItemRewards ?? []) {
            itemIds.push(reward.itemId);
        }

        for (const objective of quest.objectives) {
            for (const group of objective.requiredKeyIds ?? []) itemIds.push(...group);

            if ("itemIds" in objective && Array.isArray(objective.itemIds)) {
                itemIds.push(...objective.itemIds);
            }
            if ("itemId" in objective && typeof objective.itemId === "string") {
                itemIds.push(objective.itemId);
            }
            if (
                "containsAllItemIds" in objective &&
                Array.isArray(objective.containsAllItemIds)
            ) {
                itemIds.push(...objective.containsAllItemIds);
            }
            if (
                "useAnyItemIds" in objective &&
                Array.isArray(objective.useAnyItemIds)
            ) {
                itemIds.push(...objective.useAnyItemIds);
            }
        }
    }

    return dedupeIds(itemIds);
}

export function getRecipeGraphItemIds(
    barters: readonly BarterRecord[],
    crafts: readonly CraftRecord[],
): string[] {
    const itemIds: string[] = [];
    for (const barter of barters) {
        itemIds.push(barter.offeredItemId);
        itemIds.push(...barter.requiredItems.map((requirement) => requirement.itemId));
    }
    for (const craft of crafts) {
        itemIds.push(craft.productItemId);
        itemIds.push(...craft.requiredItems.map((requirement) => requirement.itemId));
        itemIds.push(
            ...craft.requiredQuestItems.map((requirement) => requirement.itemId),
        );
    }
    return dedupeIds(itemIds);
}

export function mergePricedItems(
    itemIds: readonly string[],
    itemsById: Readonly<Record<string, ItemSummary>>,
    pricesById: Readonly<Record<string, CurrentPrice>>,
): { items: ItemSummary[]; unresolvedItemIds: string[] } {
    const items: ItemSummary[] = [];
    const unresolvedItemIds: string[] = [];

    for (const itemId of itemIds) {
        const item = itemsById[itemId];
        if (!item) {
            unresolvedItemIds.push(itemId);
            continue;
        }
        items.push({ ...item, marketPrice: pricesById[itemId] ?? null });
    }

    return { items, unresolvedItemIds };
}
