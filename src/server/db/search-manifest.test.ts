import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "@libsql/client";
import { createRequire } from "node:module";
import path from "node:path";
import { createJiti } from "jiti";
const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { readSearchManifest } = await jiti.import<typeof import("./search-manifest")>("./search-manifest.ts");

const stored = {
	v: 1,
	mode: "regular",
	items: [{ id: "i", nn: "item", n: "Item" }],
	quests: [{ id: "q", nn: "quest", n: "Quest", ti: "t" }],
	traders: { t: { n: "Trader" } },
};
function database(responses: unknown[][]) {
	const requests: { args: unknown[] }[] = [];
	return {
		requests,
		client: {
			execute: async (request: { args: unknown[] }) => {
				requests.push(request);
				return { rows: responses.shift() ?? [] };
			},
		} as unknown as Client,
	};
}

test("stored manifest uses a single revision-scoped payload read", async () => {
	const db = database([[{ payload_json: JSON.stringify(stored) }]]);
	const result = await readSearchManifest("regular", "r1", db.client);
	assert.equal(result.releaseId, "r1");
	assert.deepEqual(result.items, stored.items);
	assert.deepEqual(
		db.requests.map((request) => request.args),
		[["regular", "r1", "compact-search-v1"]],
	);
});

test("old release fallback uses only three stored summaries pinned to the same revision", async () => {
	const db = database([
		[],
		[
			{
				manifest_name: "items",
				payload_json: JSON.stringify({ previews: [{ id: "i", name: "Item", normalizedName: "item" }] }),
			},
			{
				manifest_name: "quests",
				payload_json: JSON.stringify({
					previews: [
						{
							id: "q",
							name: "Quest",
							normalizedName: "quest",
							trader: { id: "t", name: "Trader", normalizedName: "trader" },
						},
					],
				}),
			},
			{
				manifest_name: "traders",
				payload_json: JSON.stringify({ records: [{ id: "t", name: "Trader", normalizedName: "trader" }] }),
			},
		],
	]);
	assert.deepEqual(await readSearchManifest("regular", "r1", db.client), { ...stored, releaseId: "r1" });
	assert.deepEqual(db.requests[1].args, ["regular", "r1", "items", "quests", "traders"]);
});

test("missing revision, malformed stored content and scope mismatches fail explicitly", async () => {
	for (const responses of [
		[[], []],
		[[{ payload_json: "{}" }]],
		[[{ payload_json: JSON.stringify({ ...stored, mode: "pve" }) }]],
	]) {
		await assert.rejects(readSearchManifest("regular", "r1", database(responses).client));
	}
});
