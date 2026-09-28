import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clearExclusions, emptyModeState, setEligible, WorkerStateStore } from "./worker-state";

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
