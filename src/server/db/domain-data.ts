import "server-only";

import { resolveItemRelease } from "@/lib/utils/game-releases";

import { asc, eq, inArray, and } from "drizzle-orm";
import type { DataResult, TarkovDataMode } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import type { Station, StationBonus, StationLevel } from "@/types/hideout";
import type { FullQuest } from "@/types/quests";
import type { Trader } from "@/types/traders";
import type { CraftRecord, BarterRecord } from "@/types/recipes";
import {
	items,
	itemModes,
	itemDiscovery,
	itemPrices,
	stations,
	stationModes,
	stationLevels,
	stationItemRequirements,
	quests,
	questModes,
	traders,
	traderModes,
	crafts,
	barters,
	catalogStatus,
} from "@/server/postgres/schema";
import type { PostgresDatabase } from "@/server/postgres/connection";
import { DatabaseDataIntegrityError } from "./errors";
import { withStableCatalogRead } from "./postgres-read";

type FreshDomain = "items" | "stations" | "quests" | "traders" | "crafts" | "barters";
function updatedAt(freshness: unknown, domain: FreshDomain): number {
	if (!freshness || typeof freshness !== "object") throw new DatabaseDataIntegrityError("Catalog freshness is missing");
	const value = (freshness as Record<string, unknown>)[domain];
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
		throw new DatabaseDataIntegrityError(`${domain} has invalid source freshness`);
	}
	return value;
}
function override<T extends object>(base: T, value: unknown, presentationKeys: readonly string[]): T {
	if (value === null || value === undefined) return base;
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new DatabaseDataIntegrityError("Invalid mode display override");
	const result = { ...(base as Record<string, unknown>) };
	for (const key of presentationKeys) delete result[key];
	for (const [rawKey, field] of Object.entries(value as Record<string, unknown>)) {
		const key = rawKey.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
		if (!presentationKeys.includes(key))
			throw new DatabaseDataIntegrityError(`Unexpected display override field ${rawKey}`);
		if (field !== null && field !== undefined) result[key] = field;
	}
	for (const required of ["name", "normalizedName"].filter((key) => presentationKeys.includes(key))) {
		if (typeof result[required] !== "string")
			throw new DatabaseDataIntegrityError(`Display override is missing ${required}`);
	}
	return result as T;
}
function num(value: unknown, label: string): number {
	const result = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(result)) throw new DatabaseDataIntegrityError(`${label} is not numeric`);
	return result;
}
function record<T>(value: unknown, label: string): T {
	if (value === null || typeof value !== "object")
		throw new DatabaseDataIntegrityError(`${label} is not a JSON object`);
	return value as T;
}
function array<T>(value: unknown, label: string): T[] {
	if (!Array.isArray(value)) throw new DatabaseDataIntegrityError(`${label} is not a JSON array`);
	return value as T[];
}

export async function getItemsByIds(
	mode: TarkovDataMode,
	ids: readonly string[],
	db: PostgresDatabase,
	expectedVersion?: string,
): Promise<DataResult<Record<string, ItemSummary>>> {
	const unique = [...new Set(ids)];
	const result = await withStableCatalogRead(
		mode,
		async (conn) => {
			const [status] = await conn
				.select({ sourceFreshness: catalogStatus.sourceFreshness })
				.from(catalogStatus)
				.where(eq(catalogStatus.mode, mode))
				.limit(1);
			const rows = unique.length
				? await conn
						.select({
							id: items.id,
							name: items.name,
							normalizedName: items.normalizedName,
							shortName: items.shortName,
							iconLink: items.iconLink,
							gridImageLink: items.gridImageLink,
							image512pxLink: items.image512pxLink,
							baseImageLink: items.baseImageLink,
							link: items.link,
							wikiLink: items.wikiLink,
							onFleaMarket: itemModes.onFleaMarket,
							minLevelForFlea: itemModes.minLevelForFlea,
							resourceUnits: itemModes.resourceUnits,
							category: itemModes.category,
							displayOverride: itemModes.displayOverride,
							firstSeenAt: itemDiscovery.firstSeenAt,
							firstSeenPatch: itemDiscovery.firstSeenPatch,
							firstSeenReleaseId: itemDiscovery.legacyFirstSeenReleaseId,
							buyFromTrader: itemPrices.traderPurchaseOffers,
						})
						.from(items)
						.innerJoin(itemModes, and(eq(itemModes.itemId, items.id), eq(itemModes.mode, mode)))
						.leftJoin(itemDiscovery, and(eq(itemDiscovery.itemId, items.id), eq(itemDiscovery.mode, mode)))
						.leftJoin(itemPrices, and(eq(itemPrices.itemId, items.id), eq(itemPrices.mode, mode)))
						.where(inArray(items.id, unique))
				: [];
			const output: Record<string, ItemSummary> = Object.create(null) as Record<string, ItemSummary>;
			for (const row of rows) {
				const firstSeenAt = row.firstSeenAt;
				const storedPatch = row.firstSeenPatch;
				if (
					firstSeenAt !== null &&
					firstSeenAt !== undefined &&
					(!Number.isSafeInteger(firstSeenAt) || firstSeenAt <= 0)
				)
					throw new DatabaseDataIntegrityError(`Invalid item discovery metadata for ${row.id}`);
				if (storedPatch !== null && storedPatch !== undefined && typeof storedPatch !== "string")
					throw new DatabaseDataIntegrityError(`Invalid item discovery metadata for ${row.id}`);
				if (
					(storedPatch === "pre-1.1.5" && firstSeenAt !== null) ||
					(storedPatch !== null &&
						storedPatch !== undefined &&
						storedPatch !== "pre-1.1.5" &&
						(firstSeenAt === null || firstSeenAt === undefined))
				) {
					throw new DatabaseDataIntegrityError(`Invalid item discovery metadata for ${row.id}`);
				}
				if (
					row.firstSeenReleaseId !== null &&
					row.firstSeenReleaseId !== undefined &&
					typeof row.firstSeenReleaseId !== "string"
				)
					throw new DatabaseDataIntegrityError(`Invalid item discovery provenance for ${row.id}`);
				const firstSeenPatch = resolveItemRelease(row.firstSeenAt, mode, storedPatch, row.firstSeenReleaseId);
				const summary = override<ItemSummary>(
					{
						id: row.id,
						name: row.name,
						normalizedName: row.normalizedName,
						...(row.shortName ? { shortName: row.shortName } : {}),
						...(row.iconLink ? { iconLink: row.iconLink } : {}),
						...(row.gridImageLink ? { gridImageLink: row.gridImageLink } : {}),
						...(row.image512pxLink ? { image512pxLink: row.image512pxLink } : {}),
						...(row.baseImageLink ? { baseImageLink: row.baseImageLink } : {}),
						...(row.link ? { link: row.link } : {}),
						...(row.wikiLink ? { wikiLink: row.wikiLink } : {}),
						...(row.onFleaMarket !== null ? { onFleaMarket: Boolean(row.onFleaMarket) } : {}),
						...(row.minLevelForFlea !== null ? { minLevelForFlea: row.minLevelForFlea } : {}),
						...(row.resourceUnits !== null ? { resourceUnits: num(row.resourceUnits, "resource units") } : {}),
						...(row.category ? { category: record(row.category, `category for ${row.id}`) } : {}),
						...(firstSeenPatch ? { firstSeenPatch } : {}),
						...(firstSeenAt !== undefined ? { firstSeenAt } : {}),
						...(row.firstSeenReleaseId ? { firstSeenReleaseId: row.firstSeenReleaseId } : {}),
						...(Array.isArray(row.buyFromTrader) && row.buyFromTrader.length
							? { buyFromTrader: row.buyFromTrader }
							: {}),
					},
					row.displayOverride,
					[
						"name",
						"normalizedName",
						"shortName",
						"iconLink",
						"gridImageLink",
						"image512pxLink",
						"baseImageLink",
						"link",
						"wikiLink",
					],
				);
				output[row.id] = summary;
			}
			return { items: output, freshness: status?.sourceFreshness };
		},
		db,
		expectedVersion,
	);
	return { data: result.data.items, updatedAt: updatedAt(result.data.freshness, "items") };
}

export async function getStations(
	mode: TarkovDataMode,
	db: PostgresDatabase,
	expectedVersion?: string,
): Promise<DataResult<Station[]>> {
	const result = await withStableCatalogRead(
		mode,
		async (conn) => {
			const [status] = await conn
				.select({ sourceFreshness: catalogStatus.sourceFreshness })
				.from(catalogStatus)
				.where(eq(catalogStatus.mode, mode))
				.limit(1);
			const heads = await conn
				.select({
					id: stations.id,
					name: stations.name,
					normalizedName: stations.normalizedName,
					imageLink: stations.imageLink,
					displayOverride: stationModes.displayOverride,
				})
				.from(stations)
				.innerJoin(stationModes, and(eq(stationModes.stationId, stations.id), eq(stationModes.mode, mode)))
				.orderBy(asc(stations.normalizedName), asc(stations.id));
			const levelRows = await conn
				.select({
					stationId: stationLevels.stationId,
					mode: stationLevels.mode,
					level: stationLevels.level,
					levelId: stationLevels.levelId,
					constructionTime: stationLevels.constructionTime,
					stationRequirements: stationLevels.stationRequirements,
					skillRequirements: stationLevels.skillRequirements,
					traderRequirements: stationLevels.traderRequirements,
					bonuses: stationLevels.bonuses,
					requirementId: stationItemRequirements.requirementId,
					itemId: stationItemRequirements.itemId,
					quantity: stationItemRequirements.quantity,
					foundInRaid: stationItemRequirements.foundInRaid,
					isTool: stationItemRequirements.isTool,
				})
				.from(stationLevels)
				.leftJoin(
					stationItemRequirements,
					and(
						eq(stationItemRequirements.stationId, stationLevels.stationId),
						eq(stationItemRequirements.mode, stationLevels.mode),
						eq(stationItemRequirements.level, stationLevels.level),
					),
				)
				.where(eq(stationLevels.mode, mode))
				.orderBy(asc(stationLevels.stationId), asc(stationLevels.level), asc(stationItemRequirements.requirementId));
			const byStation = new Map<string, Map<number, StationLevel>>();
			for (const row of levelRows) {
				const levels = byStation.get(row.stationId) ?? new Map<number, StationLevel>();
				byStation.set(row.stationId, levels);
				let level = levels.get(row.level);
				if (!level) {
					level = {
						id: row.levelId,
						level: row.level,
						constructionTime: num(row.constructionTime, "construction time"),
						itemRequirements: [],
						stationLevelRequirements: array(
							row.stationRequirements,
							"station requirements",
						) as StationLevel["stationLevelRequirements"],
						skillRequirements: array(row.skillRequirements, "skill requirements") as StationLevel["skillRequirements"],
						traderRequirements: array(
							row.traderRequirements,
							"trader requirements",
						) as StationLevel["traderRequirements"],
						...(row.bonuses !== null ? { bonuses: array<StationBonus>(row.bonuses, "station bonuses") } : {}),
					};
					levels.set(row.level, level);
				}
				if (row.requirementId !== null && row.itemId !== null)
					level.itemRequirements.push({
						id: row.requirementId,
						itemId: row.itemId,
						count: num(row.quantity, "requirement quantity"),
						isFir: Boolean(row.foundInRaid),
						isTool: Boolean(row.isTool),
					});
			}
			return {
				stations: heads.map((row) =>
					override<Station>(
						{
							id: row.id,
							name: row.name,
							normalizedName: row.normalizedName,
							...(row.imageLink ? { imageLink: row.imageLink } : {}),
							levels: [...(byStation.get(row.id)?.values() ?? [])],
						},
						row.displayOverride,
						["name", "normalizedName", "imageLink"],
					),
				),
				freshness: status?.sourceFreshness,
			};
		},
		db,
		expectedVersion,
	);
	return { data: result.data.stations, updatedAt: updatedAt(result.data.freshness, "stations") };
}

export async function getQuests(
	mode: TarkovDataMode,
	db: PostgresDatabase,
	expectedVersion?: string,
	ids?: readonly string[],
): Promise<DataResult<FullQuest[]>> {
	const result = await withStableCatalogRead(
		mode,
		async (conn) => {
			const [status] = await conn
				.select({ sourceFreshness: catalogStatus.sourceFreshness })
				.from(catalogStatus)
				.where(eq(catalogStatus.mode, mode))
				.limit(1);
			const rows =
				ids?.length === 0
					? []
					: await conn
							.select({
								id: quests.id,
								name: quests.name,
								normalizedName: quests.normalizedName,
								wikiLink: quests.wikiLink,
								taskImageLink: quests.taskImageLink,
								questMode: questModes,
								trader: traders,
								traderOverride: traderModes.displayOverride,
							})
							.from(quests)
							.innerJoin(questModes, and(eq(questModes.questId, quests.id), eq(questModes.mode, mode)))
							.leftJoin(traders, eq(traders.id, questModes.traderId))
							.leftJoin(traderModes, and(eq(traderModes.traderId, questModes.traderId), eq(traderModes.mode, mode)))
							.where(ids ? inArray(quests.id, [...new Set(ids)]) : undefined)
							.orderBy(asc(quests.normalizedName), asc(quests.id));
			const data = rows.map((row) => {
				if (!row.trader) throw new DatabaseDataIntegrityError(`Quest ${row.id} has no trader presentation`);
				const q = row.questMode;
				const trader = override<Trader>(
					{
						id: row.trader.id,
						name: row.trader.name,
						normalizedName: row.trader.normalizedName,
						...(row.trader.imageLink ? { imageLink: row.trader.imageLink } : {}),
						...(row.trader.image4xLink ? { image4xLink: row.trader.image4xLink } : {}),
					},
					row.traderOverride,
					["name", "normalizedName", "imageLink", "image4xLink"],
				);
				return override<FullQuest>(
					{
						id: row.id,
						name: row.name,
						normalizedName: row.normalizedName,
						removed: q.removed,
						taskImageLink: row.taskImageLink,
						wikiLink: row.wikiLink,
						minPlayerLevel: q.minPlayerLevel,
						kappaRequired: q.kappaRequired,
						lightkeeperRequired: q.lightkeeperRequired,
						factionName: q.factionName,
						experience: q.experience,
						...(q.map ? { map: q.map as FullQuest["map"] } : {}),
						trader,
						objectives: array(q.objectives, `objectives for ${row.id}`) as FullQuest["objectives"],
						taskRequirements: array(q.taskRequirements, `prerequisites for ${row.id}`) as FullQuest["taskRequirements"],
						failConditions: array(q.failConditions, `fail conditions for ${row.id}`) as FullQuest["failConditions"],
						traderRequirements: array(
							q.traderRequirements,
							`trader requirements for ${row.id}`,
						) as FullQuest["traderRequirements"],
						otherRequirements: array(
							q.otherRequirements,
							`other requirements for ${row.id}`,
						) as FullQuest["otherRequirements"],
						...(q.requiredPrestige ? { requiredPrestige: q.requiredPrestige as FullQuest["requiredPrestige"] } : {}),
						...record<Partial<FullQuest>>(q.rewardGroups, `reward groups for ${row.id}`),
					},
					q.displayOverride,
					["name", "normalizedName", "wikiLink", "taskImageLink"],
				);
			});
			return { quests: data, freshness: status?.sourceFreshness };
		},
		db,
		expectedVersion,
	);
	return { data: result.data.quests, updatedAt: updatedAt(result.data.freshness, "quests") };
}

export async function getTraders(
	mode: TarkovDataMode,
	db: PostgresDatabase,
	expectedVersion?: string,
	ids?: readonly string[],
): Promise<DataResult<Trader[]>> {
	const result = await withStableCatalogRead(
		mode,
		async (conn) => {
			const [status] = await conn
				.select({ sourceFreshness: catalogStatus.sourceFreshness })
				.from(catalogStatus)
				.where(eq(catalogStatus.mode, mode))
				.limit(1);
			const rows =
				ids?.length === 0
					? []
					: await conn
							.select({
								id: traders.id,
								name: traders.name,
								normalizedName: traders.normalizedName,
								imageLink: traders.imageLink,
								image4xLink: traders.image4xLink,
								displayOverride: traderModes.displayOverride,
							})
							.from(traders)
							.innerJoin(traderModes, and(eq(traderModes.traderId, traders.id), eq(traderModes.mode, mode)))
							.where(ids ? inArray(traders.id, [...new Set(ids)]) : undefined)
							.orderBy(asc(traders.normalizedName), asc(traders.id));
			return {
				traders: rows.map((row) =>
					override<Trader>(
						{
							id: row.id,
							name: row.name,
							normalizedName: row.normalizedName,
							...(row.imageLink ? { imageLink: row.imageLink } : {}),
							...(row.image4xLink ? { image4xLink: row.image4xLink } : {}),
						},
						row.displayOverride,
						["name", "normalizedName", "imageLink", "image4xLink"],
					),
				),
				freshness: status?.sourceFreshness,
			};
		},
		db,
		expectedVersion,
	);
	return { data: result.data.traders, updatedAt: updatedAt(result.data.freshness, "traders") };
}

export async function getRecipes(mode: TarkovDataMode, db: PostgresDatabase, expectedVersion?: string) {
	const result = await withStableCatalogRead(
		mode,
		async (conn) => {
			const [status] = await conn
				.select({ sourceFreshness: catalogStatus.sourceFreshness })
				.from(catalogStatus)
				.where(eq(catalogStatus.mode, mode))
				.limit(1);
			const craftRows = await conn.select().from(crafts).where(eq(crafts.mode, mode)).orderBy(asc(crafts.id));
			const barterRows = await conn.select().from(barters).where(eq(barters.mode, mode)).orderBy(asc(barters.id));
			const craftRecords: CraftRecord[] = craftRows.map((row) => ({
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
			}));
			const barterRecords: BarterRecord[] = barterRows.map((row) => ({
				id: row.id,
				offeredItemId: row.offeredItemId,
				offeredCount: num(row.offeredCount, "barter offered count"),
				traderId: row.traderId,
				minTraderLevel: row.minTraderLevel,
				...(row.taskUnlockId ? { taskUnlockId: row.taskUnlockId } : {}),
				requiredItems: array(row.requiredItems, `barter requirements for ${row.id}`) as BarterRecord["requiredItems"],
				...(row.buyLimit !== null ? { buyLimit: num(row.buyLimit, "barter buy limit") } : {}),
			}));
			return { crafts: craftRecords, barters: barterRecords, freshness: status?.sourceFreshness };
		},
		db,
		expectedVersion,
	);
	return {
		crafts: { data: result.data.crafts, updatedAt: updatedAt(result.data.freshness, "crafts") },
		barters: { data: result.data.barters, updatedAt: updatedAt(result.data.freshness, "barters") },
	};
}
