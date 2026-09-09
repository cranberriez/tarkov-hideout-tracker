import crypto from "node:crypto";
import path from "node:path";
import { readRecords, validateSnapshotFiles } from "./snapshot.mjs";
import { assertGamePatch, CURRENT_GAME_PATCH } from "./catalog-history.mjs";

export function stableStringify(value) {
	return JSON.stringify(value, (_key, item) =>
		item && typeof item === "object" && !Array.isArray(item)
			? Object.fromEntries(
					Object.keys(item)
						.sort()
						.map((key) => [key, item[key]]),
				)
			: item,
	);
}
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
export function encodeRecord(mode, record) {
	const content = { ...record };
	delete content.updatedAt;
	if (record.type === "itemView" && record.payload) {
		content.payload = {
			...record.payload,
			freshness: Object.fromEntries(
				Object.entries(record.payload.freshness ?? {}).map(([key, value]) => [key, value == null ? null : 0]),
			),
		};
	}
	const payloadJson = stableStringify(content.payload);
	return {
		mode,
		recordType: record.type,
		recordId: record.entityId ?? record.itemId ?? record.manifestName,
		variant: record.entityType ?? record.viewType ?? "",
		payloadJson,
		payloadHash: hash(payloadJson),
		contentHash: hash(stableStringify(content)),
		sortKey: record.sortKey ?? record.sortName ?? null,
		normalizedName: record.normalizedName ?? null,
		compactName: record.compactName ?? null,
		updatedAt: record.updatedAt ?? 0,
	};
}
export const recordKey = (record) => JSON.stringify([record.recordType, record.recordId, record.variant]);
export const payloadStatement = (r) => ({
	sql: "INSERT INTO data_payloads(payload_hash,payload_json) VALUES (?,?) ON CONFLICT DO NOTHING",
	args: [r.payloadHash, r.payloadJson],
});
export const currentRecordStatement = (r) => ({
	sql: `INSERT INTO current_records(mode,record_type,record_id,variant,payload_hash,content_hash,sort_key,normalized_name,compact_name,updated_at)
 VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mode,record_type,record_id,variant) DO UPDATE SET
 payload_hash=excluded.payload_hash, content_hash=excluded.content_hash, sort_key=excluded.sort_key,
 normalized_name=excluded.normalized_name,compact_name=excluded.compact_name,updated_at=excluded.updated_at
 WHERE current_records.content_hash<>excluded.content_hash`,
	args: [
		r.mode,
		r.recordType,
		r.recordId,
		r.variant,
		r.payloadHash,
		r.contentHash,
		r.sortKey,
		r.normalizedName,
		r.compactName,
		r.updatedAt,
	],
});
export async function executeBounded(executor, statements, { batchSize = 100, batchBytes = 1_000_000 } = {}) {
	let batch = [],
		bytes = 0;
	for (const statement of statements) {
		const size = Buffer.byteLength(JSON.stringify(statement));
		if (batch.length && (batch.length >= batchSize || bytes + size > batchBytes)) {
			await executor.batch(batch);
			batch = [];
			bytes = 0;
		}
		batch.push(statement);
		bytes += size;
	}
	if (batch.length) await executor.batch(batch);
}

// Files are completely validated before opening the write transaction. Only compact
// hashes are read from the database; payload JSON always comes from local files.
export async function publishSnapshot(client, directory, manifest, options = {}) {
	await validateSnapshotFiles(directory, manifest);
	const patch = assertGamePatch(options.patch ?? CURRENT_GAME_PATCH);
	const incoming = [];
	for (const entry of manifest.modes) {
		const records = [];
		for await (const record of readRecords(path.join(directory, entry.file)))
			records.push(encodeRecord(entry.mode, record));
		incoming.push({ entry, records });
	}

	const metrics = {
		dryRun: Boolean(options.dryRun),
		changedRows: 0,
		deletedRows: 0,
		insertedPayloads: 0,
		payloadBytes: 0,
		contentWriteBytes: 0,
		modes: [],
	};

	const plans = [];
	for (const { entry, records } of incoming) {
		const mode = entry.mode;
		const active =
			(await client.execute({ sql: "SELECT release_id FROM active_data_releases WHERE mode=?", args: [mode] })).rows[0]
				?.release_id ?? null;
		const oldRelease = (
			await client.execute({
				sql: "SELECT snapshot_sha256 FROM data_releases WHERE mode=? AND release_id=?",
				args: [mode, manifest.releaseId],
			})
		).rows[0];
		if (oldRelease && oldRelease.snapshot_sha256 !== entry.sha256)
			throw new Error(mode + "/" + manifest.releaseId + " already exists with a different snapshot checksum");
		const retry = active === manifest.releaseId && oldRelease?.snapshot_sha256 === entry.sha256;
		if (Object.hasOwn(entry, "previousReleaseId") && entry.previousReleaseId !== active && !retry)
			throw new Error(
				mode + ": stale previousReleaseId " + entry.previousReleaseId + "; current revision is " + active,
			);
		const old = new Map(
			(
				await client.execute({
					sql: "SELECT record_type,record_id,variant,content_hash FROM current_records WHERE mode=?",
					args: [mode],
				})
			).rows.map((r) => [JSON.stringify([r.record_type, r.record_id, r.variant]), r]),
		);
		const changed = records.filter((r) => old.get(recordKey(r))?.content_hash !== r.contentHash);
		const keys = new Set(records.map(recordKey));
		const deleted = [...old.entries()].filter(([key]) => !keys.has(key)).map(([, r]) => r);
		plans.push({ entry, active, oldRelease, changed, deleted });
	}
	const tx = await client.transaction(options.dryRun ? "read" : "write");
	try {
		// Recheck every planned revision after acquiring the transaction, before writing.
		for (const plan of plans) {
			const current =
				(await tx.execute({ sql: "SELECT release_id FROM active_data_releases WHERE mode=?", args: [plan.entry.mode] }))
					.rows[0]?.release_id ?? null;
			if (current !== plan.active)
				throw new Error(plan.entry.mode + ": revision changed during publication planning; retry");
		}
		const requestedHashes = [...new Set(plans.flatMap((p) => p.changed.map((r) => r.payloadHash)))];
		const payloadHashes = new Set();
		for (let index = 0; index < requestedHashes.length; index += 500) {
			const result = await tx.execute({
				sql: "SELECT payload_hash FROM data_payloads WHERE payload_hash IN (SELECT value FROM json_each(?))",
				args: [JSON.stringify(requestedHashes.slice(index, index + 500))],
			});
			for (const row of result.rows) payloadHashes.add(String(row.payload_hash));
		}
		for (const { entry, active, oldRelease, changed, deleted } of plans) {
			const mode = entry.mode;

			const modeMetrics = { mode, changedRows: changed.length, deletedRows: deleted.length, revision: active };
			metrics.modes.push(modeMetrics);
			metrics.changedRows += changed.length;
			metrics.deletedRows += deleted.length;
			if (!changed.length && !deleted.length) {
				// Freshness belongs to the published content revision. Updating it here
				// would invalidate revision-keyed caches despite unchanged content.
				continue;
			}
			if (oldRelease)
				throw new Error(
					`${mode}/${manifest.releaseId}: content changed under an existing revision; generate a new release ID`,
				);
			const initialized = await tx.execute({ sql: "SELECT mode FROM catalog_tracking WHERE mode=?", args: [mode] });
			if (!initialized.rows.length && !options.dryRun)
				await tx.execute({
					sql: "INSERT INTO catalog_tracking(mode,baseline_release_id,initialized_at) VALUES (?,?,?)",
					args: [mode, manifest.releaseId, Date.now()],
				});
			const statements = [];
			for (const r of changed) {
				if (!payloadHashes.has(r.payloadHash)) {
					statements.push(payloadStatement(r));
					payloadHashes.add(r.payloadHash);
					metrics.insertedPayloads++;
					metrics.payloadBytes += Buffer.byteLength(r.payloadJson);
				}
				statements.push(currentRecordStatement(r));
			}
			for (const r of deleted)
				statements.push({
					sql: "DELETE FROM current_records WHERE mode=? AND record_type=? AND record_id=? AND variant=?",
					args: [mode, r.record_type, r.record_id, r.variant],
				});
			metrics.contentWriteBytes += statements.reduce((sum, s) => sum + Buffer.byteLength(JSON.stringify(s)), 0);
			modeMetrics.revision = manifest.releaseId;
			if (options.dryRun) continue;
			await executeBounded(tx, statements, options);
			const counts = Object.fromEntries(
				(
					await tx.execute({
						sql: "SELECT record_type,COUNT(*) AS count FROM current_records WHERE mode=? GROUP BY record_type",
						args: [mode],
					})
				).rows.map((r) => [r.record_type, Number(r.count)]),
			);
			for (const [type, count] of Object.entries(entry.recordCounts))
				if ((counts[type] ?? 0) !== count) throw new Error(`${mode}: ${type} count mismatch`);
			const now = Date.now();
			await tx.execute({
				sql: `INSERT INTO data_releases(mode,release_id,schema_version,generated_at,snapshot_sha256,source_freshness_json,record_counts_json,status,uploaded_at) VALUES (?,?,?,?,?,?,?,'ready',?)`,
				args: [
					mode,
					manifest.releaseId,
					manifest.schemaVersion,
					manifest.generatedAt,
					entry.sha256,
					stableStringify(entry.sourceFreshness),
					stableStringify(entry.recordCounts),
					now,
				],
			});
			await tx.execute({
				sql: "INSERT INTO active_data_releases(mode,release_id,activated_at) VALUES (?,?,?) ON CONFLICT(mode) DO UPDATE SET release_id=excluded.release_id,activated_at=excluded.activated_at",
				args: [mode, manifest.releaseId, now],
			});
			await tx.execute({
				sql: "INSERT INTO item_catalog_history(mode,item_id,first_seen_at,first_seen_patch,first_seen_release_id) SELECT mode,record_id,?,?,? FROM current_records WHERE mode=? AND record_type='entity' AND variant='item' ON CONFLICT DO NOTHING",
				args: [now, patch, manifest.releaseId, mode],
			});
			await tx.execute({
				sql: "DELETE FROM data_releases WHERE mode=? AND release_id<>?",
				args: [mode, manifest.releaseId],
			});
		}
		if (!options.dryRun && (metrics.changedRows || metrics.deletedRows))
			await tx.execute(
				"DELETE FROM data_payloads WHERE NOT EXISTS (SELECT 1 FROM current_records WHERE current_records.payload_hash=data_payloads.payload_hash)",
			);
		await tx.commit();
		return metrics;
	} catch (error) {
		await tx.rollback();
		throw error;
	} finally {
		tx.close();
	}
}
