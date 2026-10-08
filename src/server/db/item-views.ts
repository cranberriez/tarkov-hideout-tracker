import "server-only";

import { and, eq } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type { ItemAcquisitionTreeData, ItemRelationsPayload, ItemUsageData } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import { itemDetails, catalogStatus } from "@/server/postgres/schema";
import { getCurrentPriceData } from "./price-data";
import { getCatalogVersion, withStableCatalogRead } from "./postgres-read";
import { DatabaseDataIntegrityError, DatabaseRecordNotFoundError } from "./errors";
import { boundedReadCache } from "./read-cache";
import {
	getCachedCatalogItems,
	getCachedQuests,
	getCachedQuestsByIds,
	getCachedStations,
	getCachedTraderOffers,
	getCachedTraders,
	pickById,
} from "./catalog-cache";

import { readItemRecipeUsage } from "./item-recipe-usage";

interface ItemViewPayloads {
	relations: ItemRelationsPayload;
	usage: ItemUsageData;
	acquisition: ItemAcquisitionTreeData;
}
export type ItemViewType = keyof ItemViewPayloads;

function validatePayload<T>(payload: unknown, label: string): T {
	if (payload === null || typeof payload !== "object") throw new DatabaseDataIntegrityError(`${label} is invalid`);
	return payload as T;
}

async function selectCached<T extends { id: string }>(
	read: Promise<{ data: T[]; updatedAt: number }>,
	ids: readonly string[],
): Promise<{ data: T[]; updatedAt: number }> {
	const result = await read;
	return { data: pickById(result.data, ids), updatedAt: result.updatedAt };
}

export async function getItemView<ViewType extends ItemViewType>(
	mode: TarkovDataMode,
	itemId: string,
	viewType: ViewType,
	includePrices = true,
): Promise<ItemViewPayloads[ViewType]> {
	const expectedVersion = await getCatalogVersion(mode);
	// Catalog views are versioned; usage is derived from indexed recipes, other views remain stored.
	// Mutable offers, prices and source labels are layered on below.
	const payload = await boundedReadCache(
		["item-view-inputs-v1", viewType, mode, expectedVersion, itemId],
		async () =>
			(
				await withStableCatalogRead(
					mode,
					async (db) => {
						if (viewType === "usage")
							return (await readItemRecipeUsage(mode, itemId, db, expectedVersion)) as ItemViewPayloads[ViewType];
						const [row] = await db
							.select({ value: itemDetails[viewType], sourceFreshness: catalogStatus.sourceFreshness })
							.from(itemDetails)
							.innerJoin(catalogStatus, eq(catalogStatus.mode, itemDetails.mode))
							.where(and(eq(itemDetails.mode, mode), eq(itemDetails.itemId, itemId)))
							.limit(1);
						if (!row) throw new DatabaseRecordNotFoundError(`No ${viewType} detail view exists for ${mode}/${itemId}`);
						const dto = validatePayload<ItemViewPayloads[ViewType]>(row.value, `${viewType} view for ${itemId}`);
						const freshnessDomains: Record<string, string> =
							viewType === "relations"
								? { itemsUpdatedAt: "items", stationsUpdatedAt: "stations", questsUpdatedAt: "quests" }
								: { itemsUpdatedAt: "items", bartersUpdatedAt: "barters", craftsUpdatedAt: "crafts" };
						const freshness = (dto.freshness ?? {}) as Record<string, number | null | undefined>;
						for (const key of Object.keys(freshnessDomains)) freshness[key] ??= null;
						for (const [key, domain] of Object.entries(freshnessDomains)) {
							const timestamp = (row.sourceFreshness as Record<string, unknown> | null)?.[domain];
							if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) || timestamp <= 0)
								throw new DatabaseDataIntegrityError(`Item view has invalid ${domain} source freshness`);
							freshness[key] = timestamp;
						}
						if (viewType === "relations") freshness.pricesUpdatedAt ??= null;
						if (viewType === "acquisition") freshness.pricesUpdatedAt ??= null;
						(dto as { freshness: Record<string, number | null | undefined> }).freshness = freshness;
						if (viewType === "relations") {
							(dto as ItemRelationsPayload).errors ??= { items: null, prices: null, stations: null, quests: null };
						}
						if (viewType === "acquisition") {
							(dto as ItemAcquisitionTreeData).errors ??= { items: null, prices: null, barters: null, crafts: null };
						}
						return dto;
					},
					undefined,
					expectedVersion,
				)
			).data,
		7 * 24 * 60 * 60,
		{ compress: true },
	);

	const allItems: ItemSummary[] =
		payload && viewType === "relations"
			? [
					...((payload as ItemRelationsPayload).item ? [(payload as ItemRelationsPayload).item as ItemSummary] : []),
					...(payload as ItemRelationsPayload).relatedItems,
				]
			: (payload as ItemUsageData | ItemAcquisitionTreeData).items;
	const itemIds = [...new Set(allItems.map((item) => item.id))];
	const [catalogItems, priceResult, offersById] = await Promise.all([
		viewType === "usage"
			? Promise.resolve({ data: Object.fromEntries(allItems.map((item) => [item.id, item])) })
			: getCachedCatalogItems(mode, expectedVersion),
		includePrices
			? getCurrentPriceData(mode, itemIds)
			: Promise.resolve({ data: {} as Record<string, CurrentPrice>, updatedAt: null }),
		getCachedTraderOffers(mode),
	]);
	const hydrate = (item: ItemSummary): ItemSummary => {
		const stored = catalogItems.data[item.id];
		const merged: ItemSummary = { ...(stored ?? item), buyFromTrader: offersById[item.id] ?? [] };
		return { ...merged, marketPrice: includePrices ? (priceResult.data[item.id] ?? null) : null };
	};
	const hydratedItems = allItems.map(hydrate);
	let usageStations: ItemUsageData["stationsById"] = {};
	let stationPresentationUpdatedAt: number | null = null;
	let traderById: Record<string, import("@/types/traders").Trader> = {};
	let taskUnlocksById: Record<string, { id: string; name: string; wikiLink?: string | null }> = {};
	let traderPresentationUpdatedAt: number | null = null;
	let taskPresentationUpdatedAt: number | null = null;
	let presentationError: string | undefined;
	if (viewType === "usage") {
		const usage = payload as ItemUsageData;
		const rootOffers = offersById[itemId] ?? [];
		const listedBarters = [...usage.barters, ...usage.usedInBarters];
		const listedCrafts = [...usage.crafts, ...usage.usedInCrafts];
		const stationIds = new Set(listedCrafts.map((r) => r.stationId));
		const traderIds = [
			...new Set([...listedBarters.map((r) => r.traderId), ...rootOffers.map((offer) => offer.traderId)]),
		];
		const unlockIds = [
			...new Set([
				...[...listedBarters, ...listedCrafts].flatMap((r) => (r.taskUnlockId ? [r.taskUnlockId] : [])),
				...rootOffers.flatMap((offer) => (offer.taskUnlockId ? [offer.taskUnlockId] : [])),
			]),
		];
		try {
			const [traders, quests, stations] = await Promise.all([
				traderIds.length ? selectCached(getCachedTraders(mode, expectedVersion), traderIds) : Promise.resolve(null),
				unlockIds.length ? getCachedQuestsByIds(mode, expectedVersion, unlockIds) : Promise.resolve(null),
				stationIds.size ? getCachedStations(mode, expectedVersion) : Promise.resolve(null),
			]);
			traderById = {
				...usage.tradersById,
				...(traders ? Object.fromEntries(traders.data.map((trader) => [trader.id, trader])) : {}),
			};
			taskUnlocksById = {
				...usage.taskUnlocksById,
				...(quests
					? Object.fromEntries(
							Object.values(quests.data).map((quest) => [
								quest.id,
								{ id: quest.id, name: quest.name, wikiLink: quest.wikiLink },
							]),
						)
					: {}),
			};
			usageStations = Object.fromEntries(
				(stations?.data ?? [])
					.filter((s) => stationIds.has(s.id))
					.map((s) => [
						s.id,
						{
							id: s.id,
							name: s.name,
							normalizedName: s.normalizedName,
							...(s.imageLink ? { imageLink: s.imageLink } : {}),
						},
					]),
			);
			stationPresentationUpdatedAt = stations?.updatedAt ?? null;
			if (
				traderIds.some((id) => !traderById[id]) ||
				unlockIds.some((id) => !taskUnlocksById[id]) ||
				[...stationIds].some((id) => !usageStations[id])
			)
				presentationError = "Some recipe source labels are unavailable";
			traderPresentationUpdatedAt = traders?.updatedAt ?? null;
			taskPresentationUpdatedAt = quests?.updatedAt ?? null;
		} catch {
			presentationError = "Acquisition labels are temporarily unavailable";
			traderById = usage.tradersById;
			taskUnlocksById = usage.taskUnlocksById;
		}
	}
	let acquisitionLabels: Pick<
		ItemAcquisitionTreeData,
		"tradersById" | "stationsById" | "taskUnlocksById" | "presentationError"
	> = {};
	if (viewType === "acquisition") {
		const tree = payload as ItemAcquisitionTreeData;
		const traderIds = [...new Set(tree.barters.map((barter) => barter.traderId))];
		const stationIds = new Set(tree.crafts.map((craft) => craft.stationId));
		const unlockIds = [
			...new Set(
				[...tree.barters, ...tree.crafts].flatMap((recipe) => (recipe.taskUnlockId ? [recipe.taskUnlockId] : [])),
			),
		];
		try {
			const [traders, stations, quests] = await Promise.all([
				traderIds.length ? selectCached(getCachedTraders(mode, expectedVersion), traderIds) : Promise.resolve(null),
				stationIds.size ? getCachedStations(mode, expectedVersion) : Promise.resolve(null),
				unlockIds.length ? selectCached(getCachedQuests(mode, expectedVersion), unlockIds) : Promise.resolve(null),
			]);
			acquisitionLabels = {
				tradersById: Object.fromEntries((traders?.data ?? []).map((trader) => [trader.id, trader])),
				stationsById: Object.fromEntries(
					(stations?.data ?? [])
						.filter((station) => stationIds.has(station.id))
						.map((station) => [
							station.id,
							{
								id: station.id,
								name: station.name,
								normalizedName: station.normalizedName,
								...(station.imageLink ? { imageLink: station.imageLink } : {}),
							},
						]),
				),
				taskUnlocksById: Object.fromEntries(
					(quests?.data ?? []).map((quest) => [quest.id, { id: quest.id, name: quest.name, wikiLink: quest.wikiLink }]),
				),
			};
		} catch {
			acquisitionLabels = { presentationError: "Recipe source labels are temporarily unavailable" };
		}
	}
	if (viewType === "relations") {
		const relations = payload as ItemRelationsPayload;
		return {
			...relations,
			item: relations.item ? hydrate(relations.item) : null,
			relatedItems: relations.relatedItems.map(hydrate),
			freshness: { ...relations.freshness, pricesUpdatedAt: priceResult.updatedAt },
		} as ItemViewPayloads[ViewType];
	}
	const details = payload as ItemUsageData | ItemAcquisitionTreeData;
	if (viewType === "usage") {
		const usage = details as ItemUsageData;
		return {
			...usage,
			items: hydratedItems,
			tradersById: traderById,
			stationsById: usageStations,
			taskUnlocksById,
			freshness: {
				...usage.freshness,
				pricesUpdatedAt: priceResult.updatedAt,
				stationsUpdatedAt: stationPresentationUpdatedAt,
				tradersUpdatedAt: traderPresentationUpdatedAt ?? usage.freshness.tradersUpdatedAt,
				taskUnlocksUpdatedAt: taskPresentationUpdatedAt ?? usage.freshness.taskUnlocksUpdatedAt,
			},
			presentationError,
		} as ItemViewPayloads[ViewType];
	}
	return {
		...details,
		...acquisitionLabels,
		items: hydratedItems,
		freshness: { ...details.freshness, pricesUpdatedAt: priceResult.updatedAt },
	} as ItemViewPayloads[ViewType];
}

export function getItemRelationsView(mode: TarkovDataMode, itemId: string, includePrices = true) {
	return getItemView(mode, itemId, "relations", includePrices);
}
export function getItemUsageView(mode: TarkovDataMode, itemId: string, includePrices = true) {
	return getItemView(mode, itemId, "usage", includePrices);
}
export function getItemAcquisitionView(mode: TarkovDataMode, itemId: string, includePrices = true) {
	return getItemView(mode, itemId, "acquisition", includePrices);
}
