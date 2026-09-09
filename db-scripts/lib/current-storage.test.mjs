import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import {
	encodeRecord,
	stableStringify,
	publishSnapshot,
	payloadStatement,
	currentRecordStatement,
} from "./current-storage.mjs";
import { hashFile, validateSnapshotFiles } from "./snapshot.mjs";
import { createJiti } from "jiti";

test("snapshot validation rejects incomplete search manifests before publication", async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "compact-search-"));
	try {
		const snapshot = await fixture(directory, "search-test");
		const filename = path.join(directory, "regular.ndjson");
		const records = (await fs.readFile(filename, "utf8")).split("\n").map(JSON.parse);
		const entities = records.filter((record) => record.type === "entity");
		for (const record of entities.filter((record) => record.payload)) {
			record.payload.normalizedName = "original";
			if (record.entityType === "quest") record.payload.trader = { id: "x", name: "Trader", normalizedName: "trader" };
		}
		const { buildSearchManifest } = await createJiti(import.meta.url).import("../../src/lib/search/build-manifest.ts");
		const source = (kind) => entities.filter((record) => record.entityType === kind).map((record) => record.payload);
		const payload = buildSearchManifest("regular", source("item"), source("quest"), source("trader"));
		records.push({ type: "manifest", manifestName: "compact-search-v1", updatedAt: 1, payload });
		snapshot.modes[0].recordCounts.manifest++;
		const write = async () => {
			await fs.writeFile(filename, records.map(JSON.stringify).join("\n"));
			snapshot.modes[0].sha256 = await hashFile(filename);
		};
		await write();
		await validateSnapshotFiles(directory, snapshot);
		payload.quests = [];
		await write();
		await assert.rejects(validateSnapshotFiles(directory, snapshot), /incomplete compact search manifest/);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});

test("canonical payloads deduplicate; freshness preserves availability, nested timestamps remain content", () => {
	assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
	const base = {
		type: "itemView",
		itemId: "x",
		viewType: "usage",
		updatedAt: 1,
		payload: { freshness: { itemsUpdatedAt: 123, pricesUpdatedAt: null }, data: { updatedAt: 5 } },
	};
	const a = encodeRecord("regular", base),
		b = encodeRecord("pve", {
			...base,
			updatedAt: 2,
			payload: { ...base.payload, freshness: { itemsUpdatedAt: 456, pricesUpdatedAt: null } },
		});
	assert.equal(a.payloadHash, b.payloadHash);
	assert.equal(a.contentHash, b.contentHash);
	assert.notEqual(
		a.contentHash,
		encodeRecord("regular", { ...base, payload: { ...base.payload, data: { updatedAt: 6 } } }).contentHash,
	);
	assert.notEqual(
		a.contentHash,
		encodeRecord("regular", {
			...base,
			payload: { ...base.payload, freshness: { itemsUpdatedAt: null, pricesUpdatedAt: null } },
		}).contentHash,
	);
});
async function fixture(directory, releaseId, changed = false, previousReleaseId) {
	const records = [
		...["item", "station", "quest", "trader", "skill", "barter", "craft"].map((entityType) => ({
			type: "entity",
			entityType,
			entityId: "x",
			updatedAt: Date.now(),
			payload: { id: "x", name: changed && entityType === "quest" ? "changed" : "original" },
		})),
		{ type: "entity", entityType: "price", entityId: "x", updatedAt: 1, payload: null },
		...["usage", "relations", "acquisition"].map((viewType) => ({
			type: "itemView",
			itemId: "x",
			viewType,
			updatedAt: Date.now(),
			payload: { freshness: { itemsUpdatedAt: Date.now() } },
		})),
		{ type: "itemSearch", itemId: "x", normalizedName: "x", compactName: "x", sortName: "x", payload: { id: "x" } },
		{ type: "manifest", manifestName: "items", updatedAt: Date.now(), payload: ["x"] },
	];
	const filename = path.join(directory, "regular.ndjson");
	await fs.writeFile(filename, records.map(JSON.stringify).join("\n"));
	return {
		releaseId,
		schemaVersion: 1,
		generatedAt: Date.now(),
		modes: [
			{
				mode: "regular",
				file: "regular.ndjson",
				sha256: await hashFile(filename),
				sourceFreshness: { items: 1 },
				recordCounts: { entity: 8, itemView: 3, itemSearch: 1, manifest: 1 },
				entityCounts: Object.fromEntries(
					["item", "station", "quest", "trader", "skill", "barter", "craft", "price"].map((k) => [k, 1]),
				),
				...(previousReleaseId === undefined ? {} : { previousReleaseId }),
			},
		],
	};
}
test("targeted publication is atomic, no-op stable, dry-run read-only, stale updates rejected", async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "current-storage-"));
	const client = createClient({ url: "file::memory:" });
	try {
		await client.executeMultiple(await fs.readFile(new URL("../schema.sql", import.meta.url), "utf8"));
		let manifest = await fixture(directory, "one");
		const initial = await publishSnapshot(client, directory, manifest);
		assert.equal(initial.changedRows, 13);
		const history = await client.execute("SELECT * FROM item_catalog_history");
		manifest = await fixture(directory, "two", false, "one");
		manifest.modes[0].sourceFreshness = { items: 999 };
		const writesBeforeNoop = Number((await client.execute("SELECT total_changes() AS n")).rows[0].n);
		const noop = await publishSnapshot(client, directory, manifest);
		assert.equal(
			Number((await client.execute("SELECT total_changes() AS n")).rows[0].n),
			writesBeforeNoop,
			"timestamp-only generation writes no database rows",
		);
		assert.equal(
			JSON.parse(
				(await client.execute("SELECT source_freshness_json FROM data_releases")).rows[0].source_freshness_json,
			).items,
			1,
		);
		assert.equal(noop.contentWriteBytes, 0);
		assert.equal(noop.insertedPayloads, 0);
		assert.equal(noop.modes[0].revision, "one");
		manifest = await fixture(directory, "two", true, "one");
		const dry = await publishSnapshot(client, directory, manifest, { dryRun: true });
		assert.equal(dry.changedRows, 1);
		assert.equal((await client.execute("SELECT release_id FROM active_data_releases")).rows[0].release_id, "one");
		await client.execute(
			"CREATE TRIGGER fail_publication BEFORE INSERT ON data_releases BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
		);
		await assert.rejects(publishSnapshot(client, directory, manifest), /injected failure/);
		assert.equal((await client.execute("SELECT release_id FROM active_data_releases")).rows[0].release_id, "one");
		assert.equal(
			JSON.parse(
				(await client.execute("SELECT payload_json FROM data_entities WHERE entity_type='quest'")).rows[0].payload_json,
			).name,
			"original",
		);
		await client.execute("DROP TRIGGER fail_publication");
		const update = await publishSnapshot(client, directory, manifest);
		assert.equal(update.changedRows, 1);
		assert.equal((await client.execute("SELECT COUNT(*) AS n FROM data_releases")).rows[0].n, 1);
		assert.deepEqual((await client.execute("SELECT * FROM item_catalog_history")).rows, history.rows);
		assert.equal(
			JSON.parse(
				(await client.execute("SELECT payload_json FROM data_entities WHERE entity_type='quest'")).rows[0].payload_json,
			).name,
			"changed",
		);
		assert.equal((await publishSnapshot(client, directory, manifest)).changedRows, 0);
		manifest = await fixture(directory, "three", true, "one");
		await assert.rejects(publishSnapshot(client, directory, manifest), /stale previousReleaseId/);
		const removed = encodeRecord("regular", {
			type: "manifest",
			manifestName: "obsolete",
			updatedAt: 1,
			payload: ["old"],
		});
		const isolated = encodeRecord("pve", {
			type: "manifest",
			manifestName: "keep",
			updatedAt: 1,
			payload: ["isolated"],
		});
		await client.batch(
			[
				payloadStatement(removed),
				currentRecordStatement(removed),
				payloadStatement(isolated),
				currentRecordStatement(isolated),
			],
			"write",
		);
		manifest = await fixture(directory, "three", true, "two");
		const removal = await publishSnapshot(client, directory, manifest);
		assert.equal(removal.deletedRows, 1);
		assert.equal(removal.changedRows, 0);
		assert.equal((await client.execute("SELECT COUNT(*) AS n FROM current_records WHERE mode='pve'")).rows[0].n, 1);

		assert.equal(
			(
				await client.execute(
					"SELECT COUNT(*) AS n FROM data_payloads WHERE payload_hash NOT IN (SELECT payload_hash FROM current_records)",
				)
			).rows[0].n,
			0,
		);
	} finally {
		client.close();
		await fs.rm(directory, { recursive: true, force: true });
	}
});
