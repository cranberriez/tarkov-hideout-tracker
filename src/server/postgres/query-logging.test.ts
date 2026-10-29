import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { enableQueryLogging, observeClientQueries } from "./query-logging";

function clientWith(query: (...args: unknown[]) => unknown) {
	return { query: query as PoolClient["query"] };
}

test("promise queries preserve arguments, receiver, results and errors", async () => {
	const events: unknown[] = [];
	const config = { text: 'select * from "items" where id = $1', rowMode: "array" };
	const parameters = ["private-value"];
	const result = { rows: [["private-result"]] };
	const failure = new Error("private-error");
	const client = clientWith(function (this: unknown, ...args) {
		assert.equal(this, client);
		assert.equal(args[0], config);
		assert.equal(args[1], parameters);
		return events.length ? Promise.reject(failure) : Promise.resolve(result);
	});
	observeClientQueries(client, (event) => events.push(event));
	assert.equal(await client.query(config, parameters), result);
	await assert.rejects(client.query(config, parameters), (error) => error === failure);
	assert.equal(events.length, 2);
	assert.equal((events[0] as { failed: boolean }).failed, false);
	assert.equal((events[1] as { failed: boolean }).failed, true);
	assert.doesNotMatch(JSON.stringify(events), /private-/);
});

test("callback queries preserve callback arguments and return value", () => {
	const error = new Error("failure");
	const result = { rows: [] };
	for (const failure of [null, error]) {
		const events: { failed: boolean }[] = [];
		const client = clientWith((...args) => {
			(args.at(-1) as (error: Error | null, result: unknown) => void)(failure, result);
			return undefined;
		});
		observeClientQueries(client, (event) => events.push(event));
		let called = false;
		assert.equal(
			client.query("select 1", (receivedError, receivedResult) => {
				called = true;
				assert.equal(receivedError, failure);
				assert.equal(receivedResult, result);
			}),
			undefined,
		);
		assert.equal(called, true);
		assert.deepEqual(
			events.map((event) => event.failed),
			[Boolean(failure)],
		);
	}
});

test("sync errors are preserved and diagnostics cannot break queries", async () => {
	const failure = new Error("failure");
	const events: { failed: boolean }[] = [];
	const broken = clientWith(() => {
		throw failure;
	});
	observeClientQueries(broken, (event) => events.push(event));
	assert.throws(
		() => broken.query("select 1"),
		(error) => error === failure,
	);
	assert.equal(events[0].failed, true);
	const healthy = clientWith(() => Promise.resolve("ok"));
	observeClientQueries(healthy, () => {
		throw new Error("logging failed");
	});
	assert.equal(await healthy.query("select 1"), "ok");
});

test("logging is opt-in; summary logs omit bound data and SQL text", async () => {
	const previous = process.env.PG_QUERY_LOG;
	const originalInfo = console.info;
	const logs: string[] = [];
	try {
		console.info = (message: string) => {
			logs.push(message);
		};
		process.env.PG_QUERY_LOG = "0";
		const disabledPool = new EventEmitter();
		enableQueryLogging(disabledPool as Pool);
		assert.equal(disabledPool.listenerCount("connect"), 0);
		process.env.PG_QUERY_LOG = "1";
		const pool = new EventEmitter();
		enableQueryLogging(pool as Pool);
		const client = clientWith(() => Promise.resolve({ rows: ["private-result"] }));
		pool.emit("connect", client);
		await client.query('select * from "items" where id = $1', ["private-param"]);
		await client.query('select * from "items" where id = $1', ["another-param"]);
		const first = JSON.parse(logs[1].slice("[postgres] ".length));
		const second = JSON.parse(logs[2].slice("[postgres] ".length));
		assert.equal(first.count, 1);
		assert.equal(first.quietMs, null);
		assert.equal(second.count, 2);
		assert.equal(first.query, second.query);
		assert.deepEqual(first.tables, ['"items"']);
		assert.equal(first.sql, undefined);
		assert.ok(second.quietMs >= 0);
		assert.doesNotMatch(logs.join("\n"), /private-|another-param/);
	} finally {
		console.info = originalInfo;
		if (previous === undefined) delete process.env.PG_QUERY_LOG;
		else process.env.PG_QUERY_LOG = previous;
	}
});
