import type { HigherLowerItem } from "@/types/contracts";

export type HigherLowerGuess = "higher" | "lower";

const START_MAX_RATIO = 4;
const MAX_RATIO_DECAY = 0.85;
const FLOOR_MAX_RATIO = 1.15;
/** A rouble allowance alongside the ratio, so runs that start on cheap items can climb out of them. */
const START_MAX_GAP_RUB = 100_000;
const FLOOR_MAX_GAP_RUB = 20_000;
/** Share of the target value each count-up step adds. */
const COUNT_UP_STEP = 0.03;

export interface HigherLowerPool {
	/** Ascending by value. */
	items: HigherLowerItem[];
	logs: number[];
}

export function createHigherLowerPool(items: readonly HigherLowerItem[]): HigherLowerPool {
	const sorted = items.filter((item) => item.value > 0).sort((a, b) => a.value - b.value);
	return { items: sorted, logs: sorted.map((item) => Math.log(item.value)) };
}

/** Widest value ratio allowed between the two cards; it narrows quickly as the streak grows. */
export function maxRatioForStreak(streak: number): number {
	return Math.max(FLOOR_MAX_RATIO, START_MAX_RATIO * MAX_RATIO_DECAY ** streak);
}

export function maxGapRubForStreak(streak: number): number {
	return Math.max(FLOOR_MAX_GAP_RUB, START_MAX_GAP_RUB * MAX_RATIO_DECAY ** streak);
}

function logOrNegativeInfinity(value: number) {
	return value > 0 ? Math.log(value) : -Infinity;
}

function lowerBound(logs: readonly number[], target: number): number {
	let low = 0;
	let high = logs.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (logs[middle] < target) low = middle + 1;
		else high = middle;
	}
	return low;
}

/** Unused pool indices whose log value lies in [from, to]. */
function unusedBetween(pool: HigherLowerPool, from: number, to: number, used: ReadonlySet<string>): number[] {
	const indices: number[] = [];
	const end = lowerBound(pool.logs, to + Number.EPSILON);
	for (let index = lowerBound(pool.logs, from); index < end; index += 1) {
		if (!used.has(pool.items[index].id)) indices.push(index);
	}
	return indices;
}

function choose<T>(values: readonly T[], random: () => number): T {
	return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

export function pickStartItem(pool: HigherLowerPool, random: () => number = Math.random): HigherLowerItem | null {
	return pool.items.length ? choose(pool.items, random) : null;
}

/**
 * Picks a challenger for the baseline within the wider of the streak's ratio and rouble allowances; equal values
 * are allowed. A coin flip chooses higher or lower, the other side is used when that one is empty (near the ends
 * of the value range), and any unused item is the last resort. Returns null only when nothing is left.
 */
export function pickChallenger(
	pool: HigherLowerPool,
	baseline: HigherLowerItem,
	streak: number,
	used: ReadonlySet<string>,
	random: () => number = Math.random,
): HigherLowerItem | null {
	const value = baseline.value;
	const base = Math.log(value);
	const ratio = maxRatioForStreak(streak);
	const gap = maxGapRubForStreak(streak);
	const top = Math.log(Math.max(value * ratio, value + gap));
	const bottom = logOrNegativeInfinity(Math.min(value / ratio, value - gap));
	const above = unusedBetween(pool, base, top, used);
	const below = unusedBetween(pool, bottom, base, used);
	const [first, second] = random() < 0.5 ? [above, below] : [below, above];
	let options = first.length ? first : second;
	if (!options.length) {
		options = unusedBetween(pool, -Infinity, Infinity, used);
	}
	return options.length ? pool.items[choose(options, random)] : null;
}

/** Equal values count as correct for either guess. */
export function isCorrectGuess(baseline: HigherLowerItem, challenger: HigherLowerItem, guess: HigherLowerGuess) {
	return guess === "higher" ? challenger.value >= baseline.value : challenger.value <= baseline.value;
}

/** Count-up display value: eases out so the climb slows near the answer, advancing in whole steps. */
export function countUpValue(target: number, progress: number): number {
	if (progress >= 1) return target;
	const eased = 1 - (1 - Math.max(0, progress)) ** 2;
	return Math.round(target * Math.floor(eased / COUNT_UP_STEP) * COUNT_UP_STEP);
}

export function parseBestStreak(raw: string | null): number {
	if (!raw) return 0;
	try {
		const value = (JSON.parse(raw) as { bestStreak?: unknown }).bestStreak;
		return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
	} catch {
		return 0;
	}
}
