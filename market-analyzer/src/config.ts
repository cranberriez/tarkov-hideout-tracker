import path from "node:path";
import type { TarkovDataMode } from "../../src/types/common";

export const ALL_MODES: readonly TarkovDataMode[] = ["pvp-season", "regular", "pve"];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export interface ModeSchedule {
	/** Conditional (ETag) history polling cadence. */
	pollMs: number;
	/** Catalog reference prices / trader offers; a 17 MB dataset per mode. */
	catalogMs: number;
	/** Analytics observations are aligned to UTC multiples of this period. */
	analysisMs: number;
}

export interface WorkerConfig {
	modes: TarkovDataMode[];
	stateDirectory: string;
	concurrency: number;
	/** Buffered changes are pushed to PostgreSQL at most this often. */
	flushMs: number;
	/** The eligible item list is a PostgreSQL read; refresh it rarely so polls stay off the database. */
	eligibleRefreshMs: number;
	schedules: Record<TarkovDataMode, ModeSchedule>;
}

function positiveNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
	const raw = env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
	return value;
}

export function parseModes(value: string | undefined): TarkovDataMode[] {
	const modes = (value ?? ALL_MODES.join(","))
		.split(",")
		.map((mode) => mode.trim())
		.filter(Boolean);
	if (!modes.length || modes.some((mode) => !ALL_MODES.includes(mode as TarkovDataMode)))
		throw new Error("Modes must contain pvp-season, regular and/or pve");
	// Seasonal first: its economy moves with progression and gets priority.
	return ALL_MODES.filter((mode) => modes.includes(mode));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
	const concurrency = positiveNumber(env, "MARKET_CONCURRENCY", 12);
	if (!Number.isInteger(concurrency) || concurrency > 32)
		throw new Error("MARKET_CONCURRENCY must be an integer from 1 to 32");
	const season: ModeSchedule = {
		pollMs: positiveNumber(env, "MARKET_SEASON_POLL_MINUTES", 30) * MINUTE,
		catalogMs: positiveNumber(env, "MARKET_SEASON_CATALOG_MINUTES", 360) * MINUTE,
		analysisMs: positiveNumber(env, "MARKET_SEASON_ANALYSIS_HOURS", 12) * HOUR,
	};
	const mature: ModeSchedule = {
		pollMs: positiveNumber(env, "MARKET_MATURE_POLL_MINUTES", 360) * MINUTE,
		catalogMs: positiveNumber(env, "MARKET_MATURE_CATALOG_MINUTES", 360) * MINUTE,
		analysisMs: positiveNumber(env, "MARKET_MATURE_ANALYSIS_HOURS", 24) * HOUR,
	};
	return {
		modes: parseModes(env.MARKET_MODES),
		stateDirectory: path.resolve(env.MARKET_STATE_DIR?.trim() || "data"),
		concurrency,
		flushMs: positiveNumber(env, "MARKET_FLUSH_MINUTES", 60) * MINUTE,
		eligibleRefreshMs: positiveNumber(env, "MARKET_ELIGIBLE_REFRESH_HOURS", 6) * HOUR,
		schedules: { "pvp-season": season, regular: mature, pve: { ...mature } },
	};
}
