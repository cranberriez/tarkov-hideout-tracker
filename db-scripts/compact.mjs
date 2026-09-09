import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv, getTursoConfig } from "./lib/config.mjs";
import { createTursoClient } from "./lib/turso.mjs";
import { initializeCatalogHistory } from "./lib/catalog-history.mjs";
import { loadSnapshotManifest, validateSnapshotFiles, readRecords, assertSafeReleaseId } from "./lib/snapshot.mjs";
import {
	encodeRecord,
	payloadStatement,
	currentRecordStatement,
	executeBounded,
	recordKey,
} from "./lib/current-storage.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));

// Dev-only conversion: retain the active datasets and durable price/catalog tables,
// then discard the historical full copies. Existing verified local files avoid
// downloading the entire catalog from the database just to upload it again.
export async function compactDatabase(client, snapshotRoot = path.join(directory, ".generated"), log = console.log) {
	const legacy = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='data_entities'");
	if (!legacy.rows.length) {
		log("Current storage is already installed; nothing to compact.");
		return { converted: false };
	}
	const active = (
		await client.execute(
			"SELECT r.* FROM data_releases r JOIN active_data_releases a USING(mode,release_id) ORDER BY mode",
		)
	).rows;
	if (active.length !== 3 || active.some((r) => r.status !== "ready"))
		throw new Error("Compaction requires one ready active dataset for each of the three modes.");
	const snapshots = [];
	for (const row of active) {
		const source = path.join(snapshotRoot, assertSafeReleaseId(String(row.release_id)));
		const manifest = await loadSnapshotManifest(source);
		const entry = manifest.modes.find((m) => m.mode === row.mode);
		if (!entry || manifest.releaseId !== row.release_id || entry.sha256 !== row.snapshot_sha256) {
			throw new Error(`Local snapshot does not match current ${row.mode}/${row.release_id}`);
		}
		await validateSnapshotFiles(source, { ...manifest, modes: [entry] });
		snapshots.push({ source, entry });
	}
	await initializeCatalogHistory(
		client,
		active.map((r) => String(r.mode)),
	);
	const schema = await fs.readFile(path.join(directory, "schema.sql"), "utf8");
	// CREATE VIEW IF NOT EXISTS leaves same-named legacy tables in place until cutover.
	await client.executeMultiple(schema);
	const payloads = new Set(
		(await client.execute("SELECT payload_hash FROM data_payloads")).rows.map((r) => String(r.payload_hash)),
	);
	const expected = new Set();
	let records = 0;
	let newPayloads = 0;
	for (const { source, entry } of snapshots) {
		let statements = [];
		for await (const record of readRecords(path.join(source, entry.file))) {
			const encoded = encodeRecord(entry.mode, record);
			expected.add(`${entry.mode}:${recordKey(encoded)}`);
			if (!payloads.has(encoded.payloadHash)) {
				statements.push(payloadStatement(encoded));
				payloads.add(encoded.payloadHash);
				newPayloads++;
			}
			statements.push(currentRecordStatement(encoded));
			records++;
			if (statements.length >= 400) {
				await executeBounded(client, statements);
				statements = [];
			}
		}
		await executeBounded(client, statements);
		log(`${entry.mode}: current records prepared (${records} total).`);
	}
	const staged = (await client.execute("SELECT mode,record_type,record_id,variant FROM current_records")).rows;
	const extras = staged.filter(
		(r) => !expected.has(`${r.mode}:${JSON.stringify([r.record_type, r.record_id, r.variant])}`),
	);
	await executeBounded(
		client,
		extras.map((r) => ({
			sql: "DELETE FROM current_records WHERE mode=? AND record_type=? AND record_id=? AND variant=?",
			args: [r.mode, r.record_type, r.record_id, r.variant],
		})),
	);
	const tx = await client.transaction("write");
	try {
		const latest = (await tx.execute("SELECT mode,release_id FROM active_data_releases ORDER BY mode")).rows;
		if (
			JSON.stringify(latest.map((r) => [r.mode, r.release_id])) !==
			JSON.stringify(active.map((r) => [r.mode, r.release_id]))
		)
			throw new Error("Active datasets changed while compacting; retry with their matching local snapshots.");
		for (const { entry } of snapshots) {
			const counts = Object.fromEntries(
				(
					await tx.execute({
						sql: "SELECT record_type,COUNT(*) n FROM current_records WHERE mode=? GROUP BY record_type",
						args: [entry.mode],
					})
				).rows.map((r) => [r.record_type, Number(r.n)]),
			);
			for (const [type, count] of Object.entries(entry.recordCounts))
				if (counts[type] !== count) throw new Error(`Compaction count mismatch: ${entry.mode}/${type}`);
		}
		for (const table of ["data_entities", "item_views", "item_search", "data_manifests", "data_release_pins"])
			await tx.execute(`DROP TABLE IF EXISTS ${table}`);
		for (const view of schema.match(/CREATE VIEW IF NOT EXISTS[\s\S]*?;/g) ?? []) await tx.execute(view);
		await tx.execute(
			"DELETE FROM data_releases WHERE NOT EXISTS (SELECT 1 FROM active_data_releases a WHERE a.mode=data_releases.mode AND a.release_id=data_releases.release_id)",
		);
		await tx.execute(
			"DELETE FROM data_payloads WHERE NOT EXISTS (SELECT 1 FROM current_records r WHERE r.payload_hash=data_payloads.payload_hash)",
		);
		await tx.commit();
	} catch (error) {
		await tx.rollback();
		throw error;
	} finally {
		tx.close();
	}
	log(
		`Compacted ${records} current records into shared payload storage; inserted ${newPayloads} unique payloads. Historical snapshots removed. Price and catalog history retained.`,
	);
	return { converted: true, records, newPayloads };
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length && (args.length !== 2 || args[0] !== "--snapshot-root"))
		throw new Error("Usage: db:compact [--snapshot-root <directory>]");
	await loadLocalEnv(path.resolve(directory, ".."));
	const client = createTursoClient(getTursoConfig());
	try {
		await compactDatabase(client, args[1] ? path.resolve(args[1]) : undefined);
	} finally {
		client.close();
	}
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
