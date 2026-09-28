import type { PriceHistoryPoint } from "../../../src/types/prices";
import { currentLevelAt, marketValueAsOf, move12hAt } from "./metrics";

const HOUR = 60 * 60 * 1000;

/** Shocks are looked for among the last three days of snapshots. */
const SHOCK_WINDOW_MS = 72 * HOUR;
/** The robust level must move at least this factor away from the pre-shock market value. */
const SHOCK_FACTOR = 2;
/** The pre-shock baseline is the market value this long before the extreme. */
const BASELINE_LEAD_MS = 24 * HOUR;
/** A 12-hour move against the shock of at least this much counts as retracing. */
const RETRACE_MOVE = 0.1;
/** Giving back at least this share of the jump means the shock has reverted. */
const REVERTED_SHARE = 0.85;
/** Giving back less than this share while not moving back means still holding the extreme. */
const HOLDING_SHARE = 0.25;

export type ShockPhase = "holding" | "retracing" | "settled" | "reverted";

/**
 * A demand/supply shock and how the market has responded. On the flea a spike draws
 * sellers in and undercutting walks the minimum back down (a crash the reverse), so
 * the useful questions are how far the price jumped, how much it has given back and
 * whether it is still moving back.
 */
export interface MarketShock {
	direction: "up" | "down";
	/** Market value 24 hours before the extreme. */
	baseline: number;
	/** Highest (or lowest) robust level: a median of three consecutive snapshots. */
	extreme: number;
	extremeAt: number;
	/** Share of the jump given back: (extreme - current) / (extreme - baseline). Can exceed 1. */
	retracement: number;
	phase: ShockPhase;
}

function median(values: readonly number[]) {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Medians of three consecutive snapshots: a single spike or undercut cannot form an extreme. */
function robustLevels(points: readonly PriceHistoryPoint[], from: number, to: number) {
	const usable = points.filter((point) => point.priceMin > 0 && point.offerCount !== 0 && point.timestamp <= to);
	const levels: { value: number; at: number }[] = [];
	for (let index = 2; index < usable.length; index += 1) {
		if (usable[index].timestamp < from) continue;
		levels.push({
			value: median(usable.slice(index - 2, index + 1).map((point) => point.priceMin)),
			at: usable[index].timestamp,
		});
	}
	return levels;
}

export function detectShock(points: readonly PriceHistoryPoint[], now: number): MarketShock | null {
	const current = currentLevelAt(points, now);
	const levels = robustLevels(points, now - SHOCK_WINDOW_MS, now);
	if (current === null || !levels.length) return null;

	const candidates: Omit<MarketShock, "retracement" | "phase">[] = [];
	const peak = levels.reduce((best, level) => (level.value > best.value ? level : best));
	const trough = levels.reduce((best, level) => (level.value < best.value ? level : best));
	const peakBaseline = marketValueAsOf(points, peak.at - BASELINE_LEAD_MS);
	if (peakBaseline && peak.value >= peakBaseline * SHOCK_FACTOR)
		candidates.push({ direction: "up", baseline: peakBaseline, extreme: peak.value, extremeAt: peak.at });
	const troughBaseline = marketValueAsOf(points, trough.at - BASELINE_LEAD_MS);
	if (troughBaseline && trough.value * SHOCK_FACTOR <= troughBaseline)
		candidates.push({ direction: "down", baseline: troughBaseline, extreme: trough.value, extremeAt: trough.at });
	if (!candidates.length) return null;

	// With both, the larger move (in log terms) is the shock worth describing.
	const shock = candidates.reduce((best, candidate) =>
		Math.abs(Math.log(candidate.extreme / candidate.baseline)) > Math.abs(Math.log(best.extreme / best.baseline))
			? candidate
			: best,
	);
	const retracement = (shock.extreme - current) / (shock.extreme - shock.baseline);
	const move = move12hAt(points, now);
	const movingBack = move !== null && (shock.direction === "up" ? move <= -RETRACE_MOVE : move >= RETRACE_MOVE);
	const phase: ShockPhase =
		retracement >= REVERTED_SHARE
			? "reverted"
			: movingBack
				? "retracing"
				: retracement < HOLDING_SHARE
					? "holding"
					: "settled";
	return { ...shock, retracement, phase };
}
