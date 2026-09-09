import { normalizeName } from "../../lib/utils/normalize-name";
import { ITEM_SEARCH_MAX_QUERY_LENGTH } from "../../types/contracts";
import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "../../lib/game-mode";
import type { ItemSearchPayload } from "../../types/contracts";
import { searchItemPreviews } from "../db/item-search";
import { getActiveDataReleaseId } from "../db/release-config";
import { getTursoClient } from "../db/client";

export function isValidItemSearchQuery(query: string): boolean {
    const trimmedQuery = query.trim();
    return (
        trimmedQuery.length > 0 &&
        trimmedQuery.length <= ITEM_SEARCH_MAX_QUERY_LENGTH &&
        normalizeName(trimmedQuery).length > 0
    );
}

export async function searchItems(
    query: string,
    mode: TarkovJsonGameMode,
    resultLimit: number,
    database?: Client,
): Promise<ItemSearchPayload> {
    const db = database ?? getTursoClient();
    const releaseId = await getActiveDataReleaseId(mode, db);
    return searchItemPreviews(query, mode, releaseId, resultLimit, db);
}
