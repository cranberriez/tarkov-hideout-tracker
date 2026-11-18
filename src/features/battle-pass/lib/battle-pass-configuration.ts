import type { Costs, Tile } from "./battle-pass-model";

export type CostEntry = { key: string; quantity: string };
export type RewardConfiguration = Record<string, CostEntry[]>;

function object(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function decode(raw: string | null) {
	try {
		return object(JSON.parse(raw ?? "{}"));
	} catch {
		return {};
	}
}
export function parseConfiguration(raw: string | null): RewardConfiguration {
	return Object.fromEntries(
		Object.entries(object(decode(raw).rewards)).flatMap(([id, entries]) =>
			Array.isArray(entries)
				? [
						[
							id,
							entries.map((entry) => {
								const value = object(entry);
								return {
									key: typeof value.key === "string" ? value.key : "",
									quantity: typeof value.quantity === "string" ? value.quantity : "",
								};
							}),
						],
					]
				: [],
		),
	);
}

export function rewardCostStatus(tile: Tile, entries: CostEntry[] | undefined, documentKeys: string[]) {
	const requiredTypes = Object.keys(tile.cost).length;
	const slots = entries ?? [];
	const validEntries = slots.filter(
		({ key, quantity }) =>
			documentKeys.includes(key) && /^[1-9]\d*$/.test(quantity) && Number.isSafeInteger(Number(quantity)),
	);
	const total = validEntries.reduce((sum, entry) => sum + Number(entry.quantity), 0);
	const distinct = new Set(validEntries.map((entry) => entry.key)).size;
	const selectedKeys = slots.map((entry) => entry.key).filter(Boolean);
	const duplicateTypes = new Set(selectedKeys).size !== selectedKeys.length;
	const enteredTotal = slots.reduce(
		(sum, entry) => sum + (/^\d+$/.test(entry.quantity) ? Number(entry.quantity) : 0),
		0,
	);
	const errors = [
		...(duplicateTypes ? ["Duplicate document types"] : []),
		...(enteredTotal > tile.totalDocumentCost ? ["Too many documents"] : []),
	];
	const valid =
		slots.length === requiredTypes &&
		validEntries.length === requiredTypes &&
		distinct === requiredTypes &&
		total === tile.totalDocumentCost;
	return {
		errors,
		valid,
		requiredTypes,
		distinct,
		total,
		costs: valid ? (Object.fromEntries(slots.map(({ key, quantity }) => [key, Number(quantity)])) as Costs) : null,
	};
}

export function configuredPlan(
	required: Tile[],
	configuration: RewardConfiguration,
	documentKeys: string[],
	unresolvedIds: string[] = [],
) {
	const missingIds: string[] = [];
	const costs: Costs = {};
	for (const tile of required) {
		const status = rewardCostStatus(tile, configuration[tile.id], documentKeys);
		if (!status.costs) missingIds.push(tile.id);
		else for (const [key, amount] of Object.entries(status.costs)) costs[key] = (costs[key] ?? 0) + amount;
	}
	const ready = missingIds.length === 0 && unresolvedIds.length === 0;
	return { ready, missingIds, costs: ready ? costs : null };
}

/** Merge only edited rewards into the latest save. Never replace concurrent edits silently. */
export function mergeConfiguration(raw: string | null, baseline: RewardConfiguration, draft: RewardConfiguration) {
	const root = decode(raw);
	const current = parseConfiguration(raw);
	const rewards = { ...object(root.rewards) };
	for (const id of new Set([...Object.keys(baseline), ...Object.keys(draft)])) {
		const before = JSON.stringify(baseline[id]);
		const after = JSON.stringify(draft[id]);
		if (before === after) continue;
		if (JSON.stringify(current[id]) !== before && JSON.stringify(current[id]) !== after)
			throw new Error("These reward costs changed in another tab. Cancel and reopen setup to load the latest costs.");
		if (draft[id]) rewards[id] = draft[id];
		else delete rewards[id];
	}
	return JSON.stringify({ version: 1, ...root, rewards });
}
