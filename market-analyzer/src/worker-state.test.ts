import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	clearExclusions,
	emptyModeState,
	lockHolderAlive,
	setEligible,
	WorkerStateStore,
	type LockRecord,
} from "./worker-state";

function temporaryStore() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "market-analyzer-"));
	return {
		store: new WorkerStateStore(directory),
		cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
	};
}

test("mode state and compact histories round-trip", () => {
	const { store, cleanup } = temporaryStore();
	try {
		assert.deepEqual(store.loadMode("pve"), emptyModeState());
		const state = emptyModeState();
		state.items.a = { etag: '"x"', checkedAt: 1, latestTimestamp: 2, dirty: true };
		store.saveMode("pve", state);
		assert.deepEqual(store.loadMode("pve"), state);

		const points = [{ timestamp: 2, price: 11, priceMin: 10, offerCount: null }];
		store.writeHistory("pve", "a", points, '"x"');
		assert.deepEqual(store.readHistory("pve", "a"), points);
		assert.equal(store.readHistory("pve", "missing"), null);
		assert.throws(() => store.readHistory("pve", "../escape"), /unsafe/);
	} finally {
		cleanup();
	}
});

test("recheck requests are consumed once and clear exclusions", () => {
	const { store, cleanup } = temporaryStore();
	try {
		assert.equal(store.consumeRecheck("regular"), false);
		store.requestRecheck("regular");
		assert.equal(store.consumeRecheck("regular"), true);
		assert.equal(store.consumeRecheck("regular"), false);

		const state = emptyModeState();
		state.items.a = { etag: null, checkedAt: 1, latestTimestamp: null, excluded: { reason: "not-found", at: 1 } };
		state.items.b = { etag: null, checkedAt: 1, latestTimestamp: 3 };
		assert.equal(clearExclusions(state), 1);
		assert.equal(state.items.a.excluded, undefined);
	} finally {
		cleanup();
	}
});

test("eligible refresh forgets items that left the catalog", () => {
	const state = emptyModeState();
	state.items.gone = { etag: null, checkedAt: 1, latestTimestamp: 1 };
	state.items.kept = { etag: null, checkedAt: 1, latestTimestamp: 1 };
	state.pendingFailures.gone = { checkedAt: 1, error: "x" };
	setEligible(state, ["kept", "new"], 9);
	assert.deepEqual(Object.keys(state.items), ["kept"]);
	assert.deepEqual(state.pendingFailures, {});
	assert.equal(state.eligibleAt, 9);
});

const MINUTE = 60_000;
const record = (overrides: Partial<LockRecord>): LockRecord => ({
	instanceId: "self",
	hostname: "container-a",
	pid: 1,
	heartbeatAt: 100 * MINUTE,
	...overrides,
});

test("a second worker on the same volume is refused while the holder is alive", () => {
	const { store, cleanup } = temporaryStore();
	try {
		const first = record({ instanceId: "first", hostname: "container-a" });
		const second = record({ instanceId: "second", hostname: "container-b" });
		assert.equal(store.acquireLock(first, 10 * MINUTE), null);
		assert.equal(store.acquireLock(second, 10 * MINUTE)?.instanceId, "first");
		assert.equal(store.refreshLock(first), true);
		store.releaseLock(second);
		assert.equal(store.readLock()?.instanceId, "first");
		store.releaseLock(first);
		assert.equal(store.readLock(), null);
		assert.equal(store.acquireLock(second, 10 * MINUTE), null);
		assert.equal(store.refreshLock(first), false);
	} finally {
		cleanup();
	}
});

test("lock holder liveness", () => {
	const self = record({ instanceId: "new" });
	const never = () => assert.fail("pid check not expected");
	// Another container with a fresh heartbeat is alive; a stale one is abandoned.
	assert.equal(
		lockHolderAlive(record({ hostname: "other", heartbeatAt: 99 * MINUTE }), self, 10 * MINUTE, never),
		true,
	);
	assert.equal(
		lockHolderAlive(record({ hostname: "other", heartbeatAt: 80 * MINUTE }), self, 10 * MINUTE, never),
		false,
	);
	// Same container restarted as the same PID: our own previous life.
	assert.equal(lockHolderAlive(record({ instanceId: "old" }), self, 10 * MINUTE, never), false);
	// Same container, different process (e.g. docker exec): ask the OS.
	assert.equal(
		lockHolderAlive(record({ pid: 41 }), self, 10 * MINUTE, () => true),
		true,
	);
	assert.equal(
		lockHolderAlive(record({ pid: 41 }), self, 10 * MINUTE, () => false),
		false,
	);
});

test("run requests queue in order and are consumed once", () => {
	const { store, cleanup } = temporaryStore();
	try {
		assert.equal(store.hasRunRequests(), false);
		assert.deepEqual(store.consumeRunRequests(), []);
		store.requestRun("pvp-season:analyze");
		store.requestRun("pve:poll");
		assert.equal(store.hasRunRequests(), true);
		assert.deepEqual(store.consumeRunRequests().sort(), ["pve:poll", "pvp-season:analyze"]);
		assert.equal(store.hasRunRequests(), false);
	} finally {
		cleanup();
	}
});
