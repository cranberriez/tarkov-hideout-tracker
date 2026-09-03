import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getTursoClient } from "./client";
import { TursoDataIntegrityError, TursoRecordNotFoundError } from "./errors";
import { getActiveDataReleaseId } from "./release-config";
import { parseStoredJson } from "./stored-json";

export interface ConfiguredReleaseInfo {
    mode: TarkovJsonGameMode;
    releaseId: string;
    schemaVersion: number;
    generatedAt: number;
    uploadedAt: number | null;
    recordCounts: Record<string, number>;
    sourceFreshness: Record<string, number>;
}

function requiredNumber(value: unknown, label: string): number {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new TursoDataIntegrityError(`${label} is not a valid number`);
    }
    return number;
}

export async function getConfiguredReleaseInfo(
    mode: TarkovJsonGameMode,
    database: Client = getTursoClient(),
): Promise<ConfiguredReleaseInfo> {
    const releaseId = getActiveDataReleaseId(mode);
    const result = await database.execute({
        sql: `
            SELECT
                schema_version,
                generated_at,
                uploaded_at,
                record_counts_json,
                source_freshness_json
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

    return {
        mode,
        releaseId,
        schemaVersion: requiredNumber(row.schema_version, "Schema version"),
        generatedAt: requiredNumber(row.generated_at, "Generated time"),
        uploadedAt:
            row.uploaded_at === null
                ? null
                : requiredNumber(row.uploaded_at, "Uploaded time"),
        recordCounts: parseStoredJson<Record<string, number>>(
            row.record_counts_json,
            "Release record counts",
        ),
        sourceFreshness: parseStoredJson<Record<string, number>>(
            row.source_freshness_json,
            "Release source freshness",
        ),
    };
}
