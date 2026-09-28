import { randomUUID } from "node:crypto";
import fs from "node:fs";
import type { TarkovDataMode } from "../../src/types/common";
import { closePostgresPool, getPostgresDb, getPostgresPool } from "../../src/server/postgres/connection";
import { PostgresPriceRefreshStore } from "../../src/server/prices/price-store";
import { fetchNormalizedCatalogPrices } from "../../src/server/prices/refresh-prices";
import { fetchJsonPriceHistory } from "../../src/server/services/priceHistory";
import { analyzeMode, seedAnalysisState } from "./analysis";
import { PostgresAnalyticsStore } from "./analytics-store";
import { loadConfig, parseModes, type WorkerConfig } from "./config";
import { flushMode } from "./flush";
import { pollMode } from "./poll";
import { intervalDue, periodDue } from "./schedule";
import { clearExclusions, setEligible, WorkerStateStore, type ModeState } from "./worker-state";

const TICK_MS = 60 * 1000;
const ANALYSIS_RETRY_MS = 15 * 60 * 1000;

function log(event: string, fields: Record<string, unknown> = {}) {
	console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

class MarketWorker {
	private stopping = false;
	private wake: (() => void) | null = null;
	private readonly states = new Map<TarkovDataMode, ModeState>();
	/** In-memory retry pacing so a failing database is not hit every tick. */
	private readonly attempts = new Map<string, number>();
	private readonly seeded = new Set<TarkovDataMode>();
	private readonly priceStore = new PostgresPriceRefreshStore(getPostgresDb());
	private readonly analyticsStore = new PostgresAnalyticsStore(getPostgresPool());

	constructor(
		private readonly config: WorkerConfig,
		private readonly local: WorkerStateStore,
	) {}

	stop() {
		this.stopping = true;
		this.wake?.();
	}

	private state(mode: TarkovDataMode): ModeState {
		let state = this.states.get(mode);
		if (!state) {
			state = this.local.loadMode(mode);
			this.states.set(mode, state);
		}
		return state;
	}

	async runForever() {
		log("worker-started", {
			modes: this.config.modes,
			stateDirectory: this.config.stateDirectory,
			schedules: this.config.schedules,
			flushMs: this.config.flushMs,
		});
		while (!this.stopping) {
			for (const mode of this.config.modes) {
				if (this.stopping) break;
				try {
					await this.tick(mode, false);
				} catch (error) {
					log("mode-error", { mode, error: errorMessage(error) });
				}
			}
			this.local.heartbeat({ modes: this.config.modes });
			await new Promise<void>((resolve) => {
				const timer = setTimeout(resolve, TICK_MS);
				this.wake = () => {
					clearTimeout(timer);
					resolve();
				};
			});
		}
		log("worker-stopped");
	}

	/** Runs whichever steps are due for a mode; `force` runs every step once. */
	async tick(mode: TarkovDataMode, force: boolean) {
		const state = this.state(mode);
		const schedule = this.config.schedules[mode];
		const save = () => this.local.saveMode(mode, state);
		const now = Date.now();

		if (this.local.consumeRecheck(mode)) {
			log("exclusions-cleared", { mode, count: clearExclusions(state) });
			save();
		}
		if (force || intervalDue(state.eligibleAt, this.config.eligibleRefreshMs, now)) {
			const itemIds = await this.priceStore.getEligibleItemIds(mode);
			if (!itemIds.length) throw new Error(`No eligible items for ${mode}; is the catalog initialized?`);
			setEligible(state, itemIds, now);
			save();
			log("eligible-refreshed", { mode, count: itemIds.length });
		}

		if (force || intervalDue(state.lastPollAt, schedule.pollMs, now)) {
			const startedAt = Date.now();
			const counts = await pollMode(mode, state, {
				fetchHistory: fetchJsonPriceHistory,
				writeHistory: (m, itemId, points, etag) => this.local.writeHistory(m, itemId, points, etag),
				saveState: save,
				now: Date.now,
				concurrency: this.config.concurrency,
				shouldStop: () => this.stopping,
			});
			log("poll", { mode, ...counts, durationMs: Date.now() - startedAt });
		}
		if (this.stopping) return;

		const flushKey = `${mode}:flush`;
		if (force || intervalDue(this.attempts.get(flushKey) ?? state.lastFlushAt, this.config.flushMs, now)) {
			this.attempts.set(flushKey, now);
			const startedAt = Date.now();
			try {
				const result = await flushMode(mode, state, {
					store: this.priceStore,
					readHistory: (m, itemId) => this.local.readHistory(m, itemId),
					fetchCatalogPrices: fetchNormalizedCatalogPrices,
					saveState: save,
					now: Date.now,
					newRunId: randomUUID,
					catalogDue: force || intervalDue(state.lastCatalogAt, schedule.catalogMs, now),
				});
				log("flush", {
					...(result.status === "completed"
						? { ...result.summary, supersededCount: result.supersededCount }
						: { mode, status: result.status }),
					durationMs: Date.now() - startedAt,
				});
			} catch (error) {
				log("flush-failed", { mode, error: errorMessage(error) });
			}
		}
		if (this.stopping) return;

		if (state.lastAnalysisAt === null && state.lastPollAt !== null && !this.seeded.has(mode)) {
			const restored = seedAnalysisState(state, await this.analyticsStore.readAnalysisBaseline(mode));
			this.seeded.add(mode);
			save();
			log("analysis-baseline", { mode, lastAnalysisAt: state.lastAnalysisAt, restoredItems: restored });
		}
		const analysisKey = `${mode}:analysis`;
		if (
			force ||
			(state.lastPollAt !== null &&
				periodDue(state.lastAnalysisAt, schedule.analysisMs, now) &&
				intervalDue(this.attempts.get(analysisKey), ANALYSIS_RETRY_MS, now))
		) {
			this.attempts.set(analysisKey, now);
			const run = await analyzeMode(mode, state, {
				readHistory: (m, itemId) => this.local.readHistory(m, itemId),
				readTraderSellOffers: (m) => this.analyticsStore.readTraderSellOffers(m),
				writeRun: (analysisRun, observations) => this.analyticsStore.writeRun(analysisRun, observations),
				saveState: save,
				now: Date.now,
				newRunId: randomUUID,
			});
			const { summary, ...fields } = run;
			log("analysis", { ...fields, trend: summary.trend, confidence: summary.confidence, failed: summary.failed });
		}
	}
}

function statusReport(config: WorkerConfig, local: WorkerStateStore) {
	return config.modes.map((mode) => {
		const state = local.loadMode(mode);
		const items = Object.values(state.items);
		const excluded: Record<string, number> = {};
		for (const item of items)
			if (item.excluded) excluded[item.excluded.reason] = (excluded[item.excluded.reason] ?? 0) + 1;
		const iso = (value: number | null) => (value === null ? null : new Date(value).toISOString());
		return {
			mode,
			eligible: state.eligibleIds.length,
			cached: items.filter((item) => item.latestTimestamp !== null).length,
			dirty: items.filter((item) => item.dirty).length,
			pendingFailures: Object.keys(state.pendingFailures).length,
			excluded,
			sinceFlush: state.sinceFlush,
			lastPollAt: iso(state.lastPollAt),
			lastFlushAt: iso(state.lastFlushAt),
			lastCatalogAt: iso(state.lastCatalogAt),
			lastAnalysisAt: iso(state.lastAnalysisAt),
		};
	});
}

function modesArgument(args: readonly string[]): TarkovDataMode[] | null {
	const index = args.indexOf("--modes");
	return index === -1 ? null : parseModes(args[index + 1]);
}

async function main() {
	if (fs.existsSync(".env")) process.loadEnvFile(".env");
	const [command = "run", ...args] = process.argv.slice(2);
	const config = loadConfig();
	config.modes = modesArgument(args) ?? config.modes;
	const local = new WorkerStateStore(config.stateDirectory);

	if (command === "status") {
		console.log(JSON.stringify(statusReport(config, local), null, 2));
		return;
	}
	if (command === "recheck-excluded") {
		for (const mode of config.modes) local.requestRecheck(mode);
		log("recheck-requested", { modes: config.modes });
		return;
	}
	if (command !== "run" && command !== "once") throw new Error(`Unknown command ${command}`);

	const worker = new MarketWorker(config, local);
	for (const signal of ["SIGINT", "SIGTERM"] as const)
		process.once(signal, () => {
			log("stop-requested", { signal });
			worker.stop();
		});
	try {
		if (command === "once") {
			for (const mode of config.modes) await worker.tick(mode, true);
		} else {
			await worker.runForever();
		}
	} finally {
		await closePostgresPool();
	}
}

main().catch((error) => {
	log("fatal", { error: error instanceof Error ? (error.stack ?? error.message) : String(error) });
	process.exitCode = 1;
});
