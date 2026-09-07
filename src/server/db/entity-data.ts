import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { DataResult } from "@/types/common";
import { getTursoClient } from "./client";
import {
    TursoDataIntegrityError,
    TursoRecordNotFoundError,
} from "./errors";
import { getActiveDataReleaseId } from "./release-config";
import { parseStoredJsonValue } from "./stored-json";
import { boundedReadCache, canonicalIds, mapBatches } from "./read-cache";

export type StoredEntityType =
    | "item"
    | "price"
    | "station"
    | "quest"
    | "trader"
    | "skill"
    | "barter"
    | "craft";

export type SourceFreshnessKey =
    | "items"
    | "stations"
    | "quests"
    | "traders"
    | "skills"
    | "barters"
    | "crafts";

function parseSourceUpdatedAt(value: unknown, label: string): number {
    const updatedAt = Number(value);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
        throw new TursoDataIntegrityError(`${label} has invalid source freshness`);
    }
    return updatedAt;
}

async function queryEntities<T>(
    mode: TarkovJsonGameMode,
    entityType: StoredEntityType,
    freshnessKey: SourceFreshnessKey,
    itemIds: readonly string[] | null,
    database: Client,
    releaseId = getActiveDataReleaseId(mode),
    idsOnly = false,
): Promise<DataResult<Array<{ id: string; payload: T }>>> {
    const idFilter = itemIds
        ? "AND entity.entity_id IN (SELECT value FROM json_each(?))"
        : "";
    const result = await database.execute({
        sql: `
            WITH selected_release AS (
                SELECT
                    mode,
                    release_id,
                    json_extract(source_freshness_json, ?) AS source_updated_at
                FROM data_releases
                WHERE mode = ? AND release_id = ? AND status = 'ready'
            )
            SELECT
                selected_release.source_updated_at,
                entity.entity_id,
                ${idsOnly ? "CASE WHEN entity.entity_id IS NULL THEN NULL ELSE json_quote(entity.entity_id) END" : "entity.payload_json"} AS payload_json
            FROM selected_release
            LEFT JOIN data_entities AS entity
                ON entity.mode = selected_release.mode
                AND entity.release_id = selected_release.release_id
                AND entity.entity_type = ?
                ${idFilter}
            ORDER BY entity.sort_key, entity.entity_id
        `,
        args: [
            `$.${freshnessKey}`,
            mode,
            releaseId,
            entityType,
            ...(itemIds ? [JSON.stringify([...new Set(itemIds)])] : []),
        ],
    });
    const firstRow = result.rows[0];
    if (!firstRow) {
        throw new TursoRecordNotFoundError(
            `No ready data release exists for ${mode}/${releaseId}`,
        );
    }

    const records = result.rows.flatMap((row) => {
        if (row.entity_id === null && row.payload_json === null) return [];
        if (typeof row.entity_id !== "string") {
            throw new TursoDataIntegrityError(`${entityType} entity has an invalid ID`);
        }
        return [
            {
                id: row.entity_id,
                payload: parseStoredJsonValue<T>(
                    row.payload_json,
                    `${entityType}/${row.entity_id}`,
                ),
            },
        ];
    });

    return {
        data: records,
        updatedAt: parseSourceUpdatedAt(
            firstRow.source_updated_at,
            `${mode} ${freshnessKey}`,
        ),
    };
}

async function readRuntimeEntities<T>(
    mode: TarkovJsonGameMode,
    releaseId: string,
    entityType: StoredEntityType,
    freshnessKey: SourceFreshnessKey,
    ids: readonly string[],
): Promise<DataResult<Array<{ id: string; payload: T }>>> {
    const results = await mapBatches(canonicalIds(ids), (batch) => boundedReadCache(
        ["entities", mode, releaseId, entityType, freshnessKey, JSON.stringify(batch)],
        () => queryEntities<T>(mode, entityType, freshnessKey, batch, getTursoClient(), releaseId),
    ));
    return { data: results.flatMap((result) => result.data), updatedAt: results[0].updatedAt };
}

export async function getEntityList<T>(
    mode: TarkovJsonGameMode,
    entityType: StoredEntityType,
    freshnessKey: SourceFreshnessKey,
    database?: Client,
): Promise<DataResult<T[]>> {
    if (database) {
        const result = await queryEntities<T>(mode, entityType, freshnessKey, null, database);
        return { data: result.data.map((record) => record.payload), updatedAt: result.updatedAt };
    }
    const releaseId = getActiveDataReleaseId(mode);
    // Discover only ordered IDs, never cache an unbounded full-domain payload.
    const index = await boundedReadCache(
        ["entity-list-ids", mode, releaseId, entityType, freshnessKey],
        () => queryEntities<string>(mode, entityType, freshnessKey, null, getTursoClient(), releaseId, true),
    );
    if (!index.data.length) return { data: [], updatedAt: index.updatedAt };
    const result = await readRuntimeEntities<T>(mode, releaseId, entityType, freshnessKey,
        index.data.map((record) => record.id));
    const byId = new Map(result.data.map((record) => [record.id, record.payload]));
    return {
        data: index.data.map(({ id }) => {
            if (!byId.has(id)) throw new TursoDataIntegrityError(`Missing listed ${entityType}/${id}`);
            return byId.get(id) as T;
        }),
        updatedAt: index.updatedAt,
    };
}

export async function getEntitiesByIds<T>(
    mode: TarkovJsonGameMode,
    entityType: StoredEntityType,
    freshnessKey: SourceFreshnessKey,
    ids: readonly string[],
    database?: Client,
): Promise<DataResult<Record<string, T>>> {
    const result = database
        ? await queryEntities<T>(mode, entityType, freshnessKey, ids, database)
        : await readRuntimeEntities<T>(mode, getActiveDataReleaseId(mode), entityType, freshnessKey, ids);
    return {
        data: Object.fromEntries(result.data.map((record) => [record.id, record.payload])),
        updatedAt: result.updatedAt,
    };
}
