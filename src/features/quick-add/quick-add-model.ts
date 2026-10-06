import type { PendingItem } from "@/lib/stores/useUIStore";
import type { ItemSummary } from "@/types/items";

/**
 * Add one FiR of a picked item. A repeat pick increments the existing row; a new
 * pick is prepended so it sits next to the search input. Returns the row to focus.
 */
export function addQuickAddPick(items: PendingItem[], item: ItemSummary): { items: PendingItem[]; tempId: string } {
	const existing = items.find((pending) => pending.item.id === item.id);
	if (existing) {
		return {
			items: items.map((pending) => (pending === existing ? { ...pending, fir: pending.fir + 1 } : pending)),
			tempId: existing.tempId,
		};
	}
	const tempId = crypto.randomUUID();
	return { items: [{ tempId, item, nonFir: 0, fir: 1 }, ...items], tempId };
}

export function hasQuickAddCount(pending: PendingItem): boolean {
	return pending.nonFir > 0 || pending.fir > 0;
}
