import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import type { DataResult, TarkovDataMode } from "@/types/common";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import { barters, catalogStatus, crafts } from "@/server/postgres/schema";
import { getPostgresDb } from "@/server/postgres/connection";
import { DatabaseDataIntegrityError } from "./errors";
import { withStableCatalogRead } from "./postgres-read";
import { boundedReadCache, canonicalIds, mapBatches } from "./read-cache";

const STATION_RECIPE_REVALIDATE_SECONDS = 7 * 24 * 60 * 60;

function num(value: unknown, label: string): number {
	const result = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(result)) throw new DatabaseDataIntegrityError(`${label} is not numeric`);
	return result;
}

function array<T>(value: unknown, label: string): T[] {
	if (!Array.isArray(value)) throw new DatabaseDataIntegrityError(`${label} is not a JSON array`);
	return value as T[];
}

function updatedAt(freshness: unknown, domain: "crafts" | "barters"): number {
	if (!freshness || typeof freshness !== "object") throw new DatabaseDataIntegrityError("Catalog freshness is missing");
	const value = (freshness as Record<string, unknown>)[domain];
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
		throw new DatabaseDataIntegrityError(`${domain} has invalid source freshness`);
	}
	return value;
}

type CraftRow = typeof crafts.$inferSelect;
type BarterRow = typeof barters.$inferSelect;

function craftRecord(row: CraftRow): CraftRecord {
	return {
		id: row.id,
		productItemId: row.productItemId,
		productCount: num(row.productCount, "craft product count"),
		stationId: row.stationId,
		level: row.level,
		duration: num(row.duration, "craft duration"),
		...(row.taskUnlockId ? { taskUnlockId: row.taskUnlockId } : {}),
		requiredItems: array(row.requiredItems, `craft ingredients for ${row.id}`) as CraftRecord["requiredItems"],
		requiredQuestItems: array(
			row.requiredQuestItems,
			`quest item ingredients for ${row.id}`,
		) as CraftRecord["requiredQuestItems"],
		gameEditions: array(row.gameEditions, `craft editions for ${row.id}`) as string[],
	};
}

function barterRecord(row: BarterRow): BarterRecord {
	return {
		id: row.id,
		offeredItemId: row.offeredItemId,
		offeredCount: num(row.offeredCount, "barter offered count"),
		traderId: row.traderId,
		minTraderLevel: row.minTraderLevel,
		...(row.taskUnlockId ? { taskUnlockId: row.taskUnlockId } : {}),
		requiredItems: array(row.requiredItems, `barter requirements for ${row.id}`) as BarterRecord["requiredItems"],
		...(row.buyLimit !== null ? { buyLimit: num(row.buyLimit, "barter buy limit") } : {}),
	};
}

export function getStationRecipeGraph(
	mode: TarkovDataMode,
	stationId: string,
	version: string,
	extraItemIds: readonly string[] = [],
): Promise<{ crafts: DataResult<CraftRecord[]>; barters: DataResult<BarterRecord[]> }> {
	const extraIds = canonicalIds(extraItemIds);
	return boundedReadCache(
		["station-recipe-graph", mode, version, stationId, JSON.stringify(extraIds)],
		async () => {
			const result = await withStableCatalogRead(
				mode,
				async (db) => {
					const [status] = await db
						.select({ sourceFreshness: catalogStatus.sourceFreshness })
						.from(catalogStatus)
						.where(eq(catalogStatus.mode, mode))
						.limit(1);
					const rootRows = await db
						.select()
						.from(crafts)
						.where(and(eq(crafts.mode, mode), eq(crafts.stationId, stationId)))
						.orderBy(asc(crafts.id));
					const craftById = new Map(rootRows.map((row) => [row.id, craftRecord(row)]));
					const barterById = new Map<string, BarterRecord>();
					const visitedItemIds = new Set<string>();
					let frontier = canonicalIds([
						...extraIds,
						...rootRows.flatMap((row) => craftRecord(row).requiredItems.map((item) => item.itemId)),
					]);

					while (frontier.length) {
						const itemIds = frontier.filter((id) => !visitedItemIds.has(id));
						if (!itemIds.length) break;
						for (const id of itemIds) visitedItemIds.add(id);
						const batches = await mapBatches(itemIds, async (batch) => {
							const [craftRows, barterRows] = await Promise.all([
								db
									.select()
									.from(crafts)
									.where(and(eq(crafts.mode, mode), inArray(crafts.productItemId, batch)))
									.orderBy(asc(crafts.id)),
								db
									.select()
									.from(barters)
									.where(and(eq(barters.mode, mode), inArray(barters.offeredItemId, batch)))
									.orderBy(asc(barters.id)),
							]);
							return { craftRows, barterRows };
						});
						const nextItemIds: string[] = [];
						for (const batch of batches) {
							for (const row of batch.craftRows) {
								const recipe = craftRecord(row);
								craftById.set(recipe.id, recipe);
								nextItemIds.push(...recipe.requiredItems.map((item) => item.itemId));
							}
							for (const row of batch.barterRows) {
								const recipe = barterRecord(row);
								barterById.set(recipe.id, recipe);
								nextItemIds.push(...recipe.requiredItems.map((item) => item.itemId));
							}
						}
						frontier = canonicalIds(nextItemIds);
					}

					return {
						crafts: [...craftById.values()].sort((a, b) => a.id.localeCompare(b.id)),
						barters: [...barterById.values()].sort((a, b) => a.id.localeCompare(b.id)),
						freshness: status?.sourceFreshness,
					};
				},
				getPostgresDb(),
				version,
			);
			return {
				crafts: { data: result.data.crafts, updatedAt: updatedAt(result.data.freshness, "crafts") },
				barters: { data: result.data.barters, updatedAt: updatedAt(result.data.freshness, "barters") },
			};
		},
		STATION_RECIPE_REVALIDATE_SECONDS,
		{ compress: true },
	);
}
