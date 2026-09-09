import assert from "node:assert/strict";
import test from "node:test";
import { createQueryClient } from "./client";
import { gameDataKey, removeGameDataScope } from "./scope";
import {
	PartialDataError,
	ResponseValidationError,
	requireComplete,
	shouldRetryRequest,
} from "./request";
import { validateDataStatusPayload } from "./status";

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

test("game data keys isolate mode, domain, and inputs", () => {
	assert.deepEqual(gameDataKey("pve", "item", "id-a"), ["game-data", "pve", "item", "id-a"]);
});

test("inactive retention groups enforce a strict size limit without evicting an in-flight query", async (context) => {
	const client = createQueryClient({ gcTime: Infinity });
	context.after(() => client.clear());
	for (let index = 0; index < 3; index++) {
		client.setQueryDefaults(["bounded", index], { meta: { retentionGroup: "bounded", inactiveQueryLimit: 2 } });
		client.setQueryData(["bounded", index], index);
	}
	let finish!: (value: string) => void;
	const pending = client.fetchQuery({
		queryKey: ["bounded", "pending"],
		meta: { retentionGroup: "bounded", inactiveQueryLimit: 2 },
		queryFn: () => new Promise<string>((resolve) => { finish = resolve; }),
	});
	await tick();
	assert.equal(client.getQueryCache().find({ queryKey: ["bounded", "pending"] })?.state.fetchStatus, "fetching");
	assert.equal(client.getQueryCache().getAll().filter((query) => query.meta?.retentionGroup === "bounded" && query.state.fetchStatus === "idle").length, 2);
	finish("done");
	await pending;
});

test("scope removal cancels and removes only the selected game-data scope", async (context) => {
	const client = createQueryClient({ gcTime: Infinity });
	context.after(() => client.clear());
	const oldKey = gameDataKey("regular", "items");
	const oldRequest = client.fetchQuery({
		queryKey: oldKey,
		queryFn: ({ signal }) => new Promise<number>((resolve, reject) => {
			signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
			setTimeout(() => resolve(1), 20);
		}),
	}).catch(() => undefined);
	await tick();
	client.setQueryData(gameDataKey("pve", "items"), 2);
	client.setQueryData(["map-metadata", "woods"], 3);
	const cleanup = removeGameDataScope(client, "regular");
	client.setQueryData(oldKey, 4);
	await cleanup;
	await oldRequest;
	assert.equal(client.getQueryData(oldKey), 4);
	assert.equal(client.getQueryData(gameDataKey("pve", "items")), 2);
	assert.equal(client.getQueryData(["map-metadata", "woods"]), 3);
});

test("partial payloads remain available on a non-retriable error", () => {
	const payload = { data: [1], errors: { items: "missing" } };
	assert.throws(() => requireComplete(payload, (value) => !value.errors.items), (error) => {
		assert.ok(error instanceof PartialDataError);
		assert.equal(error.payload, payload);
		assert.equal(shouldRetryRequest(0, error), false);
		return true;
	});
});

test("response validation failures never retry", () => {
	assert.equal(shouldRetryRequest(0, new ResponseValidationError("bad")), false);
	assert.throws(() => validateDataStatusPayload({ mode: "pve", releaseId: "" }, "pve"), ResponseValidationError);
});
