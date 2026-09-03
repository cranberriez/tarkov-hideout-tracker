import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { normalizeName } from "@/lib/utils/normalize-name";
import type { ItemSearchPayload } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";
import { getTursoClient } from "./client";
import { TursoDataIntegrityError } from "./errors";
import { getActiveDataReleaseId } from "./release-config";
import { parseStoredJson } from "./stored-json";

function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, "\\$&");
}

function assertItemSummary(value: ItemSummary, expectedId: unknown): ItemSummary {
    if (
        typeof expectedId !== "string" ||
        value.id !== expectedId ||
        typeof value.name !== "string" ||
        typeof value.normalizedName !== "string"
    ) {
        throw new TursoDataIntegrityError("An item search preview has an invalid shape");
    }
    return value;
}

export async function searchItemPreviews(
    query: string,
    mode: TarkovJsonGameMode,
    resultLimit: number,
    database: Client = getTursoClient(),
): Promise<ItemSearchPayload> {
    const normalizedQuery = normalizeName(query);
    if (!normalizedQuery) {
        throw new RangeError("Item search query must contain searchable characters");
    }

    const releaseId = getActiveDataReleaseId(mode);
    const normalizedPattern = escapeLikePattern(normalizedQuery);
    const compactPattern = escapeLikePattern(normalizedQuery.replace(/-/g, ""));
    const result = await database.execute({
        sql: `
            SELECT search.item_id, search.preview_json
            FROM item_search AS search
            INNER JOIN data_releases AS release
                ON release.mode = search.mode
                AND release.release_id = search.release_id
                AND release.status = 'ready'
            WHERE search.mode = ?
                AND search.release_id = ?
                AND (
                    search.normalized_name LIKE '%' || ? || '%' ESCAPE '\\'
                    OR search.compact_name LIKE '%' || ? || '%' ESCAPE '\\'
                )
            ORDER BY
                CASE
                    WHEN search.normalized_name LIKE ? || '%' ESCAPE '\\' THEN 0
                    ELSE 1
                END,
                search.sort_name COLLATE NOCASE,
                search.item_id
            LIMIT ?
        `,
        args: [
            mode,
            releaseId,
            normalizedPattern,
            compactPattern,
            normalizedPattern,
            resultLimit,
        ],
    });

    return {
        items: result.rows.map((row) =>
            assertItemSummary(
                parseStoredJson<ItemSummary>(row.preview_json, "item search preview"),
                row.item_id,
            ),
        ),
    };
}
