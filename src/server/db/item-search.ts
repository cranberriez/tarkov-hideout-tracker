import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type { ItemSearchPayload } from "@/types/contracts";
import { normalizeName } from "@/lib/utils/normalize-name";
import { items, itemModes } from "@/server/postgres/schema";
import { getPostgresDb, type PostgresDatabase } from "@/server/postgres/connection";
import { getItemsByIds } from "./domain-data";
import { getCachedItemsByIds } from "./catalog-cache";
import { withStableCatalogRead } from "./postgres-read";
import { DatabaseDataIntegrityError } from "./errors";

export async function searchItemPreviews(
	query: string,
	mode: TarkovDataMode,
	contentVersion: string,
	resultLimit: number,
	database?: PostgresDatabase,
): Promise<ItemSearchPayload> {
	const normalized = normalizeName(query);
	if (!normalized) throw new RangeError("Item search query must contain searchable characters");
	const compact = normalized.replace(/-/g, "");
	const db = database ?? getPostgresDb();
	const effectiveName = sql`lower(coalesce(${itemModes.displayOverride}->>'normalizedName', ${itemModes.displayOverride}->>'normalized_name', ${items.normalizedName}))`;
	const effectiveShortName = sql`lower(coalesce(${itemModes.displayOverride}->>'shortName', ${itemModes.displayOverride}->>'short_name', ${items.shortName}, ''))`;
	const queryResult: { data: string[]; contentVersion: string } = await withStableCatalogRead(
		mode,
		async (conn): Promise<string[]> => {
			const rows = await conn
				.select({ id: items.id, normalizedName: items.normalizedName })
				.from(items)
				.innerJoin(itemModes, and(eq(itemModes.itemId, items.id), eq(itemModes.mode, mode)))
				.where(
					sql`(position(${normalized} in ${effectiveName}) > 0 OR position(${compact} in regexp_replace(${effectiveName}, '-', '', 'g')) > 0 OR position(${normalized} in ${effectiveShortName}) > 0 OR position(${normalized.replaceAll("-", " ")} in ${effectiveShortName}) > 0)`,
				)
				.orderBy(
					sql`case when position(${normalized} in ${effectiveName}) = 1 then 0 when position(${normalized} in ${effectiveShortName}) = 1 or position(${normalized.replaceAll("-", " ")} in ${effectiveShortName}) = 1 then 1 else 2 end`,
					effectiveName,
					asc(items.id),
				)
				.limit(resultLimit);
			return rows.map((row) => row.id);
		},
		db,
		contentVersion,
	);
	const previews = database
		? await getItemsByIds(mode, queryResult.data, db, queryResult.contentVersion)
		: await getCachedItemsByIds(mode, queryResult.contentVersion, queryResult.data);
	const previewItems = queryResult.data.map((id) => previews.data[id]);
	if (previewItems.some((item) => !item || item.id.length === 0 || typeof item.normalizedName !== "string")) {
		throw new DatabaseDataIntegrityError("An item search preview has an invalid shape");
	}
	return { items: previewItems };
}
