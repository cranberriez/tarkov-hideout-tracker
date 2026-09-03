import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const RECORD_TYPES = new Set(["entity", "itemView", "itemSearch", "manifest"]);

export function createReleaseId(now = new Date()) {
    return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function assertSafeReleaseId(value) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) {
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
        throw new Error(
            `Snapshot schema ${manifest.schemaVersion} is not supported; expected ${SNAPSHOT_SCHEMA_VERSION}`,
        );
    }
    assertSafeReleaseId(manifest.releaseId);
    if (!Array.isArray(manifest.modes) || manifest.modes.length === 0) {
        throw new Error("Snapshot manifest does not contain any modes");
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
        for await (const record of readRecords(filename)) actual[record.type] += 1;
        for (const [recordType, expected] of Object.entries(modeEntry.recordCounts)) {
            if (actual[recordType] !== expected) {
                throw new Error(
                    `${modeEntry.file} contains ${actual[recordType]} ${recordType} records; expected ${expected}`,
                );
            }
        }
    }
}

