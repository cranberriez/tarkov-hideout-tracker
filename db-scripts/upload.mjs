import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getTursoConfig, loadLocalEnv } from "./lib/config.mjs";
import {
    loadSnapshotManifest,
    readRecords,
    validateSnapshotFiles,
} from "./lib/snapshot.mjs";
import {
    activateRelease,
    applySchema,
    createTursoClient,
    statementForRecord,
} from "./lib/turso.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

function parseArguments(argv) {
    const options = {
        releaseDirectory: null,
        activate: false,
        batchSize: 100,
        batchBytes: 1_000_000,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--release-dir") {
            options.releaseDirectory = path.resolve(argv[++index]);
        } else if (argument === "--activate") {
            options.activate = true;
        } else if (argument === "--batch-size") {
            options.batchSize = Number(argv[++index]);
        } else if (argument === "--batch-bytes") {
            options.batchBytes = Number(argv[++index]);
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    if (!options.releaseDirectory) {
        throw new Error("--release-dir must point to a generated snapshot directory");
    }
    if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
        throw new Error("--batch-size must be an integer between 1 and 500");
    }
    if (!Number.isInteger(options.batchBytes) || options.batchBytes < 100_000) {
        throw new Error("--batch-bytes must be an integer of at least 100000");
    }
    return options;
}

async function beginRelease(client, manifest, modeEntry) {
    const existing = await client.execute({
        sql: `
            SELECT snapshot_sha256, status
            FROM data_releases
            WHERE mode = ? AND release_id = ?
        `,
        args: [modeEntry.mode, manifest.releaseId],
    });
    if (
        existing.rows.length > 0 &&
        String(existing.rows[0].snapshot_sha256) !== modeEntry.sha256
    ) {
        throw new Error(
            `${modeEntry.mode}/${manifest.releaseId} already exists with a different snapshot checksum`,
        );
    }
    if (existing.rows[0]?.status === "ready") return false;
    await client.execute({
        sql: `
            INSERT INTO data_releases
                (mode, release_id, schema_version, generated_at, snapshot_sha256,
                 source_freshness_json, record_counts_json, status, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'uploading', NULL)
            ON CONFLICT (mode, release_id) DO UPDATE SET
                schema_version = excluded.schema_version,
                generated_at = excluded.generated_at,
                source_freshness_json = excluded.source_freshness_json,
                record_counts_json = excluded.record_counts_json
        `,
        args: [
            modeEntry.mode,
            manifest.releaseId,
            manifest.schemaVersion,
            manifest.generatedAt,
            modeEntry.sha256,
            JSON.stringify(modeEntry.sourceFreshness),
            JSON.stringify(modeEntry.recordCounts),
        ],
    });
    return true;
}

async function uploadMode(
    client,
    releaseDirectory,
    manifest,
    modeEntry,
    batchSize,
    batchBytes,
) {
    const shouldUpload = await beginRelease(client, manifest, modeEntry);
    if (!shouldUpload) {
        process.stdout.write(`  ${modeEntry.mode}: matching release is already ready; skipping rows\n`);
        return;
    }
    const filename = path.join(releaseDirectory, modeEntry.file);
    let statements = [];
    let statementBytes = 0;
    let uploaded = 0;
    const flush = async () => {
        if (statements.length === 0) return;
        await client.batch(statements, "write");
        uploaded += statements.length;
        statements = [];
        statementBytes = 0;
        if (uploaded % 1000 === 0) {
            process.stdout.write(`  ${modeEntry.mode}: ${uploaded} rows uploaded\n`);
        }
    };
    for await (const record of readRecords(filename)) {
        const recordBytes = Buffer.byteLength(JSON.stringify(record));
        if (
            statements.length > 0 &&
            (statements.length >= batchSize || statementBytes + recordBytes > batchBytes)
        ) {
            await flush();
        }
        statements.push(statementForRecord(modeEntry.mode, manifest.releaseId, record));
        statementBytes += recordBytes;
    }
    await flush();
    process.stdout.write(`  ${modeEntry.mode}: ${uploaded} rows uploaded\n`);
}

async function countRows(client, table, mode, releaseId) {
    const result = await client.execute({
        sql: `SELECT COUNT(*) AS count FROM ${table} WHERE mode = ? AND release_id = ?`,
        args: [mode, releaseId],
    });
    return Number(result.rows[0].count);
}

async function verifyAndMarkReady(client, manifest, modeEntry) {
    const actual = {
        entity: await countRows(client, "data_entities", modeEntry.mode, manifest.releaseId),
        itemView: await countRows(client, "item_views", modeEntry.mode, manifest.releaseId),
        itemSearch: await countRows(client, "item_search", modeEntry.mode, manifest.releaseId),
        manifest: await countRows(client, "data_manifests", modeEntry.mode, manifest.releaseId),
    };
    for (const [recordType, expected] of Object.entries(modeEntry.recordCounts)) {
        if (actual[recordType] !== expected) {
            throw new Error(
                `${modeEntry.mode} uploaded ${actual[recordType]} ${recordType} rows; expected ${expected}`,
            );
        }
    }
    await client.execute({
        sql: `
            UPDATE data_releases
            SET status = 'ready', uploaded_at = ?
            WHERE mode = ? AND release_id = ?
        `,
        args: [Date.now(), modeEntry.mode, manifest.releaseId],
    });
}

async function main() {
    await loadLocalEnv(projectRoot);
    const options = parseArguments(process.argv.slice(2));
    const manifest = await loadSnapshotManifest(options.releaseDirectory);
    process.stdout.write("Validating snapshot checksums and record counts…\n");
    await validateSnapshotFiles(options.releaseDirectory, manifest);

    const client = createTursoClient(getTursoConfig());
    try {
        await applySchema(client, path.join(scriptDirectory, "schema.sql"));
        for (const modeEntry of manifest.modes) {
            process.stdout.write(`Uploading ${modeEntry.mode}…\n`);
            await uploadMode(
                client,
                options.releaseDirectory,
                manifest,
                modeEntry,
                options.batchSize,
                options.batchBytes,
            );
            await verifyAndMarkReady(client, manifest, modeEntry);
        }
        if (options.activate) {
            await activateRelease(
                client,
                manifest.releaseId,
                manifest.modes.map((entry) => entry.mode),
            );
            process.stdout.write(`Activated release ${manifest.releaseId}.\n`);
        } else {
            process.stdout.write(
                `Release ${manifest.releaseId} is ready. Run db:activate after inspection.\n`,
            );
        }
    } finally {
        client.close();
    }
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
});
