import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { createJiti } from "jiti";
import { TursoPriceRefreshStore } from "../prices/price-store";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { getDataStatusView } = await jiti.import<typeof import("./shared-api-data")>("./shared-api-data.ts");
const ACTIVE_DATA_RELEASE_IDS = { regular: "test-regular", pve: "test-pve", "pvp-season": "test-season" };

test("status isolates modes and distinguishes changed data from unchanged and failed checks", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
		const store = new TursoPriceRefreshStore(db);
		for (const [index, mode] of (["regular", "pve", "pvp-season"] as const).entries()) {
			await db.execute({
				sql: `INSERT INTO data_releases (mode,release_id,schema_version,generated_at,snapshot_sha256,source_freshness_json,record_counts_json,status)
                      VALUES (?,?,1,1,'hash',?,'{}','ready')`,
				args: [
					mode,
					ACTIVE_DATA_RELEASE_IDS[mode],
					JSON.stringify({ items: 100, stations: 200, quests: 300 + index, crafts: 400 + index, barters: 500 + index }),
				],
			});
			await db.execute({ sql: "INSERT INTO active_data_releases VALUES (?, ?, 1)", args: [mode, ACTIVE_DATA_RELEASE_IDS[mode]] });
			const changedAt = 1000 + index;
			await store.writeOutcomes(mode, [
				{
					status: "updated",
					itemId: "item-a",
					etag: "a",
					checkedAt: changedAt,
					effectivePrice: 100,
					sampleCount: 1,
					totalOfferCount: 5,
					points: [{ price: 100, priceMin: 100, offerCount: 5, timestamp: 500 }],
				},
			]);
			await store.writeOutcomes(mode, [{ status: "not-modified", itemId: "item-a", etag: "a", checkedAt: 2000 + index }]);
			let status = await getDataStatusView(mode, db);
			assert.deepEqual(status.prices, { changedAt, checkedAt: 2000 + index, error: null });
			await store.writeOutcomes(mode, [{ status: "failed", itemId: "item-a", checkedAt: 3000 + index, error: "upstream failed" }]);
			status = await getDataStatusView(mode, db);
			assert.equal(status.mode, mode);
			assert.equal(status.releaseId, ACTIVE_DATA_RELEASE_IDS[mode]);
			assert.equal(status.stations.available, true);
			for (const [domain, expected] of [
				["quests", 300],
				["crafts", 400],
				["barters", 500],
			] as const) {
				assert.equal(status[domain].updatedAt, expected + index);
				assert.equal(status[domain].available, true);
			}
			assert.deepEqual(status.prices, { changedAt, checkedAt: 3000 + index, error: null });
		}
		await db.execute(
			`UPDATE data_releases SET source_freshness_json = '{"items":100,"stations":200,"quests":null,"crafts":400,"barters":"invalid"}' WHERE mode = 'pve'`,
		);
		const partial = await getDataStatusView("pve", db);
		assert.equal(partial.items.available, true);
		assert.equal(partial.quests.available, false);
		assert.equal(partial.quests.updatedAt, null);
		assert.equal(partial.crafts.updatedAt, 400);
		assert.equal(partial.barters.available, false);
		assert.ok(partial.barters.error);
		await db.execute("DELETE FROM item_prices WHERE mode = 'pve'");
		assert.deepEqual((await getDataStatusView("pve", db)).prices, { changedAt: null, checkedAt: null, error: null });
		assert.equal((await getDataStatusView("regular", db)).prices.changedAt, 1000);
		await db.execute("DROP TABLE item_prices");
		const missing = await getDataStatusView("regular", db);
		assert.equal(missing.items.available, true);
		assert.deepEqual(missing.prices, { changedAt: null, checkedAt: null, error: null });
		await db.execute("CREATE TABLE item_prices (mode TEXT)");
		const broken = await getDataStatusView("regular", db);
		assert.equal(broken.items.available, true);
		assert.equal(broken.prices.error, "Price update status could not be loaded.");
	} finally {
		db.close();
	}
});
