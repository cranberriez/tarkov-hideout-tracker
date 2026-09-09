import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { compactDatabase } from "./compact.mjs";
import { hashFile } from "./lib/snapshot.mjs";

const modes = ["regular", "pve", "pvp-season"];
const legacyTables = `
CREATE TABLE data_entities(mode TEXT,release_id TEXT,entity_type TEXT,entity_id TEXT,sort_key TEXT,updated_at INTEGER,payload_json TEXT);
CREATE TABLE item_views(mode TEXT,release_id TEXT,item_id TEXT,view_type TEXT,updated_at INTEGER,payload_json TEXT);
CREATE TABLE item_search(mode TEXT,release_id TEXT,item_id TEXT,normalized_name TEXT,compact_name TEXT,sort_name TEXT,preview_json TEXT);
CREATE TABLE data_manifests(mode TEXT,release_id TEXT,manifest_name TEXT,updated_at INTEGER,payload_json TEXT);
CREATE TABLE data_release_pins(mode TEXT PRIMARY KEY,release_id TEXT,pinned_at INTEGER);
`;
async function fixture() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "compact-test-"));
	const source = path.join(root, "active");
	await fs.mkdir(source);
	const client = createClient({ url: "file::memory:" });
	const schema = await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8");
	await client.executeMultiple(
		schema.slice(0, schema.indexOf("CREATE TABLE IF NOT EXISTS data_payloads")) +
			legacyTables +
			schema.slice(schema.indexOf("-- Durable catalog")),
	);
	const records = [
		...["item", "station", "quest", "trader", "skill", "barter", "craft"].map((entityType) => ({
			type: "entity",
			entityType,
			entityId: "x",
			sortKey: "x",
			updatedAt: 10,
			payload: { id: "x", name: "Shared" },
		})),
		{ type: "entity", entityType: "price", entityId: "x", sortKey: "x", updatedAt: 10, payload: { price: 123 } },
		...["relations", "usage", "acquisition"].map((viewType) => ({
			type: "itemView",
			itemId: "x",
			viewType,
			updatedAt: 10,
			payload: { data: [], freshness: { itemsUpdatedAt: 100, pricesUpdatedAt: null } },
		})),
		{
			type: "itemSearch",
			itemId: "x",
			normalizedName: "shared",
			compactName: "shared",
			sortName: "shared",
			payload: { id: "x", name: "Shared" },
		},
		{ type: "manifest", manifestName: "items", updatedAt: 10, payload: ["x"] },
	];
	const manifest = { releaseId: "active", schemaVersion: 1, generatedAt: 10, modes: [] };
	for (const mode of modes) {
		await fs.writeFile(path.join(source, `${mode}.ndjson`), records.map(JSON.stringify).join("\n"));
		const entry = {
			mode,
			file: `${mode}.ndjson`,
			sha256: await hashFile(path.join(source, `${mode}.ndjson`)),
			sourceFreshness: { items: 100 },
			recordCounts: { entity: 8, itemView: 3, itemSearch: 1, manifest: 1 },
			entityCounts: Object.fromEntries(
				["item", "station", "quest", "trader", "skill", "barter", "craft", "price"].map((type) => [type, 1]),
			),
		};
		manifest.modes.push(entry);
		for (const releaseId of ["old", "active"]) {
			await client.execute({
				sql: "INSERT INTO data_releases VALUES(?,?,1,10,?,?,?,'ready',20)",
				args: [
					mode,
					releaseId,
					entry.sha256,
					JSON.stringify(entry.sourceFreshness),
					JSON.stringify(entry.recordCounts),
				],
			});
			await client.execute({
				sql: "INSERT INTO data_entities VALUES(?,?,'item','x','x',10,?)",
				args: [mode, releaseId, JSON.stringify({ id: "x", name: "Shared" })],
			});
			await client.execute({ sql: "INSERT INTO item_views VALUES(?,?,'x','usage',10,'{}')", args: [mode, releaseId] });
			await client.execute({
				sql: "INSERT INTO item_search VALUES(?,?,'x','x','x','x','{}')",
				args: [mode, releaseId],
			});
			await client.execute({ sql: "INSERT INTO data_manifests VALUES(?,?,'items',10,'[]')", args: [mode, releaseId] });
		}
		await client.execute({ sql: "INSERT INTO active_data_releases VALUES(?,'active',20)", args: [mode] });
		await client.execute({ sql: "INSERT INTO data_release_pins VALUES(?,'old',20)", args: [mode] });
		await client.execute({ sql: "INSERT INTO catalog_tracking VALUES(?,'baseline',1)", args: [mode] });
		await client.execute({
			sql: "INSERT INTO item_catalog_history VALUES(?,'x',NULL,'pre-1.1.5','baseline')",
			args: [mode],
		});
		await client.execute({
			sql: "INSERT INTO item_catalog_history VALUES(?,'disappeared',30,'1.1.5.0','old')",
			args: [mode],
		});
		await client.execute({
			sql: "INSERT INTO item_prices(mode,item_id,effective_price,last_checked_at,etag) VALUES(?,'x',456,40,'keep')",
			args: [mode],
		});
		await client.execute({ sql: "INSERT INTO item_price_points VALUES(?,'x',40,456,400,3,50)", args: [mode] });
	}
	await fs.writeFile(path.join(source, "manifest.json"), JSON.stringify(manifest));
	const durable = {};
	for (const table of ["item_prices", "item_price_points", "item_catalog_history", "catalog_tracking"])
		durable[table] = (await client.execute(`SELECT * FROM ${table} ORDER BY mode`)).rows;
	return {
		root,
		source,
		client,
		durable,
		close: async () => {
			client.close();
			await fs.rm(root, { recursive: true, force: true });
		},
	};
}

test("compaction replaces snapshots with deduplicated current views and preserves durable data", async () => {
	const f = await fixture();
	try {
		const result = await compactDatabase(f.client, f.root, () => {});
		assert.equal(result.converted, true);
		assert.equal(result.records, 39);
		const objects = (
			await f.client.execute(
				"SELECT name,type FROM sqlite_master WHERE name IN ('data_entities','item_views','item_search','data_manifests') ORDER BY name",
			)
		).rows;
		assert.equal(objects.length, 4);
		assert.ok(objects.every((row) => row.type === "view"));
		assert.equal(
			(await f.client.execute("SELECT COUNT(*) n FROM sqlite_master WHERE name='data_release_pins'")).rows[0].n,
			0,
		);
		const revisions = (await f.client.execute("SELECT mode,release_id FROM data_releases ORDER BY mode")).rows;
		assert.equal(revisions.length, 3);
		assert.ok(revisions.every((row) => row.release_id === "active"));
		for (const [table, count] of [
			["data_entities", 24],
			["item_views", 9],
			["item_search", 3],
			["data_manifests", 3],
		])
			assert.equal(
				(await f.client.execute(`SELECT COUNT(*) n FROM ${table} WHERE release_id='active'`)).rows[0].n,
				count,
			);
		assert.equal((await f.client.execute("SELECT COUNT(*) n FROM current_records")).rows[0].n, 39);
		assert.equal((await f.client.execute("SELECT COUNT(*) n FROM data_payloads")).rows[0].n, 4);
		assert.equal(
			(
				await f.client.execute(
					"SELECT COUNT(DISTINCT payload_hash) n FROM current_records WHERE record_type='entity' AND variant='item'",
				)
			).rows[0].n,
			1,
		);
		for (const [table, rows] of Object.entries(f.durable))
			assert.deepEqual((await f.client.execute(`SELECT * FROM ${table} ORDER BY mode`)).rows, rows);
		assert.deepEqual(await compactDatabase(f.client, f.root, () => {}), { converted: false });
		assert.equal((await f.client.execute("SELECT COUNT(*) n FROM current_records")).rows[0].n, 39);
	} finally {
		await f.close();
	}
});

test("snapshot checksum mismatch fails before any destructive or staging writes", async () => {
	const f = await fixture();
	try {
		await fs.appendFile(path.join(f.source, "regular.ndjson"), "\n{}");
		await assert.rejects(
			compactDatabase(f.client, f.root, () => {}),
			/checksum/,
		);
		assert.equal((await f.client.execute("SELECT COUNT(*) n FROM data_releases")).rows[0].n, 6);
		assert.equal(
			(await f.client.execute("SELECT type FROM sqlite_master WHERE name='data_entities'")).rows[0].type,
			"table",
		);
		assert.equal(
			(await f.client.execute("SELECT COUNT(*) n FROM sqlite_master WHERE name='current_records'")).rows[0].n,
			0,
		);
		for (const [table, rows] of Object.entries(f.durable))
			assert.deepEqual((await f.client.execute(`SELECT * FROM ${table} ORDER BY mode`)).rows, rows);
	} finally {
		await f.close();
	}
});
