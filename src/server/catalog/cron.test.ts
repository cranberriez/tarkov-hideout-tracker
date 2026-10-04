import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { runCatalogCron } from "./cron";

test("catalog cron authenticates before invoking the updater and reports failures", async (t) => {
	t.mock.method(console, "error", () => {});
	const original = process.env.CRON_SECRET;
	let calls = 0;
	const result = { changed: false, dryRun: false, counts: {} };
	const update = async () => {
		calls++;
		return result;
	};
	const request = (token?: string) =>
		new NextRequest("http://localhost/api/cron/catalog", {
			headers: token ? { authorization: `Bearer ${token}` } : {},
		});
	try {
		delete process.env.CRON_SECRET;
		assert.equal((await runCatalogCron(request(), update)).status, 503);
		process.env.CRON_SECRET = "test-secret";
		assert.equal((await runCatalogCron(request(), update)).status, 401);
		assert.equal((await runCatalogCron(request("wrong"), update)).status, 401);
		assert.equal(calls, 0);
		const response = await runCatalogCron(request("test-secret"), update);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.deepEqual(await response.json(), result);
		assert.equal(calls, 1);
		const failed = await runCatalogCron(request("test-secret"), async () => {
			throw new Error("private database details");
		});
		assert.equal(failed.status, 500);
		assert.deepEqual(await failed.json(), { error: "Scheduled catalog update failed" });
	} finally {
		if (original === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = original;
	}
});
