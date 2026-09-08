import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readRecords } from "./snapshot.mjs";
import { getKnownItemIds } from "./catalog-history.mjs";

export async function readActiveReleaseId(client, mode) {
	const result = await client.execute({
		sql: `SELECT active.release_id FROM active_data_releases AS active
              JOIN data_releases AS release USING (mode, release_id)
              WHERE active.mode = ? AND release.status = 'ready'`,
		args: [mode],
	});
	if (!result.rows.length) throw new Error(`No ready active release for ${mode}; run db:catalog:init or db:activate.`);
	return String(result.rows[0].release_id);
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
		const previousReleaseId = await readActiveReleaseId(client, entry.mode);
		if (entry.previousReleaseId && entry.previousReleaseId !== previousReleaseId) {
			throw new Error(`${entry.mode} active release changed during generation; regenerate before publishing.`);
		}
		const result = await client.execute({
			sql: "SELECT entity_type, entity_id, payload_json FROM data_entities WHERE mode = ? AND release_id = ? AND entity_type <> 'price'",
			args: [entry.mode, previousReleaseId],
		});
		const previous = new Map(),
			current = new Map();
		const add = (map, type, id, payload) => {
			if (!map.has(type)) map.set(type, new Map());
			map.get(type).set(id, payload);
		};
		for (const row of result.rows) add(previous, row.entity_type, row.entity_id, JSON.parse(String(row.payload_json)));
		for await (const record of readRecords(path.join(directory, entry.file))) {
			if (record.type === "entity" && record.entityType !== "price") add(current, record.entityType, record.entityId, record.payload);
		}
		const knownIds = await getKnownItemIds(client, entry.mode);
		modes.push({
			mode: entry.mode,
			previousReleaseId,
			changes: compareEntities(previous, current),
			newItems: [...(current.get("item") ?? new Map())].filter(([id]) => !knownIds.has(id)).map(([id, item]) => ({ id, name: item.name })),
		});
	}
	return { releaseId: manifest.releaseId, modes };
}
