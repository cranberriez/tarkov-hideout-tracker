import type { TarkovDataMode } from "@/types/common";
import { deriveEffectivePrice, STORED_PRICE_POINT_LIMIT } from "../../lib/utils/price-history";
import {
    fetchJsonPriceHistory,
    type PriceHistoryFetchResult,
} from "../services/priceHistory";
import type {
    PriceRefreshOutcome,
    PriceRefreshStore,
    PriceRefreshSummary,
} from "./types";

const DEFAULT_CONCURRENCY = 12;
const PERSISTENCE_CHUNK_SIZE = 60;
const LOCK_DURATION_MS = 60 * 60 * 1000;

export interface RefreshPriceModeOptions {
    mode: TarkovDataMode;
    releaseId: string;
    store: PriceRefreshStore;
    concurrency?: number;
    fetchHistory?: (
        mode: TarkovDataMode,
        itemId: string,
        etag?: string | null,
    ) => Promise<PriceHistoryFetchResult>;
    onProgress?: (checked: number, eligible: number) => void;
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

export async function refreshPriceMode({
    mode,
    releaseId,
    store,
    concurrency = DEFAULT_CONCURRENCY,
    fetchHistory = fetchJsonPriceHistory,
    onProgress,
}: RefreshPriceModeOptions): Promise<PriceRefreshSummary> {
    const safeConcurrency = Math.max(1, Math.min(Math.floor(concurrency), 32));
    const runId = crypto.randomUUID();
    const startedAt = Date.now();
    const acquired = await store.tryAcquireLock(
        mode,
        runId,
        startedAt + LOCK_DURATION_MS,
        startedAt,
    );
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
    try {
        await store.startRun(runId, mode, startedAt);
        const [itemIds, syncStates] = await Promise.all([
            store.getEligibleItemIds(mode, releaseId),
            store.getSyncStates(mode),
        ]);
        summary.eligibleCount = itemIds.length;

        for (let offset = 0; offset < itemIds.length; offset += PERSISTENCE_CHUNK_SIZE) {
            const chunk = itemIds.slice(offset, offset + PERSISTENCE_CHUNK_SIZE);
            const outcomes = await mapWithConcurrency(
                chunk,
                safeConcurrency,
                async (itemId): Promise<PriceRefreshOutcome> => {
                    const checkedAt = Date.now();
                    try {
                        const response = await fetchHistory(
                            mode,
                            itemId,
                            syncStates[itemId]?.etag,
                        );
                        if (response.status === "not-modified") {
                            return {
                                status: "not-modified",
                                itemId,
                                etag: response.etag,
                                checkedAt,
                            };
                        }
                        const points = response.data.slice(-STORED_PRICE_POINT_LIMIT);
                        const derived = deriveEffectivePrice(points);
                        if (points.length === 0 || derived.effectivePrice === null) {
                            throw new Error("Price endpoint returned no usable points");
                        }
                        return {
                            status: "updated",
                            itemId,
                            etag: response.etag,
                            checkedAt,
                            points,
                            effectivePrice: derived.effectivePrice,
                            sampleCount: derived.sampleCount,
                            totalOfferCount: derived.totalOfferCount,
                        };
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
            await store.writeOutcomes(mode, outcomes);
            summary.checkedCount += outcomes.length;
            summary.changedCount += outcomes.filter(
                (outcome) => outcome.status === "updated",
            ).length;
            summary.notModifiedCount += outcomes.filter(
                (outcome) => outcome.status === "not-modified",
            ).length;
            summary.failedCount += outcomes.filter(
                (outcome) => outcome.status === "failed",
            ).length;
            onProgress?.(summary.checkedCount, summary.eligibleCount);
        }
        summary.status = summary.failedCount > 0 ? "partial" : "succeeded";
        await store.completeRun(summary, Date.now());
        return summary;
    } catch (error) {
        summary.status = "failed";
        summary.error = error instanceof Error ? error.message : String(error);
        await store.completeRun(summary, Date.now()).catch(() => undefined);
        throw error;
    } finally {
        await store.releaseLock(mode, runId).catch(() => undefined);
    }
}
