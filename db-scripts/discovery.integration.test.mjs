import assert from "node:assert/strict";
import test from "node:test";
import { createDiscoveryExport, importDiscovery, DISCOVERY_MODES } from "./lib/discovery.mjs";
import { postgresFixture } from "./lib/test-postgres.mjs";

test(
	"PostgreSQL discovery import is atomic, repeatable, conflict safe and durable",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			const tracking = DISCOVERY_MODES.map((mode) => ({ mode, baseline_release_id: "baseline", initialized_at: 10 }));
			const rows = DISCOVERY_MODES.flatMap((mode, index) => [
				{
					mode,
					item_id: "baseline",
					first_seen_at: null,
					first_seen_patch: "pre-1.1.5",
					first_seen_release_id: "baseline",
				},
				{
					mode,
					item_id: "removed",
					first_seen_at: 100 + index,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: "later",
				},
			]);
			const document = createDiscoveryExport(rows, tracking);
			assert.equal((await importDiscovery(fixture.pool, document)).inserted, 6);
			assert.equal((await importDiscovery(fixture.pool, document)).inserted, 0);
			assert.equal((await fixture.pool.query("SELECT * FROM catalog_status WHERE discovery_initialized")).rowCount, 3);
			const conflict = createDiscoveryExport(
				[
					...rows.map((row) => (row.item_id === "removed" ? { ...row, first_seen_at: 999 } : row)),
					{ ...rows[0], item_id: "must-not-be-inserted" },
				],
				tracking,
			);
			await assert.rejects(importDiscovery(fixture.pool, conflict), /Discovery conflicts/);
			const saved = (await fixture.pool.query("SELECT * FROM item_discovery")).rows;
			assert.equal(saved.length, 6);
			assert.equal(saved.filter((row) => row.first_seen_at === null).length, 3);
			assert.deepEqual(
				saved
					.filter((row) => row.item_id === "removed")
					.map((row) => Number(row.first_seen_at))
					.sort(),
				[100, 101, 102],
			);
			await fixture.pool.query(
				"UPDATE catalog_status SET content_version=5, source_freshness=$1::jsonb WHERE mode='regular'",
				[JSON.stringify({ items: 10 })],
			);
			const extended = createDiscoveryExport(
				[
					...rows,
					{
						mode: "regular",
						item_id: "late-import",
						first_seen_at: 300,
						first_seen_patch: "1.1.5.0",
						first_seen_release_id: "later",
					},
				],
				tracking,
			);
			const imported = await importDiscovery(fixture.pool, extended);
			assert.equal(imported.inserted, 1);
			assert.equal((await importDiscovery(fixture.pool, extended)).inserted, 0);
			const status = (
				await fixture.pool.query("SELECT content_version, source_freshness FROM catalog_status WHERE mode='regular'")
			).rows[0];
			assert.equal(Number(status.content_version), 6);
			assert.deepEqual(status.source_freshness, { items: 10 });
			assert.equal(Number((await fixture.pool.query("SELECT count(*) FROM item_discovery")).rows[0].count), 7);
		} finally {
			await fixture.close();
		}
	},
);

test(
	"late discovery enriches unknown bootstrap atomically, preserving later observations and removed items",
	{ skip: !process.env.TEST_DATABASE_URL },
	async () => {
		const fixture = await postgresFixture();
		try {
			const tracking = DISCOVERY_MODES.map((mode) => ({ mode, baseline_release_id: "baseline", initialized_at: 10 }));
			const rows = DISCOVERY_MODES.flatMap((mode, index) => [
				{
					mode,
					item_id: "customdogtags12345678910",
					first_seen_at: null,
					first_seen_patch: "pre-1.1.5",
					first_seen_release_id: "baseline",
				},
				{
					mode,
					item_id: "707265736574-preset",
					first_seen_at: 100 + index,
					first_seen_patch: "1.1.5.0",
					first_seen_release_id: "history",
				},
			]);
			for (const mode of DISCOVERY_MODES) {
				await fixture.pool.query(
					"INSERT INTO catalog_status(mode,content_version,discovery_initialized) VALUES ($1,1,true)",
					[mode],
				);
				await fixture.pool.query(
					"INSERT INTO item_discovery(item_id,mode) VALUES ('customdogtags12345678910',$1),('707265736574-preset',$1)",
					[mode],
				);
				await fixture.pool.query(
					"INSERT INTO item_discovery(item_id,mode,first_seen_at,first_seen_patch) VALUES ('later-observation',$1,999,'1.1.5.0')",
					[mode],
				);
			}
			const before = (await fixture.pool.query("SELECT * FROM item_discovery ORDER BY mode,item_id")).rows;
			const conflict = createDiscoveryExport([...rows, { ...rows[1], item_id: "later-observation" }], tracking);
			await assert.rejects(importDiscovery(fixture.pool, conflict), /Discovery conflicts/);
			assert.deepEqual((await fixture.pool.query("SELECT * FROM item_discovery ORDER BY mode,item_id")).rows, before);
			const document = createDiscoveryExport(rows, tracking);
			assert.equal((await importDiscovery(fixture.pool, document)).enriched, 6);
			assert.equal((await importDiscovery(fixture.pool, document)).enriched, 0);
			assert.equal((await fixture.pool.query("SELECT * FROM item_discovery")).rowCount, 9);
			assert.deepEqual(
				(
					await fixture.pool.query(
						"SELECT first_seen_at FROM item_discovery WHERE item_id='707265736574-preset' ORDER BY first_seen_at",
					)
				).rows.map((row) => Number(row.first_seen_at)),
				[100, 101, 102],
			);
			assert.ok(
				(await fixture.pool.query("SELECT content_version FROM catalog_status")).rows.every(
					(row) => Number(row.content_version) === 2,
				),
			);
			assert.equal(
				(
					await fixture.pool.query(
						"SELECT * FROM item_discovery WHERE item_id='later-observation' AND first_seen_at=999 AND legacy_first_seen_release_id IS NULL",
					)
				).rowCount,
				3,
			);
		} finally {
			await fixture.close();
		}
	},
);
