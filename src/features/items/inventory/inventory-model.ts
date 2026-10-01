import type { ItemSummary } from "@/types/items";

export type InventoryCounts = Record<string, { have: number; haveFir: number }>;
export type InventorySort = "name" | "total";

export interface InventoryRow {
	id: string;
	/** Null when the saved ID is missing from the current release; the row stays editable. */
	item: ItemSummary | null;
	nonFir: number;
	fir: number;
}

/**
 * Rows for every nonzero balance (including negative ones) plus `keptIds`, so rows
 * edited down to zero stay visible until the page is left.
 */
export function buildInventoryRows(
	counts: InventoryCounts,
	keptIds: ReadonlySet<string>,
	itemsById: ReadonlyMap<string, ItemSummary>,
): InventoryRow[] {
	const ids = new Set(keptIds);
	for (const [id, { have, haveFir }] of Object.entries(counts)) if (have !== 0 || haveFir !== 0) ids.add(id);
	return [...ids].map((id) => ({
		id,
		item: itemsById.get(id) ?? null,
		nonFir: counts[id]?.have ?? 0,
		fir: counts[id]?.haveFir ?? 0,
	}));
}

/**
 * `orderCounts` is a snapshot taken when the count sort was chosen, so editing a row
 * does not move it out from under the pointer. Rows absent from it use live counts.
 */
export function filterAndSortInventoryRows(
	rows: InventoryRow[],
	query: string,
	sort: InventorySort,
	orderCounts: InventoryCounts,
): InventoryRow[] {
	const needle = query.trim().toLowerCase();
	const filtered = needle
		? rows.filter(({ id, item }) =>
				[item?.name, item?.shortName, item ? undefined : id].some((text) => text?.toLowerCase().includes(needle)),
			)
		: rows;
	const total = (row: InventoryRow) => {
		const snapshot = orderCounts[row.id];
		return snapshot ? snapshot.have + snapshot.haveFir : row.fir + row.nonFir;
	};
	// Unknown items sort after named ones.
	const byName = (a: InventoryRow, b: InventoryRow) =>
		Number(!a.item) - Number(!b.item) || (a.item?.name ?? a.id).localeCompare(b.item?.name ?? b.id);
	return [...filtered].sort(sort === "total" ? (a, b) => total(b) - total(a) || byName(a, b) : byName);
}
