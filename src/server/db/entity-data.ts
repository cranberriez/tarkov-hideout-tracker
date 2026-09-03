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
): Promise<DataResult<Array<{ id: string; payload: T }>>> {
    const releaseId = getActiveDataReleaseId(mode);
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
                entity.payload_json
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

export async function getEntityList<T>(
    mode: TarkovJsonGameMode,
    entityType: StoredEntityType,
    freshnessKey: SourceFreshnessKey,
    database: Client = getTursoClient(),
): Promise<DataResult<T[]>> {
    const result = await queryEntities<T>(
        mode,
        entityType,
        freshnessKey,
        null,
        database,
    );
    return { data: result.data.map((record) => record.payload), updatedAt: result.updatedAt };
}

export async function getEntitiesByIds<T>(
    mode: TarkovJsonGameMode,
    entityType: StoredEntityType,
    freshnessKey: SourceFreshnessKey,
    ids: readonly string[],
    database: Client = getTursoClient(),
): Promise<DataResult<Record<string, T>>> {
    const result = await queryEntities<T>(
        mode,
        entityType,
        freshnessKey,
        ids,
        database,
    );
    return {
        data: Object.fromEntries(
            result.data.map((record) => [record.id, record.payload]),
        ),
        updatedAt: result.updatedAt,
    };
}
