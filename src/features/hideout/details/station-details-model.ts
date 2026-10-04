import { computeNeeds } from "../../../lib/utils/item-needs";
import { poolItems } from "../../../lib/utils/item-pooling";
import { getFleaPrice } from "../../../lib/utils/market-price";
import type { ItemRequirement, Station, StationLevel } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { isCurrencyItem, type StationUpgradeStatus } from "../station-model";

type OwnedCounts = { have: number; haveFir: number };
type ItemCounts = Readonly<Record<string, OwnedCounts>>;

export type LevelState = "built" | "ready" | "next" | "locked";

export interface LevelCost {
	/** Roubles still needed for priced, missing requirements. */
	remaining: number;
	/** Part of `remaining` for requirements that need not be found in raid (currency included). */
	nonFirCost: number;
	/** Found-in-raid units still missing. */
	firMissing: number;
	/** Missing requirements with no usable price. */
	unpricedItemIds: string[];
	/** Requirements whose item is absent from the catalog. */
	unresolvedItemIds: string[];
}

export interface LevelOverviewRow extends LevelCost {
	level: number;
	state: LevelState;
	constructionTime: number;
}

export interface CostInputs {
	itemById: Readonly<Record<string, ItemSummary>>;
	itemCounts: ItemCounts;
	pooledFirByItem: Readonly<Record<string, number>>;
	completedRequirements: Readonly<Record<string, boolean>>;
}

const EMPTY_COST: LevelCost = { remaining: 0, nonFirCost: 0, firMissing: 0, unpricedItemIds: [], unresolvedItemIds: [] };

/** Roubles at face value; otherwise the cheaper of flea and any trader offer. Null when unpriced. */
export function unitCostRoubles(item: ItemSummary): number | null {
	if (item.normalizedName === "roubles") return 1;
	const candidates = [getFleaPrice(item.marketPrice), ...(item.buyFromTrader ?? []).map((offer) => offer.priceRUB)].filter(
		(value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
	);
	return candidates.length > 0 ? Math.min(...candidates) : null;
}

/** Units still missing for one requirement. Mirrors ItemRequirementsExpanded; currency is always fully counted. */
export function missingRequirementCount(
	requirement: ItemRequirement,
	item: ItemSummary,
	owned: OwnedCounts,
	pooledFir: number,
): number {
	if (isCurrencyItem(item)) return requirement.count;
	if (requirement.isFir) {
		return computeNeeds({
			totalRequired: requirement.count,
			requiredFir: requirement.count,
			haveNonFir: 0,
			haveFir: owned.haveFir,
		}).neededTotal;
	}
	const firSurplus = Math.max(0, owned.haveFir - pooledFir);
	return computeNeeds({
		totalRequired: requirement.count,
		requiredFir: 0,
		haveNonFir: owned.have + firSurplus,
		haveFir: 0,
	}).neededTotal;
}

export function remainingLevelCost(level: StationLevel, inputs: CostInputs): LevelCost {
	let remaining = 0;
	let nonFirCost = 0;
	let firMissing = 0;
	const unpricedItemIds: string[] = [];
	const unresolvedItemIds: string[] = [];
	for (const requirement of level.itemRequirements) {
		const item = inputs.itemById[requirement.itemId];
		if (!item) {
			unresolvedItemIds.push(requirement.itemId);
			continue;
		}
		if (inputs.completedRequirements[requirement.id]) continue;
		const missing = missingRequirementCount(
			requirement,
			item,
			inputs.itemCounts[requirement.itemId] ?? { have: 0, haveFir: 0 },
			inputs.pooledFirByItem[requirement.itemId] ?? 0,
		);
		if (missing === 0) continue;
		const fir = requirement.isFir && !isCurrencyItem(item);
		if (fir) firMissing += missing;
		const unit = unitCostRoubles(item);
		if (unit == null) {
			unpricedItemIds.push(requirement.itemId);
			continue;
		}
		remaining += unit * missing;
		if (!fir) nonFirCost += unit * missing;
	}
	return { remaining, nonFirCost, firMissing, unpricedItemIds, unresolvedItemIds };
}

/** One row per level: build state and the cost still to cover (built levels cost nothing). */
export function buildLevelOverview({
	station,
	currentLevel,
	upgradeStatus,
	...inputs
}: CostInputs & {
	station: Station;
	currentLevel: number;
	upgradeStatus: StationUpgradeStatus;
}): LevelOverviewRow[] {
	return [...station.levels]
		.sort((a, b) => a.level - b.level)
		.map((level) => {
			const state: LevelState =
				level.level <= currentLevel
					? "built"
					: level.level === currentLevel + 1
						? upgradeStatus === "ready"
							? "ready"
							: "next"
						: "locked";
			const cost = state === "built" ? EMPTY_COST : remainingLevelCost(level, inputs);
			return { level: level.level, state, constructionTime: level.constructionTime, ...cost };
		});
}

export interface RemainingItem {
	itemId: string;
	count: number;
	firCount: number;
}

/** Pooled demand against the whole inventory; currency is always fully counted. */
export function remainingItemNeeds(entry: RemainingItem, item: ItemSummary, owned: OwnedCounts | undefined) {
	const currency = isCurrencyItem(item);
	return computeNeeds({
		totalRequired: entry.count,
		requiredFir: entry.firCount,
		haveNonFir: currency ? 0 : (owned?.have ?? 0),
		haveFir: currency ? 0 : (owned?.haveFir ?? 0),
	});
}

/**
 * Totals across every level not yet built. Cost comes from the pooled items so one
 * inventory stack is not counted as covering several levels.
 */
export function summarizeRemaining(
	rows: readonly LevelOverviewRow[],
	items: readonly RemainingItem[],
	itemById: Readonly<Record<string, ItemSummary>>,
	itemCounts: ItemCounts,
) {
	const pending = rows.filter((row) => row.state !== "built");
	let remaining = 0;
	let nonFirCost = 0;
	let firMissing = 0;
	const unpricedItemIds: string[] = [];
	for (const entry of items) {
		const item = itemById[entry.itemId];
		if (!item) continue;
		const needs = remainingItemNeeds(entry, item, itemCounts[entry.itemId]);
		if (needs.neededTotal === 0) continue;
		firMissing += needs.neededFir;
		const unit = unitCostRoubles(item);
		if (unit == null) {
			unpricedItemIds.push(entry.itemId);
			continue;
		}
		remaining += unit * needs.neededTotal;
		nonFirCost += unit * needs.neededNonFir;
	}
	return {
		levelCount: pending.length,
		fromLevel: pending[0]?.level ?? null,
		toLevel: pending.at(-1)?.level ?? null,
		constructionTime: pending.reduce((sum, row) => sum + row.constructionTime, 0),
		remaining,
		nonFirCost,
		firMissing,
		unpricedItemIds,
		unresolvedItemIds: [...new Set(pending.flatMap((row) => row.unresolvedItemIds))],
	};
}

/** This station's item demand from current level + 1 to max, excluding manually completed requirements. */
export function remainingStationItems(
	station: Station,
	currentLevel: number,
	completedRequirements: Record<string, boolean>,
): RemainingItem[] {
	return poolItems({
		stations: [station],
		stationLevels: { [station.id]: currentLevel },
		hiddenStations: {},
		showHidden: true,
		viewMode: "all",
		completedRequirements,
	}).map(({ id, count, firCount }) => ({ itemId: id, count, firCount }));
}
