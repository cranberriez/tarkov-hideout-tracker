import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@libsql/client";
import { createJiti } from "jiti";
import type { ItemSummary } from "../../types/items";

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

test("database pointers switch and roll back; entity, search and detail reads carry mode-specific discovery", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
		await assert.rejects(getActiveDataReleaseId("regular", db), /No ready active/);
		for (const mode of ["regular", "pve"] as const) {
			for (const release of ["old", "new"]) {
				const item = { id: "item-a", name: `${mode} ${release}`, normalizedName: "test-item" };
				await db.execute({ sql: "INSERT INTO data_releases VALUES (?, ?, 1, 1, 'hash', '{\"items\":1}', '{}', 'ready', 1)", args: [mode, release] });
				await db.execute({ sql: "INSERT INTO data_entities VALUES (?, ?, 'item', 'item-a', 'test', 1, ?)", args: [mode, release, JSON.stringify(item)] });
				await db.execute({
					sql: "INSERT INTO item_search VALUES (?, ?, 'item-a', 'test-item', 'testitem', 'test', ?)",
					args: [mode, release, JSON.stringify(item)],
				});
				await db.execute({
					sql: "INSERT INTO item_views VALUES (?, ?, 'item-a', 'relations', 1, ?)",
					args: [mode, release, JSON.stringify({ item, relatedItems: [], freshness: {} })],
				});
			}
			await db.execute({ sql: "INSERT INTO active_data_releases VALUES (?, 'old', 1)", args: [mode] });
			await db.execute({
				sql: "INSERT INTO item_catalog_history VALUES (?, 'item-a', ?, ?, 'old')",
				args: [mode, mode === "regular" ? 1000 : null, mode === "regular" ? "1.1.5.0" : "pre-1.1.5"],
			});
		}
		assert.equal(await getActiveDataReleaseId("regular", db), "old");
		await db.execute("UPDATE active_data_releases SET release_id = 'new' WHERE mode = 'regular'");
		assert.equal(await getActiveDataReleaseId("regular", db), "new");
		assert.equal(await getActiveDataReleaseId("pve", db), "old");
		const entities = await getEntitiesByIds<ItemSummary>("regular", "item", "items", ["item-a", "missing"], db);
		assert.equal(entities.data["item-a"].name, "regular new");
		assert.equal(entities.data["item-a"].firstSeenAt, 1000);
		assert.equal(entities.data.missing, undefined);
		const search = await searchItemPreviews("test", "regular", 10, db);
		assert.equal(search.items[0].firstSeenPatch, "1.1.5.0");
		const detail = await getItemView("pve", "item-a", "relations", db);
		assert.equal(detail.item?.firstSeenAt, null);
		assert.equal(detail.item?.firstSeenPatch, "pre-1.1.5");
		const pinned = await getEntitiesByIds<ItemSummary>("regular", "item", "items", ["item-a"], db, "old");
		assert.equal(pinned.data["item-a"].name, "regular old");
		await db.execute("UPDATE active_data_releases SET release_id = 'old' WHERE mode = 'regular'");
		assert.equal(await getActiveDataReleaseId("regular", db), "old");
		await db.execute("UPDATE data_releases SET status = 'uploading' WHERE mode = 'regular' AND release_id = 'old'");
		await assert.rejects(getActiveDataReleaseId("regular", db), /No ready active/);
	} finally {
		db.close();
	}
});
