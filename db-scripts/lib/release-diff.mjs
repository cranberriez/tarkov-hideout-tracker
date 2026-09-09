import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readRecords } from "./snapshot.mjs";
import { getKnownItemIds } from "./catalog-history.mjs";
import { encodeRecord } from "./current-storage.mjs";

export async function readActiveReleaseId(client, mode, { allowMissing = false } = {}) {
	const tables = new Set(
		(
			await client.execute(
				"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('active_data_releases','data_releases','current_records')",
			)
		).rows.map((row) => String(row.name)),
	);
	if (!tables.size && allowMissing) return null;
	if (!tables.has("active_data_releases") || !tables.has("data_releases"))
		throw new Error("Catalog schema is incomplete; initialize current storage before reading releases.");
	const result = await client.execute({
		sql: "SELECT active.release_id, release.status FROM active_data_releases active LEFT JOIN data_releases release USING(mode,release_id) WHERE active.mode=?",
		args: [mode],
	});
	if (result.rows.length) {
		if (result.rows[0].status !== "ready")
			throw new Error(
				"Active release for " + mode + " is missing or unready; repair the current dataset before updating.",
			);
		return String(result.rows[0].release_id);
	}
	const existing = await client.execute({
		sql: "SELECT release_id FROM data_releases WHERE mode=? LIMIT 1",
		args: [mode],
	});
	const records = tables.has("current_records")
		? await client.execute({ sql: "SELECT record_id FROM current_records WHERE mode=? LIMIT 1", args: [mode] })
		: { rows: [] };
	if (allowMissing && !existing.rows.length && !records.rows.length) return null;
	throw new Error(
		"No ready active release for " + mode + "; inspect the current dataset and publish a validated update.",
	);
}

export function compareEntities(previous, current) {
	const changes = {};
	for (const type of new Set([...previous.keys(), ...current.keys()])) {
		const oldRecords = previous.get(type) ?? new Map();
		const newRecords = current.get(type) ?? new Map();
		const added = [],
			changed = [],
			removed = [];
		const describe = (id, value) => ({ id, ...(value?.name ? { name: value.name } : {}) });
		for (const [id, value] of newRecords) {
			if (!oldRecords.has(id)) added.push(describe(id, value));
			else if (!isDeepStrictEqual(oldRecords.get(id), value)) changed.push(describe(id, value));
		}
		for (const [id, value] of oldRecords) {
			if (!newRecords.has(id)) removed.push(describe(id, value));
		}
		changes[type] = { added, changed, removed };
	}
	return changes;
}

export async function compareSnapshot(client, directory, manifest) {
	const modes = [];
	for (const entry of manifest.modes) {
		const previousReleaseId = await readActiveReleaseId(client, entry.mode, { allowMissing: true });
		if (Object.hasOwn(entry, "previousReleaseId") && entry.previousReleaseId !== previousReleaseId) {
			throw new Error(`${entry.mode} active release changed during generation; regenerate before publishing.`);
		}
		const result =
			previousReleaseId === null
				? { rows: [] }
				: await client.execute({
						sql: "SELECT variant AS entity_type,record_id AS entity_id,content_hash FROM current_records WHERE mode=? AND record_type='entity' AND variant<>'price'",
						args: [entry.mode],
					});
		const previous = new Map(),
			current = new Map();
		const add = (map, type, id, payload) => {
			if (!map.has(type)) map.set(type, new Map());
			map.get(type).set(id, payload);
		};
		for (const row of result.rows) add(previous, row.entity_type, row.entity_id, row.content_hash);
		const items = [];
		for await (const record of readRecords(path.join(directory, entry.file))) {
			if (record.type === "entity" && record.entityType !== "price")
				add(current, record.entityType, record.entityId, encodeRecord(entry.mode, record).contentHash);
			if (record.type === "entity" && record.entityType === "item") items.push(record.payload);
		}
		const historyTable = await client.execute(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='item_catalog_history'",
		);
		const knownIds = historyTable.rows.length ? await getKnownItemIds(client, entry.mode) : new Set();
		modes.push({
			mode: entry.mode,
			previousReleaseId,
			changes: compareEntities(previous, current),
			newItems: items.filter((item) => !knownIds.has(item.id)).map(({ id, name }) => ({ id, name })),
		});
	}
	return { releaseId: manifest.releaseId, modes };
}
