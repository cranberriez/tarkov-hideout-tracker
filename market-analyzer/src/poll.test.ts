import test from "node:test";
import assert from "node:assert/strict";
import type { PriceHistoryPoint } from "../../src/types/prices";
import { PriceHistoryHttpError, type PriceHistoryFetchResult } from "../../src/server/services/priceHistory";
import { pollMode } from "./poll";
import { emptyModeState } from "./worker-state";

const point = (timestamp: number, priceMin = 100): PriceHistoryPoint => ({
	timestamp,
	price: priceMin,
	priceMin,
	offerCount: 5,
});

function harness(responses: Record<string, () => PriceHistoryFetchResult>) {
	const state = emptyModeState();
	state.eligibleIds = Object.keys(responses);
	const written = new Map<string, readonly PriceHistoryPoint[]>();
	const requests: { itemId: string; etag: string | null }[] = [];
	const deps = {
		fetchHistory: async (_mode: string, itemId: string, etag: string | null) => {
			requests.push({ itemId, etag });
			return responses[itemId]();
		},
		writeHistory: (_mode: string, itemId: string, points: readonly PriceHistoryPoint[]) => {
			written.set(itemId, points);
		},
		saveState: () => undefined,
		now: () => 1_000,
		concurrency: 4,
	};
	return { state, written, requests, deps };
}

test("classifies updates, not-modified checks, exclusions and transient failures", async () => {
	const { state, written, requests, deps } = harness({
		changed: () => ({ status: "updated", etag: '"b"', data: [point(10), point(20)] }),
		same: () => ({ status: "not-modified", etag: '"s"' }),
		gone: () => {
			throw new PriceHistoryHttpError(404);
		},
		empty: () => ({ status: "updated", etag: '"e"', data: [] }),
		flaky: () => {
			throw new PriceHistoryHttpError(502);
		},
	});
	state.items.same = { etag: '"s"', checkedAt: 1, latestTimestamp: 5 };
	state.items.changed = { etag: '"a"', checkedAt: 1, latestTimestamp: 10, analyzedTimestamp: 10 };

	const counts = await pollMode("pvp-season", state, deps);

	assert.deepEqual(counts, { checked: 5, updated: 1, notModified: 1, failed: 1, excluded: 2 });
	assert.deepEqual(state.items.changed, {
		etag: '"b"',
		checkedAt: 1_000,
		latestTimestamp: 20,
		dirty: true,
		analyzedTimestamp: 10,
	});
	assert.equal(written.get("changed")?.length, 2);
	assert.equal(state.items.same.checkedAt, 1_000);
	assert.equal(state.items.same.dirty, undefined);
	assert.equal(state.items.gone.excluded?.reason, "not-found");
	assert.equal(state.items.empty.excluded?.reason, "no-history");
	assert.match(state.pendingFailures.flaky.error, /502/);
	assert.deepEqual(state.sinceFlush, counts);
	assert.equal(state.lastPollAt, 1_000);
	assert.equal(requests.find((request) => request.itemId === "same")?.etag, '"s"');
	assert.equal(requests.find((request) => request.itemId === "gone")?.etag, null);
});

test("excluded items are skipped and a success clears an earlier failure", async () => {
	const { state, requests, deps } = harness({
		excluded: () => assert.fail("excluded items must not be requested"),
		recovered: () => ({ status: "updated", etag: null, data: [point(10)] }),
	});
	state.items.excluded = { etag: null, checkedAt: 1, latestTimestamp: null, excluded: { reason: "not-found", at: 1 } };
	state.pendingFailures.recovered = { checkedAt: 1, error: "timeout" };

	await pollMode("pve", state, deps);

	assert.deepEqual(
		requests.map((request) => request.itemId),
		["recovered"],
	);
	assert.equal(state.pendingFailures.recovered, undefined);
});

test("older upstream data than the cache is a failure, not an overwrite", async () => {
	const { state, written, deps } = harness({
		regress: () => ({ status: "updated", etag: '"x"', data: [point(5)] }),
	});
	state.items.regress = { etag: '"y"', checkedAt: 1, latestTimestamp: 10 };
	await pollMode("regular", state, deps);
	assert.equal(written.size, 0);
	assert.match(state.pendingFailures.regress.error, /older/);
	assert.equal(state.items.regress.latestTimestamp, 10);
});

test("a stop request leaves the pass due", async () => {
	const { state, deps } = harness({ a: () => ({ status: "not-modified", etag: null }) });
	await pollMode("regular", state, { ...deps, shouldStop: () => true });
	assert.equal(state.lastPollAt, null);
});
