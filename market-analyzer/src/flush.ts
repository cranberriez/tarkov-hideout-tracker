import type { TarkovDataMode } from "../../src/types/common";
import type { PriceHistoryPoint } from "../../src/types/prices";
import { buildUpdatedPriceOutcome } from "../../src/server/prices/refresh-prices";
import type {
	CatalogPriceRecord,
	PriceRefreshOutcome,
	PriceRefreshStore,
	PriceRefreshSummary,
} from "../../src/server/prices/types";
import { emptyCounts, type ModeState } from "./worker-state";

const LOCK_DURATION_MS = 30 * 60 * 1000;
const WRITE_CHUNK_SIZE = 60;

export interface FlushDependencies {
	store: PriceRefreshStore;
	readHistory(mode: TarkovDataMode, itemId: string): PriceHistoryPoint[] | null;
	fetchCatalogPrices(mode: TarkovDataMode): Promise<CatalogPriceRecord[]>;
	saveState(): void;
	now(): number;
	newRunId(): string;
	catalogDue: boolean;
}

export type FlushResult =
	| { status: "idle" }
	| { status: "locked" }
	| { status: "completed"; summary: PriceRefreshSummary; supersededCount: number };

/**
 * Pushes buffered changes to PostgreSQL through the website's price store under
 * the shared per-mode lease. Not-modified checks are never written: they carry
 * no information and would rewrite every sync row each hour.
 */
export async function flushMode(mode: TarkovDataMode, state: ModeState, deps: FlushDependencies): Promise<FlushResult> {
	const dirtyIds = Object.keys(state.items).filter((itemId) => state.items[itemId].dirty);
	const failedIds = Object.keys(state.pendingFailures);
	if (!dirtyIds.length && !failedIds.length && !deps.catalogDue) return { status: "idle" };

	const runId = deps.newRunId();
	const startedAt = deps.now();
	if (!(await deps.store.tryAcquireLock(mode, runId, startedAt + LOCK_DURATION_MS, startedAt)))
		return { status: "locked" };

	const summary: PriceRefreshSummary = {
		runId,
		mode,
		status: "succeeded",
		source: "worker",
		eligibleCount: state.eligibleIds.length,
		checkedCount: state.sinceFlush.checked,
		changedCount: 0,
		notModifiedCount: state.sinceFlush.notModified,
		failedCount: 0,
		excludedCount: Object.values(state.items).filter((item) => item.excluded).length,
	};
	let supersededCount = 0;
	const renew = async (what: string) => {
		const at = deps.now();
		if (!(await deps.store.renewLock(mode, runId, at + LOCK_DURATION_MS, at)))
			throw new Error(`Price refresh lease for ${mode} expired before ${what}`);
	};
	try {
		await deps.store.startRun(runId, mode, startedAt);
		if (deps.catalogDue) {
			try {
				const records = await deps.fetchCatalogPrices(mode);
				await renew("catalog write");
				await deps.store.writeCatalogPrices(mode, runId, records);
				summary.catalogPriceStatus = "updated";
				state.lastCatalogAt = deps.now();
			} catch (error) {
				summary.catalogPriceStatus = "failed";
				summary.catalogPriceError = error instanceof Error ? error.message : String(error);
			}
		}

		// Another writer (the legacy cron) may already hold newer points; those items are
		// superseded rather than failed, and the next poll picks up the newer ETag.
		const stored = await deps.store.getSyncStates(mode);
		const outcomes: PriceRefreshOutcome[] = [];
		for (const itemId of dirtyIds) {
			const item = state.items[itemId];
			const points = deps.readHistory(mode, itemId);
			if (!points) {
				// Cache lost: forget the ETag so the next poll refetches the body.
				state.items[itemId] = { etag: null, checkedAt: item.checkedAt, latestTimestamp: null };
				continue;
			}
			const storedLatest = stored[itemId]?.latestPointTimestamp ?? null;
			if (storedLatest !== null && item.latestTimestamp !== null && storedLatest > item.latestTimestamp) {
				supersededCount += 1;
				item.dirty = false;
				continue;
			}
			try {
				outcomes.push(buildUpdatedPriceOutcome(itemId, points, item.etag, item.checkedAt, storedLatest));
			} catch (error) {
				outcomes.push({
					status: "failed",
					itemId,
					checkedAt: item.checkedAt,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		for (const itemId of failedIds) {
			if (state.items[itemId]?.dirty) continue;
			outcomes.push({ status: "failed", itemId, ...state.pendingFailures[itemId] });
		}

		for (let offset = 0; offset < outcomes.length; offset += WRITE_CHUNK_SIZE) {
			await renew("writing price chunk");
			const chunk = outcomes.slice(offset, offset + WRITE_CHUNK_SIZE);
			await deps.store.writeOutcomes(mode, runId, chunk);
			for (const outcome of chunk) {
				if (state.items[outcome.itemId]) state.items[outcome.itemId].dirty = false;
				delete state.pendingFailures[outcome.itemId];
				if (outcome.status === "updated") summary.changedCount += 1;
				else if (outcome.status === "failed") summary.failedCount += 1;
			}
			deps.saveState();
		}

		summary.status = summary.failedCount > 0 || summary.catalogPriceStatus === "failed" ? "partial" : "succeeded";
		state.sinceFlush = emptyCounts();
		state.lastFlushAt = deps.now();
		deps.saveState();
		await deps.store.completeRun(runId, summary, deps.now());
		return { status: "completed", summary, supersededCount };
	} catch (error) {
		summary.status = "failed";
		summary.error = error instanceof Error ? error.message : String(error);
		await deps.store.completeRun(runId, summary, deps.now()).catch(() => undefined);
		deps.saveState();
		throw error;
	} finally {
		await deps.store.releaseLock(mode, runId).catch(() => undefined);
	}
}
