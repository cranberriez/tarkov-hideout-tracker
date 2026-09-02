import type {
    BarterRecord,
    CraftRecord,
    ItemAcquisitionTreePayload,
} from "@/types";

export function buildItemAcquisitionTree(
    itemId: string,
    bartersByItemId: Readonly<Record<string, BarterRecord[]>>,
    craftsByItemId: Readonly<Record<string, CraftRecord[]>>,
    options: { maxDepth?: number; maxItems?: number } = {},
): ItemAcquisitionTreePayload {
    const maxDepth = options.maxDepth ?? 16;
    const maxItems = options.maxItems ?? 500;
    const visited = new Set<string>();
    const barters = new Map<string, BarterRecord>();
    const crafts = new Map<string, CraftRecord>();
    let truncated = false;

    function visit(currentItemId: string, depth: number) {
        if (visited.has(currentItemId)) return;
        if (depth > maxDepth || visited.size >= maxItems) {
            truncated = true;
            return;
        }
        visited.add(currentItemId);

        for (const barter of bartersByItemId[currentItemId] ?? []) {
            barters.set(barter.id, barter);
            for (const requirement of barter.requiredItems) visit(requirement.itemId, depth + 1);
        }
        for (const craft of craftsByItemId[currentItemId] ?? []) {
            crafts.set(craft.id, craft);
            for (const requirement of craft.requiredItems) visit(requirement.itemId, depth + 1);
        }
    }

    visit(itemId, 0);
    return {
        rootItemId: itemId,
        barters: [...barters.values()],
        crafts: [...crafts.values()],
        itemIds: [...visited],
        truncated,
    };
}
