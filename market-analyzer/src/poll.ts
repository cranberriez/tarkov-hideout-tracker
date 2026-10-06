import type { TarkovDataMode } from "../../src/types/common";
import type { PriceHistoryPoint } from "../../src/types/prices";
import { PriceHistoryHttpError, type PriceHistoryFetchResult } from "../../src/server/services/priceHistory";
import { emptyCounts, type ModeState, type PollCounts } from "./worker-state";

const STATE_SAVE_CHUNK = 200;

export interface PollDependencies {
	fetchHistory(mode: TarkovDataMode, itemId: string, etag: string | null): Promise<PriceHistoryFetchResult>;
	writeHistory(mode: TarkovDataMode, itemId: string, points: readonly PriceHistoryPoint[], etag: string | null): void;
	saveState(): void;
	now(): number;
	concurrency: number;
	shouldStop?(): boolean;
}

async function mapWithConcurrency<T>(values: readonly T[], concurrency: number, mapper: (value: T) => Promise<void>) {
	let nextIndex = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, values.length) }, async () => {
			while (nextIndex < values.length) await mapper(values[nextIndex++]);
		}),
	);
}

/**
 * One conditional pass over eligible, non-excluded items. Only the local cache
 * and state change here; PostgreSQL is untouched until the next flush.
 */
export async function pollMode(mode: TarkovDataMode, state: ModeState, deps: PollDependencies): Promise<PollCounts> {
	const counts = emptyCounts();
	const itemIds = state.eligibleIds.filter((itemId) => !state.items[itemId]?.excluded);

	const check = async (itemId: string) => {
		const previous = state.items[itemId];
		const checkedAt = deps.now();
		counts.checked += 1;
		try {
			// Without a cached body a 304 would be useless, so only send the ETag we hold locally.
			const etag = previous?.latestTimestamp != null ? previous.etag : null;
			const response = await deps.fetchHistory(mode, itemId, etag);
			delete state.pendingFailures[itemId];
			if (response.status === "not-modified") {
				counts.notModified += 1;
				state.items[itemId] = { ...previous!, etag: response.etag ?? previous!.etag, checkedAt };
				return;
			}
			const points = response.data;
			const latest = points.at(-1);
			if (!latest) {
				counts.excluded += 1;
				state.items[itemId] = {
					etag: null,
					checkedAt,
					latestTimestamp: null,
					excluded: { reason: "no-history", at: checkedAt },
				};
				return;
			}
			if (previous?.latestTimestamp != null && latest.timestamp < previous.latestTimestamp)
				throw new Error("Price endpoint returned older observations than the cached history");
			deps.writeHistory(mode, itemId, points, response.etag);
			counts.updated += 1;
			state.items[itemId] = {
				...previous,
				etag: response.etag,
				checkedAt,
				latestTimestamp: latest.timestamp,
				dirty: true,
			};
		} catch (error) {
			if (error instanceof PriceHistoryHttpError && error.status === 404) {
				counts.excluded += 1;
				state.items[itemId] = {
					etag: null,
					checkedAt,
					latestTimestamp: null,
					excluded: { reason: "not-found", at: checkedAt },
				};
				return;
			}
			counts.failed += 1;
			state.pendingFailures[itemId] = {
				checkedAt,
				error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
			};
		}
	};

	let completed = true;
	for (let offset = 0; offset < itemIds.length; offset += STATE_SAVE_CHUNK) {
		if (deps.shouldStop?.()) {
			completed = false;
			break;
		}
		await mapWithConcurrency(itemIds.slice(offset, offset + STATE_SAVE_CHUNK), deps.concurrency, check);
		deps.saveState();
	}
	for (const key of Object.keys(counts) as (keyof PollCounts)[]) state.sinceFlush[key] += counts[key];
	// An interrupted pass stays due so the next start finishes it.
	if (completed) state.lastPollAt = deps.now();
	deps.saveState();
	return counts;
}
