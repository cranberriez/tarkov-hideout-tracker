import test from "node:test";
import assert from "node:assert/strict";
import { readTursoDiscovery } from "./turso-discovery.mjs";

const sql = [
	"BEGIN",
	"SELECT item_id, mode, first_seen_at, first_seen_patch, first_seen_release_id FROM item_catalog_history",
	"SELECT mode, baseline_release_id, initialized_at FROM catalog_tracking",
	"SELECT mode, COUNT(*) AS count FROM item_catalog_history GROUP BY mode",
	"ROLLBACK",
];
const text = (value) => (value === null ? { type: "null" } : { type: "text", value });
const integer = (value) => (value === null ? { type: "null" } : { type: "integer", value: String(value) });
const result = (names, rows = []) => ({
	type: "ok",
	response: {
		type: "execute",
		result: {
			cols: names.map((name) => ({ name, decltype: "TEXT" })),
			rows,
			affected_row_count: 0,
			last_insert_rowid: null,
		},
	},
});
const successResponse = () => ({
	results: [
		result([], []),
		result(
			["item_id", "mode", "first_seen_at", "first_seen_patch", "first_seen_release_id"],
			[
				[text("item-a"), text("regular"), integer(1_700_000_000_001), text("0.14.9.0"), text("release-a")],
				[text("item-b"), text("pve"), integer(null), text("pre-1.1.5"), text(null)],
				[text("item-c"), text("pvp-season"), integer(1_700_000_000_003), text("0.14.9.0"), text(null)],
			],
		),
		result(
			["mode", "baseline_release_id", "initialized_at"],
			[
				[text("regular"), text("release-a"), integer(1_700_000_000_100)],
				[text("pve"), text("release-b"), integer(1_700_000_000_101)],
				[text("pvp-season"), text("release-c"), integer(1_700_000_000_102)],
			],
		),
		result(
			["mode", "count"],
			[
				[text("regular"), integer(1)],
				[text("pve"), integer(1)],
				[text("pvp-season"), integer(1)],
			],
		),
		result([], []),
		{ type: "ok", response: { type: "close" } },
	],
});

test("Turso reader uses one read-only transaction and decodes the complete ledger", async () => {
	let request;
	const fetched = await readTursoDiscovery({
		url: "libsql://catalog.example.turso.io",
		authToken: "secret-token",
		fetchImpl: async (url, options) => {
			request = { url, options };
			return { ok: true, json: async () => successResponse() };
		},
	});
	assert.equal(request.url, "https://catalog.example.turso.io/v2/pipeline");
	assert.equal(request.options.method, "POST");
	assert.equal(request.options.redirect, "error");
	assert.equal(request.options.headers.Authorization, "Bearer secret-token");
	assert.equal(request.options.body.includes("secret-token"), false);
	const requests = JSON.parse(request.options.body).requests;
	assert.deepEqual(
		requests.map((entry) => entry.type),
		["execute", "execute", "execute", "execute", "execute", "close"],
	);
	assert.deepEqual(
		requests.slice(0, 5).map((entry) => entry.stmt.sql),
		sql,
	);
	assert.deepEqual(fetched.rows, [
		{
			item_id: "item-a",
			mode: "regular",
			first_seen_at: 1_700_000_000_001,
			first_seen_patch: "0.14.9.0",
			first_seen_release_id: "release-a",
		},
		{ item_id: "item-b", mode: "pve", first_seen_at: null, first_seen_patch: "pre-1.1.5", first_seen_release_id: null },
		{
			item_id: "item-c",
			mode: "pvp-season",
			first_seen_at: 1_700_000_000_003,
			first_seen_patch: "0.14.9.0",
			first_seen_release_id: null,
		},
	]);
	assert.equal(fetched.tracking.length, 3);
	assert.deepEqual(fetched.tracking[0], {
		mode: "regular",
		baseline_release_id: "release-a",
		initialized_at: 1_700_000_000_100,
	});
});

test("Turso reader rejects any failed pipeline step even when the queries succeeded", async () => {
	const body = successResponse();
	body.results[0] = { type: "error", error: { code: "SQL_PARSE_ERROR", message: "private upstream detail" } };
	await assert.rejects(
		readTursoDiscovery({
			url: "turso://catalog.example",
			authToken: "token",
			fetchImpl: async () => ({ ok: true, json: async () => body }),
		}),
		(error) =>
			error.message.includes("pipeline step 1 (begin snapshot) failed [SQL_PARSE_ERROR]") &&
			!error.message.includes("private upstream detail"),
	);
});

test("Turso reader rejects count mismatches and truncated typed rows", async () => {
	const mismatch = successResponse();
	mismatch.results[3] = result(
		["mode", "count"],
		[
			[text("regular"), integer(2)],
			[text("pve"), integer(1)],
			[text("pvp-season"), integer(1)],
		],
	);
	await assert.rejects(
		readTursoDiscovery({
			url: "turso://catalog.example",
			authToken: "token",
			fetchImpl: async () => ({ ok: true, json: async () => mismatch }),
		}),
		/counts did not match/,
	);
	const truncated = successResponse();
	truncated.results[1].response.result.rows[0].pop();
	await assert.rejects(
		readTursoDiscovery({
			url: "turso://catalog.example",
			authToken: "token",
			fetchImpl: async () => ({ ok: true, json: async () => truncated }),
		}),
		/truncated row/,
	);
});

test("Turso reader rejects unsafe integers and non-HTTPS or credential-bearing URLs before fetch", async () => {
	const unsafe = successResponse();
	unsafe.results[1].response.result.rows[0][2] = integer("9007199254740992");
	await assert.rejects(
		readTursoDiscovery({
			url: "https://catalog.example",
			authToken: "token",
			fetchImpl: async () => ({ ok: true, json: async () => unsafe }),
		}),
		/outside the safe range/,
	);
	let calls = 0;
	for (const url of [
		"http://catalog.example",
		"https://user:pass@catalog.example",
		"https://catalog.example/path",
		"not a url",
	]) {
		await assert.rejects(readTursoDiscovery({ url, authToken: "token", fetchImpl: async () => (calls++, {}) }));
	}
	assert.equal(calls, 0);
});
