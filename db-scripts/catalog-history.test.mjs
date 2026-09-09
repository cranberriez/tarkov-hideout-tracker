import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { BASELINE_RELEASE_ID, initializeCatalogHistory, getKnownItemIds, catalogPublicationStatements, newCatalogItems } from "./lib/catalog-history.mjs";
import { encodeRecord, payloadStatement, currentRecordStatement } from "./lib/current-storage.mjs";
import { compareEntities } from "./lib/release-diff.mjs";
import { readReleasePrices, preserveItemPrices } from "./lib/release-prices.mjs";

// Fixture replacement models a current revision; discovery history is independently durable.
async function release(db, mode, id, status = "ready", items = ["old"]) {
	const statements = [
		{ sql: "INSERT INTO data_releases VALUES (?, ?, 1, 1, 'hash', '{}', '{}', ?, NULL)", args: [mode, id, status] },
		{ sql: "DELETE FROM current_records WHERE mode = ?", args: [mode] },
		{ sql: "INSERT INTO active_data_releases VALUES (?, ?, 1) ON CONFLICT(mode) DO UPDATE SET release_id = excluded.release_id", args: [mode, id] },
		{ sql: "DELETE FROM data_releases WHERE mode = ? AND release_id <> ?", args: [mode, id] },
	];
	for (const item of items) {
		const record = encodeRecord(mode, { type: "entity", entityType: "item", entityId: item, updatedAt: 1, payload: { id: item, name: item } });
		statements.push(payloadStatement(record), currentRecordStatement(record));
	}
	await db.batch(statements, "write");
}

test("baseline, first publication, retries, disappearance and mode isolation preserve history", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
		for (const mode of ["regular", "pve", "pvp-season"]) await release(db, mode, BASELINE_RELEASE_ID);
		assert.deepEqual([...(await getKnownItemIds(db, "regular"))], []);
		assert.equal((await db.execute("SELECT COUNT(*) AS n FROM item_catalog_history")).rows[0].n, 0, "checking does not consume discoveries");
		await initializeCatalogHistory(db, ["regular", "pve", "pvp-season"]);
		await release(db, "regular", "patch", "uploading", ["old", "new"]);
		assert.deepEqual(
			newCatalogItems(
				[
					{ id: "new", name: "New" },
					{ id: "old", name: "Old" },
				],
				await getKnownItemIds(db, "regular"),
			),
			[{ id: "new", name: "New" }],
		);
		await assert.rejects(
			db.batch([...catalogPublicationStatements("regular", "patch", "1.1.5.0", 1000), { sql: "INSERT INTO missing_table VALUES (1)", args: [] }], "write"),
		);
		assert.equal((await getKnownItemIds(db, "regular")).has("new"), false, "failed publication rolls back dates");
		await db.batch(catalogPublicationStatements("regular", "patch", "1.1.5.0", 1000), "write");
		await db.batch(catalogPublicationStatements("regular", "patch", "1.1.6.0", 2000), "write");
		await release(db, "regular", "absent", "uploading", ["old"]);
		await db.batch(catalogPublicationStatements("regular", "absent", "1.1.6.0", 3000), "write");
		await release(db, "regular", "returns", "uploading", ["old", "new"]);
		await db.batch(catalogPublicationStatements("regular", "returns", "1.1.6.0", 4000), "write");
		assert.equal((await db.execute({ sql: "SELECT COUNT(*) AS n FROM data_releases WHERE mode = ? AND release_id = ?", args: ["regular", BASELINE_RELEASE_ID] })).rows[0].n, 0, "the old baseline revision is no longer stored");
		await initializeCatalogHistory(db, ["regular"]);
		const result = await db.execute("SELECT first_seen_at, first_seen_patch, first_seen_release_id FROM item_catalog_history WHERE mode = 'regular' ORDER BY item_id");
		assert.deepEqual(
			result.rows.map((row) => [row.first_seen_at, row.first_seen_patch, row.first_seen_release_id]),
			[
				[1000, "1.1.5.0", "patch"],
				[null, "pre-1.1.5", BASELINE_RELEASE_ID],
			],
		);
		assert.equal((await getKnownItemIds(db, "pve")).has("new"), false);
	} finally {
		db.close();
	}
});

test("missing baseline fails all requested initialization without classifying items", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
		await release(db, "regular", BASELINE_RELEASE_ID);
		await assert.rejects(initializeCatalogHistory(db, ["regular", "pve"]), /Missing ready item baseline/);
		assert.equal((await db.execute("SELECT COUNT(*) AS n FROM item_catalog_history")).rows[0].n, 0);
	} finally {
		db.close();
	}
});

test("full data update preserves fallback prices and does not accept new upstream prices", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
		await release(db, "regular", "old");
		const price = encodeRecord("regular", { type: "entity", entityType: "price", entityId: "old", updatedAt: 123, payload: { avg24hPrice: 50 } });
		await db.batch([payloadStatement(price), currentRecordStatement(price)], "write");
		const stored = await readReleasePrices(db, "regular");
		const items = [
			{ id: "old", marketPrice: { avg24hPrice: 999 } },
			{ id: "new", marketPrice: { avg24hPrice: 999 } },
		];
		assert.deepEqual(
			preserveItemPrices(items, stored.prices).map((item) => item.marketPrice),
			[{ avg24hPrice: 50 }, null],
		);
		assert.equal(stored.prices.get("old").updatedAt, 123);
		assert.equal(items[0].marketPrice.avg24hPrice, 999);
		await release(db, "pve", "pve-current");
		await assert.rejects(readReleasePrices(db, "pve"), /No price snapshot/);
	} finally {
		db.close();
	}
});

test("diff reports additions, removals and content changes while ignoring JSON key order", () => {
	const old = new Map([
		[
			"quest",
			new Map([
				["same", { id: "same", name: "Same" }],
				["changed", { id: "changed", count: 1 }],
				["gone", { id: "gone" }],
			]),
		],
	]);
	const current = new Map([
		[
			"quest",
			new Map([
				["same", { name: "Same", id: "same" }],
				["changed", { id: "changed", count: 2 }],
				["new", { id: "new" }],
			]),
		],
	]);
	assert.deepEqual(compareEntities(old, current).quest, { added: [{ id: "new" }], changed: [{ id: "changed" }], removed: [{ id: "gone" }] });
});
