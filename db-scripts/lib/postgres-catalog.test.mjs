import test from "node:test";
import assert from "node:assert/strict";
import { applyCatalogUpdate, readCatalogBaseline } from "./postgres-catalog.mjs";
import { createDiscoveryExport } from "./discovery.mjs";
import { postgresFixture } from "./test-postgres.mjs";

function modeData(mode, suffix = "") {
	const itemId = `item-${mode}${suffix}`;
	return {
		items: [
			{
				id: itemId,
				name: `Item ${mode}${suffix}`,
				normalizedName: `item-${mode}${suffix}`,
				onFleaMarket: true,
				category: { name: "Test" },
				marketPrice: { price: 123 },
				buyFromTrader: [{ priceRUB: 4 }],
			},
		],
		stations: [
			{
				id: "station-shared",
				name: "Station",
				normalizedName: "station",
				levels: [
					{
						id: "level-stable",
						level: 1,
						constructionTime: 10,
						stationLevelRequirements: [],
						skillRequirements: [],
						traderRequirements: [],
						itemRequirements: [{ id: "requirement-stable", itemId, count: 2, isFir: true, isTool: false }],
					},
				],
			},
		],
		traders: [{ id: "trader", name: "Trader", normalizedName: "trader" }],
		quests: [
			{
				id: "quest",
				name: "Quest",
				normalizedName: "quest",
				trader: { id: "trader" },
				experience: 1,
				objectives: [{ id: "objective-stable", type: "findItem" }],
				taskRequirements: [],
				failConditions: [],
				traderRequirements: [],
				otherRequirements: [],
			},
		],
		skills: [{ id: "skill", name: "Skill" }],
		crafts: [
			{
				id: "craft-stable",
				productItemId: itemId,
				productCount: 1,
				stationId: "station-shared",
				level: 1,
				duration: 10,
				requiredItems: [{ itemId, count: 1 }],
				requiredQuestItems: [],
				gameEditions: [],
			},
		],
		barters: [
			{
				id: "barter-stable",
				offeredItemId: itemId,
				offeredCount: 1,
				traderId: "trader",
				minTraderLevel: 1,
				requiredItems: [],
			},
		],
		itemDetails: [
			{ itemId, relations: { item: { id: itemId } }, usage: {}, acquisition: { rootItemId: itemId, errors: {} } },
		],
		freshness: { items: 10, stations: 10, quests: 10 },
	};
}
function completeData(suffix = "") {
	return Object.fromEntries(["regular", "pve", "pvp-season"].map((mode) => [mode, modeData(mode, suffix)]));
}

test(
	"catalog bootstraps an unknown baseline without an import and preserves it across removal and return",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			for (const mode of ["regular", "pve", "pvp-season"])
				await fixture.pool.query("INSERT INTO catalog_status(mode,discovery_initialized) VALUES($1,false)", [mode]);
			const data = completeData();
			const baseline = await readCatalogBaseline(fixture.pool);
			assert.deepEqual(baseline, { regular: "0", pve: "0", "pvp-season": "0" });
			const preview = await applyCatalogUpdate(fixture.pool, data, 1000, { dryRun: true, baseline });
			assert.deepEqual(preview.newItems, { regular: [], pve: [], "pvp-season": [] });
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM catalog_status")).rows[0].count), 3);
			assert.equal(
				Number(
					(await fixture.pool.query("SELECT count(*) FROM catalog_status WHERE discovery_initialized")).rows[0].count,
				),
				0,
			);
			await applyCatalogUpdate(fixture.pool, data, 1000, { baseline });
			const unknown = await fixture.pool.query(
				"SELECT first_seen_at, first_seen_patch, legacy_first_seen_release_id FROM item_discovery ORDER BY mode",
			);
			assert.equal(unknown.rowCount, 3);
			assert.ok(
				unknown.rows.every(
					(row) =>
						row.first_seen_at === null && row.first_seen_patch === null && row.legacy_first_seen_release_id === null,
				),
			);
			assert.equal(
				(await fixture.pool.query("SELECT count(*) FROM catalog_status WHERE discovery_initialized")).rows[0].count,
				"3",
			);
			const seenBaseline = await readCatalogBaseline(fixture.pool);
			const noOp = await applyCatalogUpdate(fixture.pool, data, 1500, { baseline: seenBaseline });
			assert.equal(noOp.changed, false);
			const newBaseline = await readCatalogBaseline(fixture.pool);
			await applyCatalogUpdate(fixture.pool, completeData("-new"), 2000, { baseline: newBaseline });
			const later = (
				await fixture.pool.query(
					"SELECT first_seen_at, first_seen_patch FROM item_discovery WHERE item_id='item-regular-new' AND mode='regular'",
				)
			).rows[0];
			assert.equal(Number(later.first_seen_at), 2000);
			assert.equal(later.first_seen_patch, null);
			const returningBaseline = await readCatalogBaseline(fixture.pool);
			await applyCatalogUpdate(fixture.pool, data, 3000, { baseline: returningBaseline });
			const returned = (
				await fixture.pool.query(
					"SELECT first_seen_at, first_seen_patch FROM item_discovery WHERE item_id='item-regular' AND mode='regular'",
				)
			).rows[0];
			assert.equal(returned.first_seen_at, null);
			assert.equal(returned.first_seen_patch, null);
		} finally {
			await fixture.close();
		}
	},
);

test(
	"catalog update is atomic, mode isolated, price preserving, and no-op stable",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			for (const mode of ["regular", "pve", "pvp-season"]) {
				await fixture.pool.query("INSERT INTO catalog_status(mode,discovery_initialized) VALUES($1,true)", [mode]);
			}
			const data = completeData();
			const first = await applyCatalogUpdate(fixture.pool, data, 1000);
			assert.equal(first.changed, true);
			assert.equal(
				(await fixture.pool.query("SELECT jsonb_typeof(objectives) AS kind FROM quest_modes WHERE mode='regular'"))
					.rows[0].kind,
				"array",
			);
			assert.equal(
				(await fixture.pool.query("SELECT jsonb_typeof(required_items) AS kind FROM crafts WHERE mode='regular'"))
					.rows[0].kind,
				"array",
			);
			const regularItemId = data.regular.items[0].id;
			await fixture.pool.query("INSERT INTO item_prices(item_id,mode,price) VALUES($1,'regular',900)", [regularItemId]);
			const firstVersion = (await fixture.pool.query("SELECT content_version FROM catalog_status WHERE mode='regular'"))
				.rows[0].content_version;
			data.regular.freshness = { items: 1000, stations: 1000 };
			const unchanged = await applyCatalogUpdate(fixture.pool, data, 2000);
			assert.equal(unchanged.changed, false);
			assert.equal(
				(await fixture.pool.query("SELECT content_version FROM catalog_status WHERE mode='regular'")).rows[0]
					.content_version,
				firstVersion,
			);
			assert.equal(
				Number(
					(
						await fixture.pool.query("SELECT price FROM item_prices WHERE item_id=$1 AND mode='regular'", [
							regularItemId,
						])
					).rows[0].price,
				),
				900,
			);
			assert.equal(
				(await fixture.pool.query("SELECT count(*) FROM item_discovery WHERE mode='regular'")).rows[0].count,
				"1",
			);
			data.regular.items[0].name = "Renamed catalog item";
			await applyCatalogUpdate(fixture.pool, data, 2500);
			const firstSeen = (
				await fixture.pool.query(
					"SELECT first_seen_at, first_seen_patch FROM item_discovery WHERE item_id=$1 AND mode='regular'",
					[regularItemId],
				)
			).rows[0];
			assert.equal(Number(firstSeen.first_seen_at), 1000);
			assert.equal(firstSeen.first_seen_patch, null);
			const changedData = completeData("-updated");
			await applyCatalogUpdate(fixture.pool, changedData, 3000);
			assert.equal(
				Number((await fixture.pool.query("SELECT count(*) FROM item_modes WHERE mode='regular'")).rows[0].count),
				1,
			);
			assert.equal(
				Number((await fixture.pool.query("SELECT count(*) FROM item_modes WHERE mode='pve'")).rows[0].count),
				1,
			);
			assert.equal(
				Number((await fixture.pool.query("SELECT count(*) FROM item_discovery WHERE mode='regular'")).rows[0].count),
				2,
			);
			assert.equal(
				Number(
					(
						await fixture.pool.query("SELECT count(*) FROM item_prices WHERE item_id=$1 AND mode='regular'", [
							regularItemId,
						])
					).rows[0].count,
				),
				0,
			);
		} finally {
			await fixture.close();
		}
	},
);

test(
	"verified discovery import is reconciled atomically and new catalog IDs record timestamps without a patch",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			const modes = ["regular", "pve", "pvp-season"];
			const tracking = modes.map((mode) => ({ mode, baseline_release_id: "legacy-baseline", initialized_at: 100 }));
			const importedRows = modes.map((mode, index) => ({
				mode,
				item_id: `imported-${mode}`,
				first_seen_at: 500 + index,
				first_seen_patch: "1.1.5.0",
				first_seen_release_id: "old-release",
			}));
			const document = createDiscoveryExport(importedRows, tracking, 1000);
			await applyCatalogUpdate(fixture.pool, completeData("-new"), 2000, { discoveryDocument: document });
			const imported = (
				await fixture.pool.query(
					"SELECT first_seen_at, first_seen_patch, legacy_first_seen_release_id FROM item_discovery WHERE item_id='imported-regular' AND mode='regular'",
				)
			).rows[0];
			assert.equal(Number(imported.first_seen_at), 500);
			assert.equal(imported.first_seen_patch, "1.1.5.0");
			assert.equal(imported.legacy_first_seen_release_id, "old-release");
			const unseenCurrent = (
				await fixture.pool.query(
					"SELECT first_seen_at, first_seen_patch FROM item_discovery WHERE item_id='item-regular-new' AND mode='regular'",
				)
			).rows[0];
			assert.equal(Number(unseenCurrent.first_seen_at), 2000);
			assert.equal(unseenCurrent.first_seen_patch, null);
		} finally {
			await fixture.close();
		}
	},
);

test(
	"dry run treats optional discovery input as known without writing initialization state",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			const modes = ["regular", "pve", "pvp-season"];
			const tracking = modes.map((mode) => ({ mode, baseline_release_id: "legacy-baseline", initialized_at: 100 }));
			const rows = [
				{
					mode: "regular",
					item_id: "item-regular",
					first_seen_at: 500,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: null,
				},
				{
					mode: "pve",
					item_id: "removed-pve",
					first_seen_at: 501,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: null,
				},
				{
					mode: "pvp-season",
					item_id: "removed-seasonal",
					first_seen_at: 502,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: null,
				},
			];
			const discoveryDocument = createDiscoveryExport(rows, tracking, 1000);
			const result = await applyCatalogUpdate(fixture.pool, completeData(), 1000, {
				dryRun: true,
				discoveryDocument,
			});
			assert.deepEqual(result.newItems, { regular: [], pve: ["item-pve"], "pvp-season": ["item-pvp-season"] });
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM catalog_status")).rows[0].count), 0);
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM item_discovery")).rows[0].count), 0);
		} finally {
			await fixture.close();
		}
	},
);

test(
	"insert-only late discovery facts advance the affected catalog version",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			const data = completeData();
			await applyCatalogUpdate(fixture.pool, data, 1000);
			await fixture.pool.query("DELETE FROM item_discovery WHERE item_id='item-regular' AND mode='regular'");
			const baseline = await readCatalogBaseline(fixture.pool);
			const modes = ["regular", "pve", "pvp-season"];
			const tracking = modes.map((mode) => ({ mode, baseline_release_id: "legacy-baseline", initialized_at: 100 }));
			const rows = [
				{
					mode: "regular",
					item_id: "item-regular",
					first_seen_at: 500,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: "legacy",
				},
				{
					mode: "pve",
					item_id: "removed-pve",
					first_seen_at: 501,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: "legacy",
				},
				{
					mode: "pvp-season",
					item_id: "removed-seasonal",
					first_seen_at: 502,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: "legacy",
				},
			];
			const document = createDiscoveryExport(rows, tracking, 1000);
			const result = await applyCatalogUpdate(fixture.pool, data, 2000, {
				baseline,
				discoveryDocument: document,
			});
			assert.equal(result.changed, true);
			const row = (
				await fixture.pool.query(
					"SELECT first_seen_at, first_seen_patch FROM item_discovery WHERE item_id='item-regular' AND mode='regular'",
				)
			).rows[0];
			assert.equal(Number(row.first_seen_at), 500);
			assert.equal(row.first_seen_patch, "1.1.5.0");
			const next = await readCatalogBaseline(fixture.pool);
			assert.ok(Number(next.regular) > Number(baseline.regular));
		} finally {
			await fixture.close();
		}
	},
);

test(
	"discovery import conflicts roll back catalog writes and malformed checksums fail before connecting",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			await fixture.pool.query(
				"INSERT INTO item_discovery(item_id,mode,first_seen_at,first_seen_patch) VALUES('conflict','regular',100,'1.1.5.0')",
			);
			const modes = ["regular", "pve", "pvp-season"];
			const tracking = modes.map((mode) => ({ mode, baseline_release_id: "legacy-baseline", initialized_at: 100 }));
			const rows = modes.map((mode) => ({
				mode,
				item_id: `new-${mode}`,
				first_seen_at: 200,
				first_seen_patch: "1.1.5.0",
				first_seen_release_id: null,
			}));
			rows.push({
				mode: "regular",
				item_id: "conflict",
				first_seen_at: 101,
				first_seen_patch: "1.1.5.0",
				first_seen_release_id: null,
			});
			const conflicting = createDiscoveryExport(rows, tracking, 1000);
			await assert.rejects(
				applyCatalogUpdate(fixture.pool, completeData(), 1000, { discoveryDocument: conflicting }),
				/Discovery conflicts/,
			);
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM items")).rows[0].count), 0);
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM catalog_status")).rows[0].count), 0);
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM item_discovery")).rows[0].count), 1);
			const malformed = { ...conflicting, sha256: "bad-checksum" };
			let connected = false;
			await assert.rejects(
				applyCatalogUpdate(
					{
						connect() {
							connected = true;
							throw new Error("unexpected connect");
						},
					},
					completeData(),
					1000,
					{ discoveryDocument: malformed },
				),
				/checksum/,
			);
			assert.equal(connected, false);
		} finally {
			await fixture.close();
		}
	},
);

test(
	"catalog writer rejects a stale prepared baseline and stores full per-mode display overrides",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			for (const mode of ["regular", "pve", "pvp-season"])
				await fixture.pool.query("INSERT INTO catalog_status(mode,discovery_initialized) VALUES($1,true)", [mode]);
			const baseline = await readCatalogBaseline(fixture.pool);
			await fixture.pool.query("UPDATE catalog_status SET content_version=content_version+1 WHERE mode='regular'");
			await assert.rejects(
				applyCatalogUpdate(fixture.pool, completeData(), 1000, { baseline }),
				/changed while upstream data was being prepared/,
			);
			const data = completeData();
			data.pve.stations[0].name = "PVE Station";
			data.pve.stations[0].normalizedName = "pve-station";
			await applyCatalogUpdate(fixture.pool, data, 2000);
			const identity = (await fixture.pool.query("SELECT name FROM stations WHERE id='station-shared'")).rows[0];
			assert.equal(identity.name, "Station");
			const override = (
				await fixture.pool.query(
					"SELECT display_override FROM station_modes WHERE station_id='station-shared' AND mode='pve'",
				)
			).rows[0].display_override;
			assert.deepEqual(override, { name: "PVE Station", normalizedName: "pve-station", imageLink: null });
		} finally {
			await fixture.close();
		}
	},
);

test(
	"competing catalog writers serialize and reject the stale prepared update",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			const baseline = await readCatalogBaseline(fixture.pool);
			assert.deepEqual(baseline, { regular: "0", pve: "0", "pvp-season": "0" });
			const results = await Promise.allSettled([
				applyCatalogUpdate(fixture.pool, completeData("-writer-a"), 2000, { baseline }),
				applyCatalogUpdate(fixture.pool, completeData("-writer-b"), 2001, { baseline }),
			]);
			assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
			assert.equal(
				results.filter(
					(result) =>
						result.status === "rejected" &&
						/changed while upstream data was being prepared/.test(result.reason.message),
				).length,
				1,
			);
			assert.equal(
				Number((await fixture.pool.query("SELECT count(*) FROM item_modes WHERE mode='regular'")).rows[0].count),
				1,
			);
			assert.equal(
				Number(
					(await fixture.pool.query("SELECT count(*) FROM catalog_status WHERE discovery_initialized")).rows[0].count,
				),
				3,
			);
		} finally {
			await fixture.close();
		}
	},
);

test(
	"late reference failure rolls back every mode in the catalog transaction",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			for (const mode of ["regular", "pve", "pvp-season"])
				await fixture.pool.query("INSERT INTO catalog_status(mode,discovery_initialized) VALUES($1,true)", [mode]);
			const data = completeData();
			data["pvp-season"].quests[0].trader.id = "missing-trader";
			await assert.rejects(applyCatalogUpdate(fixture.pool, data, 1000), /quest_modes/);
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM items")).rows[0].count), 0);
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM item_discovery")).rows[0].count), 0);
			assert.equal(
				Number((await fixture.pool.query("SELECT sum(content_version) FROM catalog_status")).rows[0].sum),
				0,
			);
		} finally {
			await fixture.close();
		}
	},
);

test("malformed required catalog input is rejected before opening a write transaction", async () => {
	const malformed = completeData();
	malformed.pve.items = [];
	await assert.rejects(
		applyCatalogUpdate(
			{
				connect() {
					throw new Error("must not connect");
				},
			},
			malformed,
		),
		/pve items input is empty/,
	);
	const missingDetails = completeData();
	missingDetails.regular.itemDetails = [];
	await assert.rejects(
		applyCatalogUpdate(
			{
				connect() {
					throw new Error("must not connect");
				},
			},
			missingDetails,
		),
		/regular item detail projections are incomplete/,
	);
});
