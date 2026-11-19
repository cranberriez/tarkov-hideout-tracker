import { normalizeCount, type Costs } from "./battle-pass-model";

/** What one recorded claim removed, so unclaiming can put it back. */
export interface ClaimDeduction {
	profileKey: string;
	/** Ordinary documents removed from the profile, by document key. */
	documents: Costs;
	/** Classified documents removed from the shared balance. */
	classified: number;
}
export type ClaimDeductions = Record<string, ClaimDeduction>;

/** One reward in the claim modal. */
export interface ClaimRow {
	rewardId: string;
	/** Claiming profile; documents come from this profile's inventory. */
	profileKey: string;
	profileLabel: string;
	/** Configured cost, or null when the reward has no valid cost (recorded without deducting). */
	cost: Costs | null;
	/** Ordinary documents the player should have for each cost line (0..cost). */
	expected: Costs;
	/** Position in the saved plan's claim order (1-based), or null when not planned. */
	planIndex: number | null;
}

export interface ClaimOutcome {
	/** Profile inventories after the claims, for every profile a claim touched. */
	inventories: Record<string, Costs>;
	classified: number;
	/** Classified documents needed beyond the balance; claims are blocked while positive. */
	classifiedShort: number;
	deductions: ClaimDeductions;
}

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Read stored deductions; malformed entries are skipped, never rewritten on read. */
export function parseClaimDeductions(raw: string | null): ClaimDeductions {
	let value: Record<string, unknown> = {};
	try {
		value = record(record(JSON.parse(raw ?? "null")).claimDeductions);
	} catch {
		return {};
	}
	const result: ClaimDeductions = {};
	for (const [rewardId, entry] of Object.entries(value)) {
		const raw = record(entry);
		if (typeof raw.profileKey !== "string") continue;
		result[rewardId] = {
			profileKey: raw.profileKey,
			documents: Object.fromEntries(
				Object.entries(record(raw.documents))
					.map(([key, amount]) => [key, normalizeCount(amount)] as const)
					.filter(([, amount]) => amount > 0),
			),
			classified: normalizeCount(raw.classified),
		};
	}
	return result;
}

/** The game consumes every owned document of a cost line and classified documents fill only what is missing.
 * Rows run in order against the same stock. */
export function applyClaims(
	rows: (ClaimRow & { have: Costs })[],
	inventories: Record<string, Costs>,
	classifiedBalance: number,
): ClaimOutcome {
	const stock: Record<string, Costs> = {};
	let classifiedNeeded = 0;
	const deductions: ClaimDeductions = {};
	for (const row of rows) {
		if (!row.cost) continue;
		const owned = (stock[row.profileKey] ??= { ...(inventories[row.profileKey] ?? {}) });
		const documents: Costs = {};
		let missing = 0;
		for (const [key, amount] of Object.entries(row.cost)) {
			const have = Math.min(amount, normalizeCount(row.have[key]));
			const before = owned[key] ?? 0;
			// Having fewer than the cost means the player had exactly that many, all spent.
			const after = have < amount ? 0 : Math.max(0, before - amount);
			owned[key] = after;
			if (before > after) documents[key] = before - after;
			missing += amount - have;
		}
		classifiedNeeded += missing;
		deductions[row.rewardId] = { profileKey: row.profileKey, documents, classified: missing };
	}
	const balance = normalizeCount(classifiedBalance);
	return {
		inventories: stock,
		classified: Math.max(0, balance - classifiedNeeded),
		classifiedShort: Math.max(0, classifiedNeeded - balance),
		deductions,
	};
}

/** Classified documents a row needs for the entered amounts. */
export function rowClassified(row: ClaimRow, have: Costs) {
	if (!row.cost) return 0;
	return Object.entries(row.cost).reduce(
		(sum, [key, amount]) => sum + amount - Math.min(amount, normalizeCount(have[key])),
		0,
	);
}
