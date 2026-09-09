import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const RECORD_TYPES = new Set(["entity", "itemView", "itemSearch", "manifest"]);

export function createReleaseId(now = new Date()) {
	return now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");
}

export function assertSafeReleaseId(value) {
	if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) {
		throw new Error("Release IDs may contain only letters, numbers, dots, underscores, and hyphens");
	}
	return value;
}

export async function hashFile(filename) {
	const hash = crypto.createHash("sha256");
	for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
	return hash.digest("hex");
}

export async function* readRecords(filename) {
	const input = fs.createReadStream(filename, { encoding: "utf8" });
	const lines = readline.createInterface({ input, crlfDelay: Infinity });
	let lineNumber = 0;
	for await (const line of lines) {
		lineNumber += 1;
		if (!line.trim()) continue;
		let record;
		try {
			record = JSON.parse(line);
		} catch {
			throw new Error(`${filename}:${lineNumber} is not valid JSON`);
		}
		if (!record || !RECORD_TYPES.has(record.type)) {
			throw new Error(`${filename}:${lineNumber} has an unsupported record type`);
		}
		yield record;
	}
}

export async function loadSnapshotManifest(releaseDirectory) {
	const filename = path.join(releaseDirectory, "manifest.json");
	const manifest = JSON.parse(await fsPromises.readFile(filename, "utf8"));
	if (manifest.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
		throw new Error(`Snapshot schema ${manifest.schemaVersion} is not supported; expected ${SNAPSHOT_SCHEMA_VERSION}`);
	}
	assertSafeReleaseId(manifest.releaseId);
	if (!Array.isArray(manifest.modes) || manifest.modes.length === 0) {
		throw new Error("Snapshot manifest does not contain any modes");
	}
	const seenModes = new Set();
	for (const entry of manifest.modes) {
		if (
			!["regular", "pve", "pvp-season"].includes(entry.mode) ||
			seenModes.has(entry.mode) ||
			entry.file !== `${entry.mode}.ndjson`
		) {
			throw new Error("Snapshot contains an invalid mode, duplicate mode, or unexpected filename");
		}
		seenModes.add(entry.mode);
	}
	return manifest;
}

export async function validateSnapshotFiles(releaseDirectory, manifest) {
	for (const modeEntry of manifest.modes) {
		const filename = path.join(releaseDirectory, modeEntry.file);
		const digest = await hashFile(filename);
		if (digest !== modeEntry.sha256) {
			throw new Error(`${modeEntry.file} checksum does not match manifest.json`);
		}
		const actual = { entity: 0, itemView: 0, itemSearch: 0, manifest: 0 };
		const entityCounts = {};
		const keys = new Set();
		const searchSources = { item: [], quest: [], trader: [] };
		let searchManifest;
		for await (const record of readRecords(filename)) {
			actual[record.type] += 1;
			const key = JSON.stringify([
				record.type,
				record.entityType,
				record.entityId,
				record.itemId,
				record.viewType,
				record.manifestName,
			]);
			if (keys.has(key)) throw new Error(`${modeEntry.file} contains a duplicate record`);
			keys.add(key);
			if (record.type === "manifest" && record.manifestName === "compact-search-v1") searchManifest = record.payload;
			if (record.type === "entity") {
				if (searchSources[record.entityType]) searchSources[record.entityType].push(record.payload);
				entityCounts[record.entityType] = (entityCounts[record.entityType] ?? 0) + 1;
				if (
					typeof record.entityId !== "string" ||
					!record.entityId.trim() ||
					(record.entityType !== "price" && record.payload?.id !== record.entityId)
				) {
					throw new Error(`${modeEntry.file} contains an invalid entity identity`);
				}
			}
		}
		// Old snapshots remain readable during rollout; newly emitted manifests must
		// exactly represent their canonical source records before publication.
		if (searchManifest !== undefined) {
			const { buildSearchManifest } = await jiti.import("../../src/lib/search/build-manifest.ts");
			const expected = buildSearchManifest(
				modeEntry.mode,
				searchSources.item,
				searchSources.quest,
				searchSources.trader,
			);
			if (JSON.stringify(searchManifest) !== JSON.stringify(expected))
				throw new Error(`${modeEntry.file} has an incomplete compact search manifest`);
		}
		for (const recordType of Object.keys(actual)) {
			const expected = modeEntry.recordCounts?.[recordType];
			if (!Number.isInteger(expected) || expected <= 0)
				throw new Error(`${modeEntry.file} is missing required ${recordType} records`);
			if (actual[recordType] !== expected) {
				throw new Error(`${modeEntry.file} contains ${actual[recordType]} ${recordType} records; expected ${expected}`);
			}
		}
		for (const domain of ["item", "station", "quest", "trader", "skill", "barter", "craft"]) {
			if (!entityCounts[domain] || entityCounts[domain] !== modeEntry.entityCounts?.[domain]) {
				throw new Error(`${modeEntry.file} has an empty or inconsistent ${domain} domain`);
			}
		}
		if (
			entityCounts.price !== entityCounts.item ||
			actual.itemSearch !== entityCounts.item ||
			actual.itemView !== 3 * entityCounts.item
		) {
			throw new Error(`${modeEntry.file} has incomplete item prices/search/views`);
		}
	}
}
