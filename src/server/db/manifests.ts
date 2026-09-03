import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getTursoClient } from "./client";
import { TursoDataIntegrityError, TursoRecordNotFoundError } from "./errors";
import { getActiveDataReleaseId } from "./release-config";
import { parseStoredJson } from "./stored-json";

export interface StoredManifest<Payload> {
    payload: Payload;
    updatedAt: number;
}

export async function getManifest<Payload>(
    mode: TarkovJsonGameMode,
    manifestName: string,
    database: Client = getTursoClient(),
): Promise<StoredManifest<Payload>> {
    const releaseId = getActiveDataReleaseId(mode);
    const result = await database.execute({
        sql: `
            SELECT manifest.updated_at, manifest.payload_json
            FROM data_manifests AS manifest
            INNER JOIN data_releases AS release
                ON release.mode = manifest.mode
                AND release.release_id = manifest.release_id
                AND release.status = 'ready'
            WHERE manifest.mode = ?
                AND manifest.release_id = ?
                AND manifest.manifest_name = ?
            LIMIT 1
        `,
        args: [mode, releaseId, manifestName],
    });
    const row = result.rows[0];
    if (!row) {
        throw new TursoRecordNotFoundError(
            `No ${manifestName} manifest exists for ${mode}/${releaseId}`,
        );
    }

    const updatedAt = Number(row.updated_at);
    if (!Number.isFinite(updatedAt)) {
        throw new TursoDataIntegrityError(
            `${manifestName} manifest has an invalid update time`,
        );
    }

    return {
        payload: parseStoredJson<Payload>(
            row.payload_json,
            `${manifestName} manifest`,
        ),
        updatedAt,
    };
}
