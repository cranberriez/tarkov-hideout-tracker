import fs from "node:fs/promises";
import { createClient } from "@libsql/client";

export function createTursoClient(config) {
    return createClient(config);
}

export async function applySchema(client, schemaPath) {
    await client.executeMultiple(await fs.readFile(schemaPath, "utf8"));
}

export async function activateRelease(client, releaseId, modes) {
    const activatedAt = Date.now();
    await client.batch(
        modes.map((mode) => ({
            sql: `
                INSERT INTO active_data_releases (mode, release_id, activated_at)
                VALUES (?, ?, ?)
                ON CONFLICT (mode) DO UPDATE SET
                    release_id = excluded.release_id,
                    activated_at = excluded.activated_at
            `,
            args: [mode, releaseId, activatedAt],
        })),
        "write",
    );
}

export function statementForRecord(mode, releaseId, record) {
    const payload = JSON.stringify(record.payload);
    switch (record.type) {
        case "entity":
            return {
                sql: `
                    INSERT INTO data_entities
                        (mode, release_id, entity_type, entity_id, sort_key, updated_at, payload_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (mode, release_id, entity_type, entity_id) DO UPDATE SET
                        sort_key = excluded.sort_key,
                        updated_at = excluded.updated_at,
                        payload_json = excluded.payload_json
                `,
                args: [
                    mode,
                    releaseId,
                    record.entityType,
                    record.entityId,
                    record.sortKey ?? null,
                    record.updatedAt,
                    payload,
                ],
            };
        case "itemView":
            return {
                sql: `
                    INSERT INTO item_views
                        (mode, release_id, item_id, view_type, updated_at, payload_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT (mode, release_id, item_id, view_type) DO UPDATE SET
                        updated_at = excluded.updated_at,
                        payload_json = excluded.payload_json
                `,
                args: [mode, releaseId, record.itemId, record.viewType, record.updatedAt, payload],
            };
        case "itemSearch":
            return {
                sql: `
                    INSERT INTO item_search
                        (mode, release_id, item_id, normalized_name, compact_name, sort_name, preview_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (mode, release_id, item_id) DO UPDATE SET
                        normalized_name = excluded.normalized_name,
                        compact_name = excluded.compact_name,
                        sort_name = excluded.sort_name,
                        preview_json = excluded.preview_json
                `,
                args: [
                    mode,
                    releaseId,
                    record.itemId,
                    record.normalizedName,
                    record.compactName,
                    record.sortName,
                    payload,
                ],
            };
        case "manifest":
            return {
                sql: `
                    INSERT INTO data_manifests
                        (mode, release_id, manifest_name, updated_at, payload_json)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT (mode, release_id, manifest_name) DO UPDATE SET
                        updated_at = excluded.updated_at,
                        payload_json = excluded.payload_json
                `,
                args: [mode, releaseId, record.manifestName, record.updatedAt, payload],
            };
        default:
            throw new Error(`Unsupported record type ${record.type}`);
    }
}
