import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { postgresSchema } from "../postgres/schema";
import { createJiti } from "jiti";
import path from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const stubDir = mkdtempSync(path.join(tmpdir(), "recipe-cache-test-"));
const cacheStub = path.join(stubDir, "cache.mjs");
writeFileSync(cacheStub, "export function unstable_cache(read) { return read; } export function revalidateTag() {}");
test.after(() => rmSync(stubDir, { recursive: true, force: true }));

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"next/cache": cacheStub,
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { readItemRecipeUsage } = await jiti.import<typeof import("./item-recipe-usage")>("./item-recipe-usage.ts");
const { getRecipes } = await jiti.import<typeof import("./domain-data")>("./domain-data.ts");
const { getItemUsageView } = await jiti.import<typeof import("./item-views")>("./item-views.ts");
const { getStationRecipeGraph } = await jiti.import<typeof import("./station-recipes")>("./station-recipes.ts");
const { postgresFixture } = require("../../../db-scripts/lib/test-postgres.mjs") as {
	postgresFixture: () => Promise<{ pool: import("pg").Pool; close: () => Promise<void> }>;
};

test(
	"indexed item usage reads normalized inputs, including tools/quests, without stored projections",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		const db = drizzle(fixture.pool, { schema: postgresSchema });
		const g = globalThis as typeof globalThis & { __tarkovPostgresDb?: typeof db };
		const oldDb = g.__tarkovPostgresDb;
		g.__tarkovPostgresDb = db;
		try {
			await fixture.pool.query(
				"INSERT INTO items(id,name,normalized_name) VALUES ('root','Root','root'),('output','Output','output')",
			);
			for (const mode of ["regular", "pve", "pvp-season"]) {
				await fixture.pool.query(
					`INSERT INTO catalog_status(mode,content_version,source_freshness) VALUES($1,1,'{"items":100,"crafts":100,"barters":100,"stations":100,"traders":100,"quests":100}')`,
					[mode],
				);
				await fixture.pool.query("INSERT INTO item_modes(item_id,mode) VALUES('root',$1),('output',$1)", [mode]);
				for (const id of ["produce", "consume", "quest", "irrelevant"]) {
					await fixture.pool.query(
						`INSERT INTO crafts(id,mode,product_item_id,product_count,station_id,level,duration,required_items,required_quest_items,game_editions)
				VALUES($1,$2,$3,2,'station',1,60,'null','null','[]')`,
						[id, mode, id === "produce" ? "root" : "output"],
					);
				}
				await fixture.pool.query(
					`INSERT INTO craft_inputs(craft_id,mode,input_kind,position,item_id,count,is_tool) VALUES
				('consume',$1,'item',0,$2,2,null),('consume',$1,'item',1,$2,1,true),
				('consume',$1,'item',2,'missing-synthetic',0.5,false),('quest',$1,'quest',0,$2,1,null)`,
					[mode, mode === "regular" ? "root" : "output"],
				);
				await fixture.pool.query(
					`INSERT INTO barters(id,mode,offered_item_id,offered_count,trader_id,min_trader_level,required_items)
				VALUES('barter',$1,'output',1,'trader',1,'null')`,
					[mode],
				);
				await fixture.pool.query(
					"INSERT INTO barter_inputs(barter_id,mode,position,item_id,count) VALUES('barter',$1,0,$2,3)",
					[mode, mode === "regular" ? "root" : "output"],
				);
			}
			const usage = await readItemRecipeUsage("regular", "root", db, "1");
			assert.deepEqual(
				usage.crafts.map((r) => r.id),
				["produce"],
			);
			assert.deepEqual(
				usage.usedInCrafts.map((r) => r.id),
				["consume", "quest"],
			);
			assert.deepEqual(
				usage.usedInBarters.map((r) => r.id),
				["barter"],
			);
			assert.deepEqual(usage.usedInCrafts[0].requiredItems, [
				{ itemId: "root", count: 2 },
				{ itemId: "root", count: 1, isTool: true },
				{ itemId: "missing-synthetic", count: 0.5, isTool: false },
			]);
			assert.deepEqual(usage.unresolvedItemIds, ["missing-synthetic"]);
			assert.deepEqual(new Set(usage.items.map((i) => i.id)), new Set(["root", "output"]));
			assert.equal(usage.usedInCrafts[1].requiredQuestItems[0].itemId, "root");
			for (const mode of ["pve", "pvp-season"] as const) {
				const other = await readItemRecipeUsage(mode, "root", db, "1");
				assert.deepEqual(other.usedInCrafts, []);
				assert.deepEqual(other.usedInBarters, []);
			}
			const modal = await getItemUsageView("regular", "root", false);
			assert.deepEqual(modal.usedInCrafts, usage.usedInCrafts);
			assert.deepEqual(modal.usedInBarters, usage.usedInBarters);
			assert.equal(modal.items[0].marketPrice, null);
			assert.ok(modal.presentationError, "missing labels are explicit and do not discard recipes");
			const station = await getStationRecipeGraph("regular", "station", "1");
			assert.deepEqual(
				station.crafts.data.find((r) => r.id === "consume")?.requiredItems,
				usage.usedInCrafts[0].requiredItems,
			);
			const full = await getRecipes("regular", db, "1");
			assert.equal(full.crafts.data.length, 4);
			assert.deepEqual(
				full.crafts.data.find((r) => r.id === "consume")?.requiredItems,
				usage.usedInCrafts[0].requiredItems,
			);
			await assert.rejects(readItemRecipeUsage("regular", "unknown", db, "1"), /No item exists/);
			await fixture.pool.query("UPDATE catalog_status SET content_version=2 WHERE mode='regular'");
			await assert.rejects(readItemRecipeUsage("regular", "root", db, "1"), /data changed/);
		} finally {
			g.__tarkovPostgresDb = oldDb;
			await fixture.close();
		}
	},
);
