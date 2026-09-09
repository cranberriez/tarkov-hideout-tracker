import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry } from "@/lib/utils/quest-item-index";

export function matchesChecklistSearch(item: ItemSummary | undefined, query: string): boolean {
    if (!item) return false;
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const text =
        `${item.name} ${item.shortName ?? ""} ${item.normalizedName ?? ""}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
}

/** Source membership is independent of player progress and display filters. */
export function buildChecklistSearchIds(
    stations: readonly Station[],
    questItems: readonly QuestItemIndexEntry[],
    questGroups: readonly QuestAnyOfGroupEntry[],
    source: "all" | "hideout" | "quest",
): Set<string> {
    const ids = new Set<string>();
    if (source !== "quest") {
        for (const station of stations)
            for (const level of station.levels) {
                for (const requirement of level.itemRequirements) ids.add(requirement.itemId);
            }
    }
    if (source !== "hideout") {
        for (const item of questItems) ids.add(item.itemId);
        for (const group of questGroups) for (const id of group.itemIds) ids.add(id);
    }
    return ids;
}

export function findOutsideFilterMatches({
    query,
    sourceIds,
    visibleIds,
    itemById,
}: {
    query: string;
    sourceIds: ReadonlySet<string>;
    visibleIds: ReadonlySet<string>;
    itemById: Readonly<Record<string, ItemSummary>>;
}): { items: ItemSummary[]; missingIds: string[] } {
    if (!query.trim()) return { items: [], missingIds: [] };
    const items: ItemSummary[] = [];
    const missingIds: string[] = [];
    for (const id of sourceIds) {
        const item = itemById[id];
        if (!item) missingIds.push(id);
        else if (!visibleIds.has(id) && matchesChecklistSearch(item, query)) items.push(item);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return { items, missingIds };
}
