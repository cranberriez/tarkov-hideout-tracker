import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCatalogIfDue, CATALOG_REFRESH_MS, CATALOG_RETRY_MS } from "./catalog";
import { WorkerStateStore } from "./worker-state";

test("catalog success survives restart; failed attempts back off without advancing success", async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-schedule-"));
	try {
		let store = new WorkerStateStore(directory);
		let now = 1000;
		let calls = 0;
		let fail = false;
		const run = () =>
			runCatalogIfDue({
				load: () => store.loadCatalog(),
				save: (state) => store.saveCatalog(state),
				now: () => now,
				refresh: async () => {
					calls++;
					if (fail) throw new Error("provider failed");
					return { changed: false };
				},
			});
		await run();
		assert.equal(store.loadCatalog().lastSuccessAt, now);
		store = new WorkerStateStore(directory);
		await run();
		assert.equal(calls, 1);
		now += CATALOG_REFRESH_MS;
		fail = true;
		await assert.rejects(run(), /provider failed/);
		assert.equal(store.loadCatalog().lastSuccessAt, 1000);
		store = new WorkerStateStore(directory);
		now += CATALOG_RETRY_MS - 1;
		await run();
		assert.equal(calls, 2);
		now++;
		fail = false;
		await run();
		assert.equal(calls, 3);
		assert.equal(store.loadCatalog().lastSuccessAt, now);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});
