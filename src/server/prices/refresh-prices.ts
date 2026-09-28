import type { TarkovDataMode } from "@/types/common";
import { getGlobalItemList } from "../services/itemsJson";
import { deriveEffectivePrice, STORED_PRICE_POINT_LIMIT } from "../../lib/utils/price-history";
import { fetchJsonPriceHistory, normalizePriceHistory, type PriceHistoryFetchResult } from "../services/priceHistory";
import { toCatalogPriceRecord } from "./price-store";
import type { CatalogPriceRecord, PriceRefreshOutcome, PriceRefreshStore, PriceRefreshSummary } from "./types";

const DEFAULT_CONCURRENCY = 12;
const PERSISTENCE_CHUNK_SIZE = 60;
const LOCK_DURATION_MS = 30 * 60 * 1000;

export interface RefreshPriceModeOptions {
	mode: TarkovDataMode;
	store: PriceRefreshStore;
	concurrency?: number;
	fetchHistory?: (mode: TarkovDataMode, itemId: string, etag?: string | null) => Promise<PriceHistoryFetchResult>;
	fetchCatalogPrices?: (mode: TarkovDataMode) => Promise<CatalogPriceRecord[]>;
	onProgress?: (checked: number, eligible: number) => void;
}

export async function fetchNormalizedCatalogPrices(mode: TarkovDataMode): Promise<CatalogPriceRecord[]> {
	const response = await getGlobalItemList(mode);
	return response.data.items.map(toCatalogPriceRecord);
}

async function mapWithConcurrency<T, Result>(
	values: readonly T[],
	concurrency: number,
	mapper: (value: T) => Promise<Result>,
): Promise<Result[]> {
	const results = new Array<Result>(values.length);
	let nextIndex = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, values.length) }, async () => {
			while (nextIndex < values.length) {
				const index = nextIndex++;
				results[index] = await mapper(values[index]);
			}
		}),
	);
	return results;
}

/** Validates an upstream history and derives the bounded working window stored as the current price. */
export function buildUpdatedPriceOutcome(
	itemId: string,
	history: unknown,
	etag: string | null,
	checkedAt: number,
	previousLatestTimestamp: number | null,
): Extract<PriceRefreshOutcome, { status: "updated" }> {
	const points = normalizePriceHistory(history, true).slice(-STORED_PRICE_POINT_LIMIT);
	const derived = deriveEffectivePrice(points);
	if (points.length === 0 || (derived.effectivePrice === null && points.at(-1)?.offerCount !== 0)) {
		throw new Error("Price endpoint returned no usable points");
	}
	if (points[points.length - 1].timestamp < (previousLatestTimestamp ?? 0)) {
		throw new Error("Price endpoint returned older observations than current storage");
	}
	return {
		status: "updated",
		itemId,
		etag,
		checkedAt,
		points,
		effectivePrice: derived.effectivePrice,
		sampleCount: derived.sampleCount,
		totalOfferCount: derived.totalOfferCount,
	};
}

export async function refreshPriceMode({
	mode,
	store,
	concurrency = DEFAULT_CONCURRENCY,
	fetchHistory = fetchJsonPriceHistory,
	fetchCatalogPrices = fetchNormalizedCatalogPrices,
	onProgress,
}: RefreshPriceModeOptions): Promise<PriceRefreshSummary> {
	const safeConcurrency = Math.max(1, Math.min(Math.floor(concurrency), 32));
	const runId = crypto.randomUUID();
	const startedAt = Date.now();
	const acquired = await store.tryAcquireLock(mode, runId, startedAt + LOCK_DURATION_MS, startedAt);
	if (!acquired) {
		return {
			runId,
			mode,
			status: "skipped",
			eligibleCount: 0,
			checkedCount: 0,
			changedCount: 0,
			notModifiedCount: 0,
			failedCount: 0,
			error: "A price refresh is already running for this mode.",
		};
	}

	const summary: PriceRefreshSummary = {
		runId,
		mode,
		status: "succeeded",
		eligibleCount: 0,
		checkedCount: 0,
		changedCount: 0,
		notModifiedCount: 0,
		failedCount: 0,
	};
	let catalogRefresh: Promise<void> | null = null;
	try {
		await store.startRun(runId, mode, startedAt);
		// Reference prices and trader offers have their own source and acceptance
		// path. Always attempt them, even if every flea request returns 304/fails.
		catalogRefresh = (async () => {
			try {
				const records = await fetchCatalogPrices(mode);
				if (!(await store.renewLock(mode, runId, Date.now() + LOCK_DURATION_MS, Date.now()))) {
					throw new Error(`Price refresh lease for ${mode} expired before catalog write`);
				}
				await store.writeCatalogPrices(mode, runId, records);
				summary.catalogPriceStatus = "updated";
			} catch (error) {
				summary.catalogPriceStatus = "failed";
				summary.catalogPriceError = error instanceof Error ? error.message : String(error);
			}
		})();
		const [itemIds, syncStates] = await Promise.all([store.getEligibleItemIds(mode), store.getSyncStates(mode)]);
		summary.eligibleCount = itemIds.length;

		for (let offset = 0; offset < itemIds.length; offset += PERSISTENCE_CHUNK_SIZE) {
			const renewalTime = Date.now();
			if (!(await store.renewLock(mode, runId, renewalTime + LOCK_DURATION_MS, renewalTime))) {
				throw new Error(`Price refresh lease for ${mode} expired before writing history chunk`);
			}
			const chunk = itemIds.slice(offset, offset + PERSISTENCE_CHUNK_SIZE);
			const outcomes = await mapWithConcurrency(
				chunk,
				safeConcurrency,
				async (itemId): Promise<PriceRefreshOutcome> => {
					const checkedAt = Date.now();
					try {
						const response = await fetchHistory(mode, itemId, syncStates[itemId]?.etag);
						if (response.status === "not-modified") {
							return {
								status: "not-modified",
								itemId,
								etag: response.etag,
								checkedAt,
							};
						}
						return buildUpdatedPriceOutcome(
							itemId,
							response.data,
							response.etag,
							checkedAt,
							syncStates[itemId]?.latestPointTimestamp ?? null,
						);
					} catch (error) {
						return {
							status: "failed",
							itemId,
							checkedAt,
							error: error instanceof Error ? error.message : String(error),
						};
					}
				},
			);
			await store.writeOutcomes(mode, runId, outcomes);
			summary.checkedCount += outcomes.length;
			summary.changedCount += outcomes.filter((outcome) => outcome.status === "updated").length;
			summary.notModifiedCount += outcomes.filter((outcome) => outcome.status === "not-modified").length;
			summary.failedCount += outcomes.filter((outcome) => outcome.status === "failed").length;
			onProgress?.(summary.checkedCount, summary.eligibleCount);
		}
		await catalogRefresh;
		summary.status = summary.failedCount > 0 || summary.catalogPriceStatus === "failed" ? "partial" : "succeeded";
		await store.completeRun(runId, summary, Date.now());
		return summary;
	} catch (error) {
		summary.status = "failed";
		summary.error = error instanceof Error ? error.message : String(error);
		await store.completeRun(runId, summary, Date.now()).catch(() => undefined);
		throw error;
	} finally {
		// Do not release the lease while a reference-price request can still write.
		if (catalogRefresh) await catalogRefresh;
		await store.releaseLock(mode, runId).catch(() => undefined);
	}
}
