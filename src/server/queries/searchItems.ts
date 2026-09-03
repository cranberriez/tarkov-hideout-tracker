import { normalizeName } from "../../lib/utils/normalize-name";
import { ITEM_SEARCH_MAX_QUERY_LENGTH } from "../../types/contracts";

export function isValidItemSearchQuery(query: string): boolean {
    const trimmedQuery = query.trim();
    return (
        trimmedQuery.length > 0 &&
        trimmedQuery.length <= ITEM_SEARCH_MAX_QUERY_LENGTH &&
        normalizeName(trimmedQuery).length > 0
    );
}
