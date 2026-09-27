import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { ItemAcquisitionTreeData, ItemRelationsPayload, ItemUsageData } from "@/types/contracts";

export interface ItemDetailViews {
    relations: ItemRelationsPayload | null;
    usage: ItemUsageData | null;
    tree: ItemAcquisitionTreeData | null;
}

export interface ItemDetailViewReaders {
    relations: (mode: TarkovJsonGameMode, itemId: string) => Promise<ItemRelationsPayload>;
    usage: (mode: TarkovJsonGameMode, itemId: string) => Promise<ItemUsageData>;
    tree: (mode: TarkovJsonGameMode, itemId: string) => Promise<ItemAcquisitionTreeData>;
}

// Loaded lazily: the stored-view module is server-only, and tests inject readers.
const storedViews = () => import("../db/item-views");
const storedViewReaders: ItemDetailViewReaders = {
    relations: async (mode, itemId) => (await storedViews()).getItemRelationsView(mode, itemId, false),
    usage: async (mode, itemId) => (await storedViews()).getItemUsageView(mode, itemId, false),
    tree: async (mode, itemId) => (await storedViews()).getItemAcquisitionView(mode, itemId, false),
};

/**
 * Unpriced relations (hideout/quests), usage (trades/crafts), and acquisition views for
 * server rendering an item. These are the same stored views the item API routes serve.
 * A failed view is `null`: the client query retries it and reports its own error.
 * Profile-dependent status is never computed here.
 */
export async function getItemDetailViews(
    mode: TarkovJsonGameMode,
    itemId: string,
    readers: ItemDetailViewReaders = storedViewReaders,
): Promise<ItemDetailViews> {
    const [relations, usage, tree] = await Promise.allSettled([
        readers.relations(mode, itemId),
        readers.usage(mode, itemId),
        readers.tree(mode, itemId),
    ]);
    return {
        relations: relations.status === "fulfilled" ? relations.value : null,
        usage: usage.status === "fulfilled" ? usage.value : null,
        tree: tree.status === "fulfilled" ? tree.value : null,
    };
}
