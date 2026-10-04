import { createHash } from "node:crypto";

export const DISCOVERY_MODES = ["regular", "pve", "pvp-season"];
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function normalizeRows(rows) {
	const keys = new Set();
	return rows
		.map((row) => {
			const { item_id, mode, first_seen_at, first_seen_patch, first_seen_release_id } = row;
			const unknownBaseline = first_seen_at === null && first_seen_patch === null && first_seen_release_id === null;
			if (
				!DISCOVERY_MODES.includes(mode) ||
				typeof item_id !== "string" ||
				!item_id.trim() ||
				(first_seen_patch !== null &&
					(typeof first_seen_patch !== "string" || !/^(?:pre-1\.1\.5|\d+\.\d+\.\d+\.\d+)$/.test(first_seen_patch))) ||
				(first_seen_release_id !== null &&
					(typeof first_seen_release_id !== "string" || !first_seen_release_id.trim())) ||
				(first_seen_at === null
					? !unknownBaseline && first_seen_patch !== "pre-1.1.5"
					: !Number.isSafeInteger(first_seen_at) || first_seen_at <= 0 || first_seen_patch === "pre-1.1.5")
			) {
				throw new Error("Invalid discovery identity, timestamp, or provenance");
			}
			const key = `${mode}:${item_id}`;
			if (keys.has(key)) throw new Error(`Duplicate discovery ${key}`);
			keys.add(key);
			return { item_id, mode, first_seen_at, first_seen_patch, first_seen_release_id };
		})
		.sort((a, b) => a.mode.localeCompare(b.mode) || a.item_id.localeCompare(b.item_id));
}

export function createDiscoveryExport(rows, tracking, exportedAt = Date.now()) {
	const normalized = normalizeRows(rows);
	const coverage = DISCOVERY_MODES.map((mode) => {
		const entries = tracking.filter((row) => row.mode === mode);
		const count = normalized.filter((row) => row.mode === mode).length;
		if (
			entries.length !== 1 ||
			!entries[0].baseline_release_id ||
			!Number.isSafeInteger(entries[0].initialized_at) ||
			entries[0].initialized_at <= 0 ||
			!count
		) {
			throw new Error(`Discovery is not established for ${mode}; an explicit initialization decision is required`);
		}
		return {
			mode,
			count,
			baseline_release_id: entries[0].baseline_release_id,
			initialized_at: entries[0].initialized_at,
		};
	});
	const payload = { format: "tarkov-discovery-v1", exported_at: exportedAt, coverage, rows: normalized };
	return { ...payload, sha256: digest(payload) };
}

export function validateDiscoveryExport(document) {
	if (
		!document ||
		document.format !== "tarkov-discovery-v1" ||
		!Array.isArray(document.rows) ||
		!Array.isArray(document.coverage) ||
		document.coverage.length !== 3 ||
		!Number.isSafeInteger(document.exported_at) ||
		document.exported_at <= 0
	) {
		throw new Error("Invalid discovery export manifest");
	}
	const verified = createDiscoveryExport(document.rows, document.coverage, document.exported_at);
	if (verified.sha256 !== document.sha256 || JSON.stringify(verified.coverage) !== JSON.stringify(document.coverage)) {
		throw new Error("Discovery checksum or per-mode count mismatch");
	}
	return verified;
}

export function discoveryRecordKind(row) {
	if (row.first_seen_at === null && row.first_seen_patch === null && row.first_seen_release_id === null)
		return "unknown-bootstrap";
	if (row.first_seen_patch === "pre-1.1.5") return "historical-baseline";
	return row.first_seen_release_id === null ? "local-observation" : "historical-observation";
}

/** Only a wholly unknown bootstrap may be enriched. Known facts never lose information. */
export function buildDiscoveryReconciliation(existing, document) {
	const verified = validateDiscoveryExport(document);
	const byKey = new Map(
		existing.map((row) => [
			`${row.mode}:${row.item_id}`,
			{ ...row, first_seen_at: row.first_seen_at === null ? null : Number(row.first_seen_at) },
		]),
	);
	const additions = [];
	const enrichments = [];
	const conflicts = [];
	let preserved = 0;
	for (const row of verified.rows) {
		const prior = byKey.get(`${row.mode}:${row.item_id}`);
		if (!prior) additions.push(row);
		else if (["first_seen_at", "first_seen_patch", "first_seen_release_id"].every((key) => prior[key] === row[key]))
			continue;
		else if (discoveryRecordKind(prior) === "unknown-bootstrap") enrichments.push(row);
		else if (discoveryRecordKind(row) === "unknown-bootstrap") preserved++;
		else conflicts.push({ kind: discoveryRecordKind(prior), prior, incoming: row });
	}
	if (conflicts.length) {
		const counts = Object.fromEntries(
			DISCOVERY_MODES.map((mode) => [mode, conflicts.filter((entry) => entry.incoming.mode === mode).length]),
		);
		const sample = conflicts.slice(0, 5).map(({ incoming, kind }) => `${incoming.mode}/${incoming.item_id} (${kind})`);
		const error = new Error(
			`Discovery conflicts: ${conflicts.length} known records differ (nothing imported). Counts: ${JSON.stringify(counts)}. Sample: ${sample.join(", ")}`,
		);
		error.name = "DiscoveryConflictError";
		Object.defineProperty(error, "diagnostic", {
			value: { format: "tarkov-discovery-conflicts-v1", exportChecksum: verified.sha256, counts, conflicts },
		});
		throw error;
	}
	return { verified, additions, enrichments, preserved };
}

export async function planDiscoveryReconciliation(client, document) {
	const { rows } = await client.query(
		"SELECT item_id, mode, first_seen_at, first_seen_patch, legacy_first_seen_release_id AS first_seen_release_id FROM item_discovery",
	);
	return buildDiscoveryReconciliation(rows, document);
}

/** Reconcile verified first-seen facts into a caller-owned transaction and lock. */
export async function reconcileDiscovery(client, document) {
	const { verified, additions, enrichments, preserved } = await planDiscoveryReconciliation(client, document);
	if (additions.length)
		await client.query(
			`INSERT INTO item_discovery (item_id, mode, first_seen_at, first_seen_patch, legacy_first_seen_release_id)
			SELECT item_id, mode, first_seen_at, first_seen_patch, first_seen_release_id
			FROM jsonb_to_recordset($1::jsonb) AS x(item_id text, mode text, first_seen_at bigint, first_seen_patch text, first_seen_release_id text)`,
			[JSON.stringify(additions)],
		);
	if (enrichments.length) {
		const updated = await client.query(
			`UPDATE item_discovery AS d SET first_seen_at=x.first_seen_at,
			first_seen_patch=x.first_seen_patch, legacy_first_seen_release_id=x.first_seen_release_id
			FROM jsonb_to_recordset($1::jsonb) AS x(item_id text, mode text, first_seen_at bigint, first_seen_patch text, first_seen_release_id text)
			WHERE d.item_id=x.item_id AND d.mode=x.mode AND d.first_seen_at IS NULL
			AND d.first_seen_patch IS NULL AND d.legacy_first_seen_release_id IS NULL`,
			[JSON.stringify(enrichments)],
		);
		if (updated.rowCount !== enrichments.length)
			throw new Error("Discovery changed during reconciliation; nothing imported. Retry against current history.");
	}
	for (const mode of DISCOVERY_MODES)
		await client.query(
			`INSERT INTO catalog_status (mode, discovery_initialized) VALUES ($1, true)
			ON CONFLICT (mode) DO UPDATE SET discovery_initialized = true WHERE NOT catalog_status.discovery_initialized`,
			[mode],
		);
	return {
		inserted: additions.length,
		enriched: enrichments.length,
		preserved,
		unchanged: verified.rows.length - additions.length - enrichments.length,
		coverage: verified.coverage,
		changedModes: [...new Set([...additions, ...enrichments].map((row) => row.mode))],
	};
}

/** Atomic reconciliation. Removed items intentionally need no item FK. */
export async function importDiscovery(pool, document) {
	const verified = validateDiscoveryExport(document);
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await client.query("SELECT pg_advisory_xact_lock(7416203911027441)");
		const result = await reconcileDiscovery(client, verified);
		for (const mode of result.changedModes)
			await client.query(
				`UPDATE catalog_status SET
					content_version=CASE WHEN content_version > 0 THEN content_version + 1 ELSE content_version END,
					updated_at=$2
				WHERE mode=$1`,
				[mode, Date.now()],
			);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}
