import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type {
    CompletedItemsConversionData,
    DataStatusPayload,
    LegacyConversionStation,
    LegacyProfileConversionData,
} from "@/types/contracts";
import type { Station } from "@/types/hideout";
import type { ItemIdentity } from "@/types/items";
import { getTursoClient } from "./client";
import { TursoDataIntegrityError, TursoRecordNotFoundError } from "./errors";
import { getManifest } from "./manifests";
import { getActiveDataReleaseId } from "./release-config";
import { parseStoredJson } from "./stored-json";

interface PreviewManifest<Preview> {
    ids: string[];
    previews: Preview[];
}

interface StoredEntities<Entity> {
    records: Entity[];
    updatedAt: number | null;
}

function uniqueStationItemIds(stations: readonly Station[]): string[] {
    return [
        ...new Set(
            stations.flatMap((station) =>
                station.levels.flatMap((level) =>
                    level.itemRequirements.map((requirement) => requirement.itemId),
                ),
            ),
        ),
    ];
}

function numberOrNull(value: unknown): number | null {
    if (value === null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

async function getAllEntities<Entity>(
    mode: TarkovJsonGameMode,
    entityType: string,
    database: Client,
): Promise<StoredEntities<Entity>> {
    const releaseId = getActiveDataReleaseId(mode);
    const result = await database.execute({
        sql: `
            SELECT entity.updated_at, entity.payload_json
            FROM data_entities AS entity
            INNER JOIN data_releases AS release
                ON release.mode = entity.mode
                AND release.release_id = entity.release_id
                AND release.status = 'ready'
            WHERE entity.mode = ?
                AND entity.release_id = ?
                AND entity.entity_type = ?
            ORDER BY entity.sort_key, entity.entity_id
        `,
        args: [mode, releaseId, entityType],
    });
    if (result.rows.length === 0) {
        throw new TursoRecordNotFoundError(
            `No ${entityType} entities exist for ${mode}/${releaseId}`,
        );
    }

    const updateTimes = result.rows.map((row) => numberOrNull(row.updated_at));
    return {
        records: result.rows.map((row) =>
            parseStoredJson<Entity>(row.payload_json, `${entityType} entity`),
        ),
        updatedAt: updateTimes.every((value) => value === null)
            ? null
            : Math.max(...updateTimes.map((value) => value ?? 0)),
    };
}

async function getItemIdentities(
    mode: TarkovJsonGameMode,
    itemIds: readonly string[],
    database: Client,
): Promise<{ itemsById: Record<string, ItemIdentity>; updatedAt: number | null }> {
    if (itemIds.length === 0) return { itemsById: {}, updatedAt: null };

    const releaseId = getActiveDataReleaseId(mode);
    const result = await database.execute({
        sql: `
            SELECT
                entity.entity_id,
                entity.updated_at,
                json_extract(entity.payload_json, '$.name') AS name,
                json_extract(entity.payload_json, '$.normalizedName') AS normalized_name
            FROM data_entities AS entity
            INNER JOIN data_releases AS release
                ON release.mode = entity.mode
                AND release.release_id = entity.release_id
                AND release.status = 'ready'
            WHERE entity.mode = ?
                AND entity.release_id = ?
                AND entity.entity_type = 'item'
                AND entity.entity_id IN (SELECT value FROM json_each(?))
        `,
        args: [mode, releaseId, JSON.stringify(itemIds)],
    });

    const itemsById: Record<string, ItemIdentity> = Object.create(null) as Record<
        string,
        ItemIdentity
    >;
    let updatedAt: number | null = null;
    for (const row of result.rows) {
        if (
            typeof row.entity_id !== "string" ||
            typeof row.name !== "string" ||
            typeof row.normalized_name !== "string"
        ) {
            throw new TursoDataIntegrityError("An item identity has an invalid shape");
        }
        itemsById[row.entity_id] = {
            id: row.entity_id,
            name: row.name,
            normalizedName: row.normalized_name,
        };
        const rowUpdatedAt = numberOrNull(row.updated_at);
        if (rowUpdatedAt !== null) updatedAt = Math.max(updatedAt ?? 0, rowUpdatedAt);
    }

    return { itemsById, updatedAt };
}

export async function getLegacyProfileConversionView(
    mode: TarkovJsonGameMode,
    database?: Client,
): Promise<LegacyProfileConversionData> {
    try {
        const manifest = await getManifest<PreviewManifest<LegacyConversionStation>>(
            mode,
            "stations",
            database ?? getTursoClient(),
        );
        return {
            stations: manifest.payload.previews,
            freshness: { stationsUpdatedAt: manifest.updatedAt },
            errors: { stations: null },
        };
    } catch {
        return {
            stations: [],
            freshness: { stationsUpdatedAt: null },
            errors: { stations: "Hideout station details could not be loaded." },
        };
    }
}

export async function getCompletedItemsConversionView(
    mode: TarkovJsonGameMode,
    database?: Client,
): Promise<CompletedItemsConversionData> {
    let db: Client;
    let stationData: StoredEntities<Station>;
    try {
        db = database ?? getTursoClient();
        stationData = await getAllEntities<Station>(mode, "station", db);
    } catch {
        return {
            stations: [],
            items: [],
            unresolvedItemIds: [],
            freshness: { stationsUpdatedAt: null, itemsUpdatedAt: null },
            errors: {
                stations: "Hideout station data could not be loaded.",
                items: null,
            },
        };
    }

    const itemIds = uniqueStationItemIds(stationData.records);
    let itemData: Awaited<ReturnType<typeof getItemIdentities>>;
    try {
        itemData = await getItemIdentities(mode, itemIds, db);
    } catch {
        itemData = { itemsById: {}, updatedAt: null };
        return {
            stations: stationData.records.map((station) => ({
                id: station.id,
                levels: station.levels.map((level) => ({
                    level: level.level,
                    itemRequirements: level.itemRequirements.map((requirement) => ({
                        id: requirement.id,
                        itemId: requirement.itemId,
                        count: requirement.count,
                        isFir: requirement.isFir,
                    })),
                })),
            })),
            items: [],
            unresolvedItemIds: itemIds,
            freshness: {
                stationsUpdatedAt: stationData.updatedAt,
                itemsUpdatedAt: null,
            },
            errors: {
                stations: null,
                items: "Hideout item names could not be loaded.",
            },
        };
    }

    return {
        stations: stationData.records.map((station) => ({
            id: station.id,
            levels: station.levels.map((level) => ({
                level: level.level,
                itemRequirements: level.itemRequirements.map((requirement) => ({
                    id: requirement.id,
                    itemId: requirement.itemId,
                    count: requirement.count,
                    isFir: requirement.isFir,
                })),
            })),
        })),
        items: itemIds.flatMap((itemId) =>
            itemData.itemsById[itemId] ? [itemData.itemsById[itemId]] : [],
        ),
        unresolvedItemIds: itemIds.filter((itemId) => !itemData.itemsById[itemId]),
        freshness: {
            stationsUpdatedAt: stationData.updatedAt,
            itemsUpdatedAt: itemData.updatedAt,
        },
        errors: { stations: null, items: null },
    };
}

export async function getDataStatusView(
    mode: TarkovJsonGameMode,
    database?: Client,
): Promise<DataStatusPayload> {
    try {
        const releaseId = getActiveDataReleaseId(mode);
        const result = await (database ?? getTursoClient()).execute({
            sql: `
                SELECT source_freshness_json
                FROM data_releases
                WHERE mode = ? AND release_id = ? AND status = 'ready'
                LIMIT 1
            `,
            args: [mode, releaseId],
        });
        const row = result.rows[0];
        if (!row) {
            throw new TursoRecordNotFoundError(
                `No ready data release exists for ${mode}/${releaseId}`,
            );
        }
        const freshness = parseStoredJson<Record<string, unknown>>(
            row.source_freshness_json,
            `${mode} release freshness`,
        );
        const stationsUpdatedAt = numberOrNull(freshness.stations);
        const itemsUpdatedAt = numberOrNull(freshness.items);
        if (stationsUpdatedAt === null || itemsUpdatedAt === null) {
            throw new TursoDataIntegrityError("Core release freshness is incomplete");
        }

        return {
            stations: {
                available: true,
                updatedAt: stationsUpdatedAt,
                diagnostics: { provider: "json" },
                error: null,
            },
            items: {
                available: true,
                updatedAt: itemsUpdatedAt,
                diagnostics: { provider: "json" },
                error: null,
            },
        };
    } catch {
        return {
            stations: {
                available: false,
                updatedAt: null,
                diagnostics: null,
                error: "Hideout station data could not be loaded.",
            },
            items: {
                available: false,
                updatedAt: null,
                diagnostics: null,
                error: "Item catalog data could not be loaded.",
            },
        };
    }
}
