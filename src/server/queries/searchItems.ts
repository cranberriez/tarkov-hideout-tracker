import { normalizeName } from "../../lib/utils/normalize-name";
import { ITEM_SEARCH_MAX_QUERY_LENGTH } from "../../types/contracts";
import type { TarkovJsonGameMode } from "../../lib/game-mode";
import type { ItemSearchPayload } from "../../types/contracts";
import { searchItemPreviews } from "../db/item-search";
import { getCatalogVersion } from "../db/postgres-read";
import type { PostgresDatabase } from "@/server/postgres/connection";

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
	database?: PostgresDatabase,
): Promise<ItemSearchPayload> {
	const contentVersion = await getCatalogVersion(mode, database);
	return searchItemPreviews(query, mode, contentVersion, resultLimit, database);
}
