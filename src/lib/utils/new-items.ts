import type { ItemSummary } from "@/types/items";

export const NEW_ITEM_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;

export function isNewItem(item: Pick<ItemSummary, "firstSeenAt" | "firstSeenPatch">, now = Date.now()): boolean {
	const timestamp = item.firstSeenAt;
	return (
		item.firstSeenPatch !== "pre-1.1.5" &&
		typeof timestamp === "number" &&
		Number.isFinite(timestamp) &&
		timestamp > 0 &&
		now >= timestamp &&
		now - timestamp < NEW_ITEM_WINDOW_MS
	);
}
