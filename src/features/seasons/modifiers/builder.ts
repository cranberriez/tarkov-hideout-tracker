/**
 * Personal modifier builder totals. A character starts at 0 points: negatives grant points,
 * positives spend them, and a build is valid while the balance stays at 0 or above.
 * `points` uses the posters' sign (positives negative, negatives positive).
 */
export type BuilderTotals = {
	granted: number;
	spent: number;
	balance: number;
	valid: boolean;
	count: number;
};

export function builderTotals(selected: Iterable<string>, points: Record<string, number>): BuilderTotals {
	let granted = 0;
	let spent = 0;
	let count = 0;
	for (const id of selected) {
		const value = points[id];
		if (value === undefined) continue;
		count++;
		if (value > 0) granted += value;
		else spent -= value;
	}
	const balance = granted - spent;
	return { granted, spent, balance, valid: balance >= 0, count };
}
