import { configuredPlan, type RewardConfiguration } from "./battle-pass-configuration";
import { coverCosts, type Progress, type Tile } from "./battle-pass-model";
import { itemCountChange, profileDocumentCounts, type PlayerItemCounts } from "./battle-pass-inventory";

/** Only verified, newly claimed rewards can debit inventory. Unclaiming never refunds stock. */
export function prepareDocumentClaim(
	stored: Progress,
	counts: PlayerItemCounts,
	ids: string[],
	tiles: Tile[],
	configuration: RewardConfiguration,
	itemIds: Readonly<Record<string, string>>,
	consume: boolean,
	useClassified: boolean,
) {
	const requested = new Set(ids);
	const added = tiles.filter((tile) => requested.has(tile.id) && !stored.completed.includes(tile.id));
	const progress = { ...stored, completed: [...stored.completed, ...added.map((tile) => tile.id)] };
	const keys = Object.keys(itemIds);
	const plan = configuredPlan(added, configuration, keys);
	if (!consume || !plan.ready) return { progress, changes: [], unconfigured: consume ? plan.missingIds : [] };
	const coverage = coverCosts(
		plan.costs!,
		profileDocumentCounts(counts, itemIds),
		stored.classified,
		useClassified,
		stored.avoidedDocuments,
		keys,
	);
	progress.classified -= coverage.classifiedUsed;
	const changes = coverage.rows
		.filter((row) => row.used > 0)
		.map((row) =>
			itemCountChange(itemIds[row.key], counts[itemIds[row.key]] ?? { have: 0, haveFir: 0 }, row.owned - row.used),
		);
	return { progress, changes, unconfigured: [] };
}

/** Patch the pass save without losing fields owned by another version of the viewer. */
export function mergeDocumentProgress(raw: string | null, patch: Partial<Progress>) {
	let saved: Record<string, unknown> = {};
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		if (value && typeof value === "object" && !Array.isArray(value)) saved = value as Record<string, unknown>;
	} catch {
		/* Keep the existing tolerant-read behavior. */
	}
	return JSON.stringify({ version: 1, ...saved, ...patch });
}
