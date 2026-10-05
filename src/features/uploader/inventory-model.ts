import type { SummaryRow } from "./summary-model";

export type SentCounts = Record<string, { have: number; haveFir: number }>;

/** Additive deltas for this scan; `sent` makes repeated or widening sends add only the difference. */
export function planUploaderInventory(rows: readonly SummaryRow[], sent: SentCounts, keptOnly: boolean) {
	const targets = new Map<string, { have: number; haveFir: number }>();
	let unknown = 0;
	for (const row of rows) {
		if (keptOnly && row.category !== "keep") continue;
		if (row.foundInRaid === "unknown") {
			unknown += row.quantity;
			continue;
		}
		const target = targets.get(row.item.id) ?? { have: 0, haveFir: 0 };
		if (row.foundInRaid === "yes") target.haveFir += row.quantity;
		else target.have += row.quantity;
		targets.set(row.item.id, target);
	}
	const deltas = [...targets]
		.map(([itemId, target]) => ({
			itemId,
			have: Math.max(0, target.have - (sent[itemId]?.have ?? 0)),
			haveFir: Math.max(0, target.haveFir - (sent[itemId]?.haveFir ?? 0)),
		}))
		.filter((delta) => delta.have > 0 || delta.haveFir > 0);
	return { deltas, unknown, units: deltas.reduce((total, delta) => total + delta.have + delta.haveFir, 0) };
}

/** Saved inventory as it was before this scan's sends. */
export function inventoryBeforeSends(counts: SentCounts, sent: SentCounts): SentCounts {
	const result = { ...counts };
	for (const [itemId, amount] of Object.entries(sent)) {
		const current = counts[itemId] ?? { have: 0, haveFir: 0 };
		result[itemId] = { have: current.have - amount.have, haveFir: current.haveFir - amount.haveFir };
	}
	return result;
}
