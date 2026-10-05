import type { SummaryRow } from "./summary-model";

export function planUploaderInventory(
	rows: readonly SummaryRow[],
	existing: Record<string, { have: number; haveFir: number }>,
	requiredOnly: boolean,
) {
	const targets = new Map<string, { have: number; haveFir: number }>();
	let unknown = 0;
	for (const row of rows) {
		if (requiredOnly && row.category !== "save" && row.category !== "needed") continue;
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
			have: target.have > 0 ? Math.max(0, target.have - (existing[itemId]?.have ?? 0)) : 0,
			haveFir: target.haveFir > 0 ? Math.max(0, target.haveFir - (existing[itemId]?.haveFir ?? 0)) : 0,
		}))
		.filter((delta) => delta.have > 0 || delta.haveFir > 0);
	return { deltas, unknown, units: deltas.reduce((total, delta) => total + delta.have + delta.haveFir, 0) };
}
