import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient, type Client } from "@libsql/client";
import { createJiti } from "jiti";
import type { ItemSummary } from "../../types/items";
import { insertCurrentTestRecord } from "./current-test-fixture";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { getActiveDataReleaseId } = await jiti.import<typeof import("./release-config")>("./release-config.ts");
const { getEntitiesByIds } = await jiti.import<typeof import("./entity-data")>("./entity-data.ts");
const { searchItemPreviews } = await jiti.import<typeof import("./item-search")>("./item-search.ts");
const { getItemView } = await jiti.import<typeof import("./item-views")>("./item-views.ts");

async function publish(db: Client, mode: string, revision: string) {
	await db.execute({
		sql: `INSERT INTO data_releases VALUES (?, ?, 1, 1, 'hash', '{"items":100,"quests":200}', '{}', 'ready', 1)`,
		args: [mode, revision],
	});
	await db.execute({
		sql: "INSERT INTO active_data_releases VALUES (?, ?, 1) ON CONFLICT(mode) DO UPDATE SET release_id = excluded.release_id",
		args: [mode, revision],
	});
	await db.execute({ sql: "DELETE FROM data_releases WHERE mode = ? AND release_id <> ?", args: [mode, revision] });
	const item = { id: "item-a", name: `${mode} ${revision}`, normalizedName: "test-item" };
	await insertCurrentTestRecord(db, mode, "entity", "item-a", "item", item);
	await insertCurrentTestRecord(db, mode, "itemSearch", "item-a", "", item);
	await insertCurrentTestRecord(db, mode, "itemView", "item-a", "relations", {
		item,
		relatedItems: [],
		freshness: { itemsUpdatedAt: 0, questsUpdatedAt: 0, stationsUpdatedAt: null },
	});
}

test("current revisions isolate modes, retain discovery and hydrate metadata-only freshness", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
		await assert.rejects(getActiveDataReleaseId("regular", db), /No ready active/);
		for (const mode of ["regular", "pve"] as const) {
			await publish(db, mode, "old");
			await db.execute({
				sql: "INSERT INTO item_catalog_history VALUES (?, 'item-a', ?, ?, 'old')",
				args: [mode, mode === "regular" ? 1000 : null, mode === "regular" ? "1.1.5.0" : "pre-1.1.5"],
			});
		}
		await publish(db, "regular", "new");
		assert.equal(await getActiveDataReleaseId("regular", db), "new");
		assert.equal(await getActiveDataReleaseId("regular", db), "new");
		assert.equal(await getActiveDataReleaseId("pve", db), "old");
		const entities = await getEntitiesByIds<ItemSummary>("regular", "item", "items", ["item-a", "missing"], db);
		assert.equal(entities.data["item-a"].name, "regular new");
		assert.equal(entities.data["item-a"].firstSeenAt, 1000);
		assert.equal(entities.data.missing, undefined);
		assert.equal((await searchItemPreviews("test", "regular", 10, db)).items[0].firstSeenPatch, "1.1.5.0");
		assert.deepEqual((await searchItemPreviews("absent", "regular", 10, db)).items, []);
		const detail = await getItemView("pve", "item-a", "relations", db);
		assert.equal(detail.item?.firstSeenAt, null);
		assert.equal(detail.item?.firstSeenPatch, "pre-1.1.5");
		assert.equal(detail.freshness.itemsUpdatedAt, 100);
		assert.equal(detail.freshness.stationsUpdatedAt, null);
		await db.execute(
			`UPDATE data_releases SET source_freshness_json = '{"items":500,"quests":600}' WHERE mode = 'pve'`,
		);
		assert.equal((await getItemView("pve", "item-a", "relations", db)).freshness.itemsUpdatedAt, 500);
		await assert.rejects(getEntitiesByIds("regular", "item", "items", ["item-a"], db, "old"), /No ready data release/);
	} finally {
		db.close();
	}
});

test("publication between revision selection and search or detail fails explicitly", async () => {
	for (const read of [
		() => searchItemPreviews("test", "regular", 10, client),
		() => getItemView("regular", "item-a", "relations", client),
	]) {
		await assert.rejects(read(), /No .* (release|view)/);
	}
});
const client = {
	execute: async (statement: { sql: string }) => ({
		rows: statement.sql.includes("SELECT active.release_id") ? [{ release_id: "removed" }] : [],
	}),
} as unknown as Client;

test("obsolete development overrides cannot enter release selection", async () => {
	const source = await readFile("src/server/db/release-config.ts", "utf8");
	assert.doesNotMatch(source, /next\/headers|getDevReleaseOverride|validateReleaseOverride/);
});
