import test from "node:test";
import assert from "node:assert/strict";
import type { PriceHistoryPoint } from "../../src/types/prices";
import type {
	CatalogPriceRecord,
	PriceRefreshOutcome,
	PriceRefreshStore,
	PriceRefreshSummary,
	PriceSyncState,
} from "../../src/server/prices/types";
import { flushMode, type FlushDependencies } from "./flush";
import { emptyModeState } from "./worker-state";

class MemoryStore implements PriceRefreshStore {
	locked = false;
	lockOwner: string | null = null;
	outcomes: PriceRefreshOutcome[] = [];
	catalogWrites = 0;
	completed: PriceRefreshSummary | null = null;
	syncStates: Record<string, PriceSyncState> = {};
	async getEligibleItemIds() {
		return [];
	}
	async getSyncStates() {
		return this.syncStates;
	}
	async tryAcquireLock(_mode: string, runId: string) {
		if (this.locked) return false;
		this.lockOwner = runId;
		return true;
	}
	async renewLock(_mode: string, runId: string) {
		return this.lockOwner === runId;
	}
	async releaseLock() {
		this.lockOwner = null;
	}
	async startRun() {}
	async writeCatalogPrices() {
		this.catalogWrites += 1;
	}
	async writeOutcomes(_mode: string, _runId: string, outcomes: PriceRefreshOutcome[]) {
		this.outcomes.push(...outcomes);
	}
	async completeRun(_runId: string, summary: PriceRefreshSummary) {
		this.completed = summary;
	}
}

const history: PriceHistoryPoint[] = [1, 2, 3, 4].map((hour) => ({
	timestamp: Date.UTC(2026, 8, 1) + hour * 3_600_000,
	price: 110,
	priceMin: 100,
	offerCount: 8,
}));

function setup(store: MemoryStore, overrides: Partial<FlushDependencies> = {}): FlushDependencies {
	return {
		store,
		readHistory: (_mode, itemId) => (itemId === "lost" ? null : history),
		fetchCatalogPrices: async (): Promise<CatalogPriceRecord[]> => [{ itemId: "a", marketPrice: {} }],
		saveState: () => undefined,
		now: () => Date.UTC(2026, 8, 2),
		newRunId: () => "run-1",
		catalogDue: false,
		...overrides,
	};
}

function dirtyState() {
	const state = emptyModeState();
	state.eligibleIds = ["a", "b", "quiet", "lost"];
	state.items.a = { etag: '"a"', checkedAt: 10, latestTimestamp: history.at(-1)!.timestamp, dirty: true };
	state.items.b = { etag: '"b"', checkedAt: 10, latestTimestamp: history.at(-1)!.timestamp, dirty: true };
	state.items.quiet = { etag: '"q"', checkedAt: 10, latestTimestamp: 1 };
	state.items.lost = { etag: '"l"', checkedAt: 10, latestTimestamp: 1, dirty: true };
	state.pendingFailures.quiet = { checkedAt: 10, error: "timeout" };
	state.sinceFlush = { checked: 4, updated: 2, notModified: 1, failed: 1, excluded: 0 };
	return state;
}

test("idle when nothing changed and no catalog refresh is due", async () => {
	const store = new MemoryStore();
	assert.deepEqual(await flushMode("pve", emptyModeState(), setup(store)), { status: "idle" });
	assert.equal(store.completed, null);
});

test("pushes only changed items and failures, then clears the buffer", async () => {
	const store = new MemoryStore();
	const state = dirtyState();
	const result = await flushMode("pvp-season", state, setup(store));

	assert.equal(result.status, "completed");
	assert.deepEqual(
		store.outcomes.map((outcome) => [outcome.itemId, outcome.status]),
		[
			["a", "updated"],
			["b", "updated"],
			["quiet", "failed"],
		],
	);
	const updated = store.outcomes[0] as Extract<PriceRefreshOutcome, { status: "updated" }>;
	assert.equal(updated.effectivePrice, 100);
	assert.equal(updated.etag, '"a"');
	assert.equal(state.items.a.dirty, false);
	assert.deepEqual(state.pendingFailures, {});
	assert.deepEqual(state.items.lost, { etag: null, checkedAt: 10, latestTimestamp: null });
	assert.equal(store.completed?.status, "partial");
	assert.equal(store.completed?.source, "worker");
	assert.equal(store.completed?.changedCount, 2);
	assert.equal(store.completed?.notModifiedCount, 1);
	assert.deepEqual(state.sinceFlush, { checked: 0, updated: 0, notModified: 0, failed: 0, excluded: 0 });
	assert.equal(store.lockOwner, null);
});

test("newer stored points supersede the buffered history", async () => {
	const store = new MemoryStore();
	store.syncStates.a = { etag: '"newer"', latestPointTimestamp: history.at(-1)!.timestamp + 1 };
	const state = dirtyState();
	const result = await flushMode("regular", state, setup(store));
	assert.equal(result.status === "completed" && result.supersededCount, 1);
	assert.ok(!store.outcomes.some((outcome) => outcome.itemId === "a"));
	assert.equal(state.items.a.dirty, false);
});

test("a held lease keeps the buffer for the next flush", async () => {
	const store = new MemoryStore();
	store.locked = true;
	const state = dirtyState();
	assert.deepEqual(await flushMode("regular", state, setup(store)), { status: "locked" });
	assert.equal(state.items.a.dirty, true);
	assert.equal(state.lastFlushAt, null);
});

test("catalog refresh failures are reported without blocking price pushes", async () => {
	const store = new MemoryStore();
	const state = dirtyState();
	delete state.pendingFailures.quiet;
	await flushMode(
		"pve",
		state,
		setup(store, {
			catalogDue: true,
			fetchCatalogPrices: async () => {
				throw new Error("dataset empty");
			},
		}),
	);
	assert.equal(store.completed?.catalogPriceStatus, "failed");
	assert.equal(store.completed?.status, "partial");
	assert.equal(store.completed?.changedCount, 2);
	assert.equal(state.lastCatalogAt, null);
});
