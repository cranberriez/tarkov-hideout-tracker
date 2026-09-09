import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { readReleasePrices } from "./release-prices.mjs";
import { readActiveReleaseId, compareSnapshot } from "./release-diff.mjs";
import { uploadSnapshot } from "../upload.mjs";
import { hashFile } from "./snapshot.mjs";

test("fresh catalog reads return empty prices while invalid pointers and operational errors fail", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		assert.deepEqual(await readReleasePrices(db, "regular"), { releaseId: null, prices: new Map() });
		assert.equal((await db.execute("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'")).rows[0].n, 0);
		await db.executeMultiple(await fs.readFile(new URL("../schema.sql", import.meta.url), "utf8"));
		assert.equal(await readActiveReleaseId(db, "pve", { allowMissing: true }), null);
		await db.execute("INSERT INTO data_releases VALUES('regular','bad',1,1,'hash','{}','{}','uploading',NULL)");
		await assert.rejects(readReleasePrices(db, "regular"), /No ready active release/);
		await db.execute("INSERT INTO active_data_releases VALUES('regular','bad',1)");
		await assert.rejects(readReleasePrices(db, "regular"), /unready/);
		await assert.rejects(
			readReleasePrices(
				{
					execute: async () => {
						throw new Error("network down");
					},
				},
				"regular",
			),
			/network down/,
		);
	} finally {
		db.close();
	}
});

test("fresh dry-run reports additions and publication costs without modifying the database", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "fresh-catalog-"));
	const db = createClient({ url: "file::memory:" });
	try {
		const records = [
			...["item", "station", "quest", "trader", "skill", "barter", "craft"].map((entityType) => ({
				type: "entity",
				entityType,
				entityId: "x",
				updatedAt: 1,
				payload: { id: "x" },
			})),
			{ type: "entity", entityType: "price", entityId: "x", updatedAt: 1, payload: null },
			...["usage", "relations", "acquisition"].map((viewType) => ({
				type: "itemView",
				itemId: "x",
				viewType,
				updatedAt: 1,
				payload: { freshness: { itemsUpdatedAt: 1 } },
			})),
			{ type: "itemSearch", itemId: "x", normalizedName: "x", compactName: "x", sortName: "x", payload: { id: "x" } },
			{ type: "manifest", manifestName: "items", updatedAt: 1, payload: ["x"] },
		];
		await fs.writeFile(path.join(root, "regular.ndjson"), records.map(JSON.stringify).join("\n"));
		const manifest = {
			releaseId: "first",
			schemaVersion: 1,
			generatedAt: 1,
			modes: [
				{
					mode: "regular",
					file: "regular.ndjson",
					previousReleaseId: null,
					sha256: await hashFile(path.join(root, "regular.ndjson")),
					sourceFreshness: { items: 1 },
					recordCounts: { entity: 8, itemView: 3, itemSearch: 1, manifest: 1 },
					entityCounts: Object.fromEntries(
						["item", "station", "quest", "trader", "skill", "barter", "craft", "price"].map((k) => [k, 1]),
					),
				},
			],
		};
		const report = await compareSnapshot(db, root, manifest);
		assert.equal(report.modes[0].previousReleaseId, null);
		assert.equal(report.modes[0].changes.item.added.length, 1);
		assert.equal(report.modes[0].newItems.length, 1);
		const dry = await uploadSnapshot(db, root, manifest, { dryRun: true });
		assert.equal(dry.changedRows, 13);
		assert.equal((await db.execute("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'")).rows[0].n, 0);
		const published = await uploadSnapshot(db, root, manifest);
		assert.equal(published.changedRows, 13);
		assert.equal(await readActiveReleaseId(db, "regular"), "first");
		assert.equal((await readReleasePrices(db, "regular")).prices.get("x").payload, null);
	} finally {
		db.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
