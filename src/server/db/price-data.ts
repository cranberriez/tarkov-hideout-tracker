import type { DataResult, TarkovDataMode } from "@/types/common";
import type { TraderPurchaseOffer } from "@/types/items";
import type { CurrentPrice, PriceHistoryPoint } from "@/types/prices";
import { normalizeTraderSellOffers } from "../../lib/data/traders";
import { deriveEffectivePrice } from "../../lib/utils/price-history";
import { getPostgresDb } from "../postgres/connection";
import type { PostgresDatabase } from "../postgres/connection";
import { itemPrices } from "../postgres/schema";
import { and, eq, inArray } from "drizzle-orm";
import { boundedReadCache, canonicalIds, mapBatches } from "./read-cache";
import { readMarketReferences } from "./market-analytics";

/** Stored recent flea points, or none when any point is malformed or out of order. */
export function readPoints(value: unknown): PriceHistoryPoint[] {
	if (!Array.isArray(value) || value.length > 10) return [];
	const points: PriceHistoryPoint[] = [];
	for (const candidate of value) {
		if (typeof candidate !== "object" || candidate === null) return [];
		const point = candidate as PriceHistoryPoint;
		if (
			!Number.isSafeInteger(point.timestamp) ||
			point.timestamp <= 0 ||
			!Number.isFinite(point.price) ||
			point.price < 0 ||
			!Number.isFinite(point.priceMin) ||
			point.priceMin < 0 ||
			(point.offerCount !== null && (!Number.isInteger(point.offerCount) || point.offerCount < 0)) ||
			(points.length > 0 && points[points.length - 1].timestamp >= point.timestamp)
		)
			return [];
		points.push({
			timestamp: point.timestamp,
			price: point.price,
			priceMin: point.priceMin,
			offerCount: point.offerCount,
		});
	}
	return points;
}

function asFinite(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const normalized = typeof value === "string" ? Number(value) : value;
	return typeof normalized === "number" && Number.isFinite(normalized) ? normalized : null;
}

function asOffers(value: unknown): TraderPurchaseOffer[] {
	return Array.isArray(value) ? (value as TraderPurchaseOffer[]) : [];
}

export async function getCurrentPriceData(
	mode: TarkovDataMode,
	itemIds: readonly string[],
	database?: PostgresDatabase,
): Promise<DataResult<Record<string, CurrentPrice>>> {
	const db = database ?? getPostgresDb();
	const batches = await mapBatches(canonicalIds(itemIds), async (batch) => {
		const read = async () => {
			const rows = await db
				.select()
				.from(itemPrices)
				.where(and(eq(itemPrices.mode, mode), inArray(itemPrices.itemId, batch)));
			const references = await readMarketReferences(
				db,
				mode,
				rows.map((row) => row.itemId),
			);
			return Object.fromEntries(
				rows.map((row) => {
					const points = readPoints(row.recentPoints);
					// Apply the age cutoff at the read boundary too. Otherwise a stalled
					// refresh leaves an old cached sample labeled stable indefinitely.
					const derived = deriveEffectivePrice(points, undefined, Date.now());
					const current: CurrentPrice = {
						avg24hPrice: asFinite(row.catalogAveragePrice ?? row.avg24hPrice),
						high24hPrice: asFinite(row.catalogHighPrice ?? row.high24hPrice),
						low24hPrice: asFinite(row.catalogLowPrice ?? row.low24hPrice),
						lastLowPrice: asFinite(row.lastLowPrice),
						lastOfferCount: row.latestOfferCount,
						changeLast48hPercent: asFinite(row.changeLast48hPercent),
						updatedAt: row.catalogReferenceUpdatedAt,
						sellFor: normalizeTraderSellOffers(row.traderSellOffers),
						fleaStability: "reference",
					};
					if (points.length > 0) {
						current.price = derived.effectivePrice;
						current.referencePrice = row.latestPrice;
						current.fleaStability = derived.stability;
						current.fleaPriceReasons = derived.reasons;
						current.fleaSampleCount = derived.sampleCount;
						current.lastLowPrice = row.latestPriceMin;
						current.lastOfferCount = row.latestOfferCount;
						current.updatedAt = row.latestPointAt;
					}
					const reference = references[row.itemId];
					if (reference) current.marketReference = reference;
					return [row.itemId, current];
				}),
			);
		};
		return database ? read() : boundedReadCache(["postgres-prices", "3", mode, JSON.stringify(batch)], read, 300);
	});
	const data = Object.assign({}, ...batches) as Record<string, CurrentPrice>;
	const updatedAt = Object.values(data).reduce((latest, price) => Math.max(latest, price.updatedAt ?? 0), 0);
	// Zero is the explicit unknown sentinel here. Do not fabricate a fresh time
	// when no catalog or flea observation has supplied one.
	return { data, updatedAt };
}

export async function getStoredPriceHistoryData(
	mode: TarkovDataMode,
	itemId: string,
	database: PostgresDatabase = getPostgresDb(),
): Promise<DataResult<PriceHistoryPoint[]>> {
	const [row] = await database
		.select({ recentPoints: itemPrices.recentPoints })
		.from(itemPrices)
		.where(and(eq(itemPrices.mode, mode), eq(itemPrices.itemId, itemId)))
		.limit(1);
	const data = readPoints(row?.recentPoints);
	return { data, updatedAt: data.at(-1)?.timestamp ?? 0 };
}

/** Every item's current trader purchase offers for a mode, omitting items without offers. */
export async function getAllTraderOffers(
	mode: TarkovDataMode,
	database: PostgresDatabase = getPostgresDb(),
): Promise<Record<string, TraderPurchaseOffer[]>> {
	const rows = await database
		.select({ itemId: itemPrices.itemId, offers: itemPrices.traderPurchaseOffers })
		.from(itemPrices)
		.where(eq(itemPrices.mode, mode));
	return Object.fromEntries(
		rows.flatMap((row) => {
			const offers = asOffers(row.offers);
			return offers.length ? [[row.itemId, offers]] : [];
		}),
	);
}

/** Current trader purchase offers for only the requested items, omitting items without offers. */
export async function getTraderOffersByIds(
	mode: TarkovDataMode,
	itemIds: readonly string[],
	database: PostgresDatabase = getPostgresDb(),
): Promise<Record<string, TraderPurchaseOffer[]>> {
	const ids = canonicalIds(itemIds);
	if (ids.length === 0) return {};
	const rows = await database
		.select({ itemId: itemPrices.itemId, offers: itemPrices.traderPurchaseOffers })
		.from(itemPrices)
		.where(and(eq(itemPrices.mode, mode), inArray(itemPrices.itemId, ids)));
	return Object.fromEntries(
		rows.flatMap((row) => {
			const offers = asOffers(row.offers);
			return offers.length ? [[row.itemId, offers]] : [];
		}),
	);
}
