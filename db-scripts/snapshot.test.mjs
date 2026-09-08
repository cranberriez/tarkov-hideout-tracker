import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { hashFile, validateSnapshotFiles, loadSnapshotManifest, assertSafeReleaseId } from "./lib/snapshot.mjs";

function completeRecords() {
	return [
		...["item", "station", "quest", "trader", "skill", "barter", "craft", "price"].map((entityType) => ({
			type: "entity",
			entityType,
			entityId: "a",
			updatedAt: 1,
			payload: entityType === "price" ? null : { id: "a", name: "A" },
		})),
		...["relations", "usage", "acquisition"].map((viewType) => ({ type: "itemView", itemId: "a", viewType, updatedAt: 1, payload: {} })),
		{ type: "itemSearch", itemId: "a", payload: { id: "a" } },
		{ type: "manifest", manifestName: "items", updatedAt: 1, payload: { ids: ["a"] } },
	];
}

async function snapshot(directory, records) {
	const filename = path.join(directory, "regular.ndjson");
	await fs.writeFile(filename, records.map((record) => JSON.stringify(record)).join("\n"));
	const entry = {
		mode: "regular",
		file: "regular.ndjson",
		sha256: await hashFile(filename),
		recordCounts: { entity: 0, itemView: 0, itemSearch: 0, manifest: 0 },
		entityCounts: {},
	};
	for (const record of records) {
		entry.recordCounts[record.type]++;
		if (record.type === "entity" && record.entityType !== "price") entry.entityCounts[record.entityType] = (entry.entityCounts[record.entityType] ?? 0) + 1;
	}
	const manifest = { schemaVersion: 1, releaseId: "test-release", modes: [entry] };
	await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
	return manifest;
}

test("snapshot validation rejects empty required domains, duplicate IDs and incomplete views before upload", async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tarkov-snapshot-"));
	try {
		const complete = completeRecords();
		await validateSnapshotFiles(directory, await snapshot(directory, complete));
		await assert.rejects(
			validateSnapshotFiles(
				directory,
				await snapshot(
					directory,
					complete.filter((record) => record.entityType !== "quest"),
				),
			),
			/quest domain/,
		);
		await assert.rejects(validateSnapshotFiles(directory, await snapshot(directory, [...complete, complete[0]])), /duplicate record/);
		await assert.rejects(
			validateSnapshotFiles(
				directory,
				await snapshot(
					directory,
					complete.filter((record) => record.viewType !== "usage"),
				),
			),
			/incomplete item/,
		);
		const manifest = await snapshot(directory, complete);
		manifest.modes[0].file = "../outside.ndjson";
		await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
		await assert.rejects(loadSnapshotManifest(directory), /unexpected filename/);
		assert.throws(() => assertSafeReleaseId(undefined), /Release IDs/);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});
