import type { TarkovDataMode } from "../../src/types/common";
import type { PriceHistoryPoint, VendorPrice } from "../../src/types/prices";
import { buildObservation, type MarketObservation } from "./analytics/observation";
import type { ModeState } from "./worker-state";

export interface AnalysisRun {
	runId: string;
	mode: TarkovDataMode;
	startedAt: number;
	completedAt: number;
	status: "succeeded" | "partial";
	analyzedCount: number;
	/** Items with no new upstream observation since their previous analytics row. */
	unchangedCount: number;
	/** Eligible items without a cached history yet (or whose cache was lost). */
	missingCount: number;
	summary: {
		trend: Record<string, number>;
		confidence: Record<string, number>;
		failed: { itemId: string; error: string }[];
	};
}

export interface AnalysisDependencies {
	readHistory(mode: TarkovDataMode, itemId: string): PriceHistoryPoint[] | null;
	readTraderSellOffers(mode: TarkovDataMode): Promise<Map<string, VendorPrice[]>>;
	writeRun(run: AnalysisRun, observations: readonly MarketObservation[]): Promise<void>;
	saveState(): void;
	now(): number;
	newRunId(): string;
}

function tally(values: readonly string[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
	return counts;
}

export interface AnalysisBaseline {
	lastRunAt: number | null;
	/** Latest upstream point covered by each item's most recent observation. */
	analyzed: Map<string, number>;
}

/**
 * Restores analysis progress from PostgreSQL into fresh local state (new or lost
 * volume), so a restart neither duplicates observations nor runs off-schedule.
 */
export function seedAnalysisState(state: ModeState, baseline: AnalysisBaseline): number {
	state.lastAnalysisAt ??= baseline.lastRunAt;
	let restored = 0;
	for (const [itemId, item] of Object.entries(state.items)) {
		const analyzed = baseline.analyzed.get(itemId);
		if (item.analyzedTimestamp !== undefined || analyzed === undefined) continue;
		item.analyzedTimestamp = analyzed;
		restored += 1;
	}
	return restored;
}

/**
 * One analytics period for a mode: every item with new upstream data since its
 * previous observation gets one row. Unchanged items are not rewritten.
 */
export async function analyzeMode(mode: TarkovDataMode, state: ModeState, deps: AnalysisDependencies) {
	const startedAt = deps.now();
	const sellOffers = await deps.readTraderSellOffers(mode);
	const observations: MarketObservation[] = [];
	const failed: AnalysisRun["summary"]["failed"] = [];
	let unchangedCount = 0;
	let missingCount = 0;
	for (const itemId of state.eligibleIds) {
		const item = state.items[itemId];
		if (item?.excluded) continue;
		if (!item || item.latestTimestamp === null) {
			missingCount += 1;
			continue;
		}
		if (item.analyzedTimestamp === item.latestTimestamp) {
			unchangedCount += 1;
			continue;
		}
		const points = deps.readHistory(mode, itemId);
		if (!points) {
			missingCount += 1;
			continue;
		}
		try {
			const observation = buildObservation(itemId, points, sellOffers.get(itemId) ?? [], startedAt);
			if (observation) observations.push(observation);
		} catch (error) {
			failed.push({ itemId, error: error instanceof Error ? error.message : String(error) });
		}
	}
	const run: AnalysisRun = {
		runId: deps.newRunId(),
		mode,
		startedAt,
		completedAt: deps.now(),
		status: failed.length ? "partial" : "succeeded",
		analyzedCount: observations.length,
		unchangedCount,
		missingCount,
		summary: {
			trend: tally(observations.map((observation) => observation.trend)),
			confidence: tally(observations.map((observation) => observation.confidence)),
			failed: failed.slice(0, 20),
		},
	};
	await deps.writeRun(run, observations);
	for (const observation of observations)
		state.items[observation.itemId].analyzedTimestamp = observation.sourceUpdatedAt;
	state.lastAnalysisAt = startedAt;
	deps.saveState();
	return run;
}
