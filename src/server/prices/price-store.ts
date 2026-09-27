import { and, eq, inArray, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import type { TarkovDataMode } from "@/types/common";
import type { PriceHistoryPoint, CurrentPrice } from "@/types/prices";
import type { TraderPurchaseOffer } from "@/types/items";
import { getPostgresDb, type PostgresDatabase } from "../postgres/connection";
import { itemModes, itemPrices, itemPriceSync, priceRefreshState } from "../postgres/schema";
import type {
	CatalogPriceRecord,
	PriceRefreshOutcome,
	PriceRefreshStore,
	PriceRefreshSummary,
	PriceSyncState,
} from "./types";

const CATALOG_WRITE_CHUNK_SIZE = 250;
type StoredPoint = PriceHistoryPoint & { observedAt?: number };

function integer(value: number): number {
	return Math.round(value);
}

function validNonnegative(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validCatalogRecord(record: CatalogPriceRecord): boolean {
	const price = record.marketPrice;
	const scalarValues = [
		price?.avg24hPrice,
		price?.high24hPrice,
		price?.low24hPrice,
		price?.lastLowPrice,
		price?.lastOfferCount,
		price?.updatedAt,
	];
	if (
		!record.itemId ||
		(record.traderPurchaseOffers != null && !Array.isArray(record.traderPurchaseOffers)) ||
		(price?.sellFor != null && !Array.isArray(price.sellFor)) ||
		scalarValues.some((value) => value != null && !validNonnegative(value)) ||
		(price?.changeLast48hPercent != null && !Number.isFinite(price.changeLast48hPercent))
	)
		return false;
	return (
		(record.traderPurchaseOffers ?? []).every(
			(offer) =>
				Boolean(offer.traderId && offer.currency && offer.currencyItemId) &&
				validNonnegative(offer.price) &&
				validNonnegative(offer.priceRUB) &&
				Number.isFinite(offer.minTraderLevel) &&
				offer.minTraderLevel >= 0 &&
				(offer.restockAmount == null || validNonnegative(offer.restockAmount)) &&
				(offer.buyLimit == null || validNonnegative(offer.buyLimit)),
		) &&
		(price.sellFor ?? []).every(
			(offer) =>
				Boolean(offer.vendor?.id && offer.vendor?.name && offer.currency) &&
				validNonnegative(offer.priceRUB) &&
				(offer.price == null || validNonnegative(offer.price)),
		)
	);
}

function storedPoints(value: unknown): StoredPoint[] {
	if (!Array.isArray(value) || value.length > 10) return [];
	const points: StoredPoint[] = [];
	for (const candidate of value) {
		if (typeof candidate !== "object" || candidate === null) return [];
		const point = candidate as PriceHistoryPoint;
		if (
			!Number.isSafeInteger(point.timestamp) ||
			point.timestamp <= 0 ||
			!Number.isSafeInteger(point.price) ||
			point.price < 0 ||
			!Number.isSafeInteger(point.priceMin) ||
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
			...("observedAt" in candidate && Number.isSafeInteger((candidate as StoredPoint).observedAt)
				? { observedAt: (candidate as StoredPoint).observedAt }
				: {}),
		});
	}
	return points;
}

function sameJson(left: unknown, right: unknown): boolean {
	return isDeepStrictEqual(left, right);
}

function excluded(column: string) {
	return sql.raw(`excluded.${column}`);
}

/** PostgreSQL store for the bounded current-price working window and per-mode lease. */
export class PostgresPriceRefreshStore implements PriceRefreshStore {
	constructor(private readonly database: PostgresDatabase = getPostgresDb()) {}

	async getEligibleItemIds(mode: TarkovDataMode): Promise<string[]> {
		const rows = await this.database
			.select({ itemId: itemModes.itemId })
			.from(itemModes)
			.leftJoin(itemPrices, and(eq(itemPrices.itemId, itemModes.itemId), eq(itemPrices.mode, itemModes.mode)))
			.where(
				and(
					eq(itemModes.mode, mode),
					sql`(${itemModes.onFleaMarket} is true or ${itemPrices.catalogAveragePrice} is not null or ${itemPrices.catalogLowPrice} is not null)`,
				),
			)
			.orderBy(itemModes.itemId);
		return rows.map((row) => row.itemId);
	}

	async getSyncStates(mode: TarkovDataMode): Promise<Record<string, PriceSyncState>> {
		const rows = await this.database
			.select({ itemId: itemPriceSync.itemId, etag: itemPriceSync.etag, recentPoints: itemPrices.recentPoints })
			.from(itemPriceSync)
			.leftJoin(itemPrices, and(eq(itemPrices.itemId, itemPriceSync.itemId), eq(itemPrices.mode, itemPriceSync.mode)))
			.where(eq(itemPriceSync.mode, mode));
		return Object.fromEntries(
			rows.map((row) => {
				const points = storedPoints(row.recentPoints);
				return [row.itemId, { etag: row.etag, latestPointTimestamp: points.at(-1)?.timestamp ?? null }];
			}),
		);
	}

	async tryAcquireLock(mode: TarkovDataMode, runId: string, lockedUntil: number, now: number): Promise<boolean> {
		const result = await this.database.execute(sql`
		insert into price_refresh_state (mode, lease_owner, lease_expires_at, last_started_at)
		values (${mode}, ${runId}, ${lockedUntil}, ${now})
		on conflict (mode) do update set
			lease_owner = excluded.lease_owner,
			lease_expires_at = excluded.lease_expires_at,
			last_started_at = excluded.last_started_at
		where price_refresh_state.lease_expires_at is null
			or price_refresh_state.lease_expires_at <= ${now}
		returning mode
	`);
		return (result.rowCount ?? 0) > 0;
	}

	async renewLock(mode: TarkovDataMode, runId: string, lockedUntil: number, now: number): Promise<boolean> {
		const result = await this.database
			.update(priceRefreshState)
			.set({ leaseExpiresAt: lockedUntil })
			.where(
				and(
					eq(priceRefreshState.mode, mode),
					eq(priceRefreshState.leaseOwner, runId),
					sql`${priceRefreshState.leaseExpiresAt} > ${now}`,
				),
			)
			.returning({ mode: priceRefreshState.mode });
		return result.length > 0;
	}

	async releaseLock(mode: TarkovDataMode, runId: string): Promise<void> {
		await this.database
			.update(priceRefreshState)
			.set({ leaseOwner: null, leaseExpiresAt: null })
			.where(and(eq(priceRefreshState.mode, mode), eq(priceRefreshState.leaseOwner, runId)));
	}

	async startRun(runId: string, mode: TarkovDataMode, startedAt: number): Promise<void> {
		const result = await this.database
			.update(priceRefreshState)
			.set({ lastStartedAt: startedAt })
			.where(
				and(
					eq(priceRefreshState.mode, mode),
					eq(priceRefreshState.leaseOwner, runId),
					sql`${priceRefreshState.leaseExpiresAt} > ${startedAt}`,
				),
			)
			.returning({ mode: priceRefreshState.mode });
		if (!result.length) throw new Error(`Price refresh lease for ${mode} is no longer owned by ${runId}`);
	}

	private async assertLease(
		tx: Parameters<Parameters<PostgresDatabase["transaction"]>[0]>[0],
		mode: TarkovDataMode,
		runId: string,
	): Promise<void> {
		const result = await tx.execute(sql`
		select mode from price_refresh_state
		where mode = ${mode} and lease_owner = ${runId} and lease_expires_at > ${Date.now()}
		for update
	`);
		if (result.rowCount !== 1) throw new Error(`Price refresh lease for ${mode} is no longer owned by ${runId}`);
	}

	async writeCatalogPrices(mode: TarkovDataMode, runId: string, records: CatalogPriceRecord[]): Promise<void> {
		if (!records.length || records.some((record) => !validCatalogRecord(record))) {
			throw new Error(`Catalog price input for ${mode} is empty or malformed; existing values were preserved`);
		}
		const seen = new Set<string>();
		for (const record of records) {
			if (seen.has(record.itemId))
				throw new Error(`Catalog price input for ${mode} contains duplicate item ${record.itemId}`);
			seen.add(record.itemId);
		}
		for (let offset = 0; offset < records.length; offset += CATALOG_WRITE_CHUNK_SIZE) {
			const chunk = records.slice(offset, offset + CATALOG_WRITE_CHUNK_SIZE);
			const renewalTime = Date.now();
			if (!(await this.renewLock(mode, runId, renewalTime + 30 * 60 * 1000, renewalTime))) {
				throw new Error(`Price refresh lease for ${mode} expired before catalog chunk write`);
			}
			await this.database.transaction(async (tx) => {
				await this.assertLease(tx, mode, runId);
				const ids = chunk.map((record) => record.itemId);
				const memberships = await tx
					.select({ itemId: itemModes.itemId })
					.from(itemModes)
					.where(and(eq(itemModes.mode, mode), inArray(itemModes.itemId, ids)))
					.for("key share");
				const present = new Set(memberships.map((row) => row.itemId));
				const existingRows = await tx
					.select()
					.from(itemPrices)
					.where(and(eq(itemPrices.mode, mode), inArray(itemPrices.itemId, ids)));
				const existing = new Map(existingRows.map((row) => [row.itemId, row]));
				const writes = chunk.flatMap((record) => {
					if (!present.has(record.itemId)) {
						console.warn(`Skipped catalog price for missing item mode ${mode}/${record.itemId}`);
						return [];
					}
					const previous = existing.get(record.itemId);
					const incomingMarket = record.marketPrice;
					const previousTimestamp = previous?.catalogReferenceUpdatedAt ?? null;
					const incomingTimestamp = incomingMarket.updatedAt ?? null;
					const olderObservation =
						incomingTimestamp !== null && previousTimestamp !== null && incomingTimestamp < previousTimestamp;
					const market = olderObservation ? {} : incomingMarket;
					const purchaseObservation = olderObservation ? undefined : record.traderPurchaseOffers;
					const priorNumber = (value: string | number | null | undefined): number | null =>
						value == null ? null : Number(value);
					const observed = (value: number | null | undefined, prior: number | null): number | null =>
						value == null ? prior : value;
					const average = observed(
						market.avg24hPrice,
						priorNumber(previous?.catalogAveragePrice ?? previous?.avg24hPrice),
					);
					const high = observed(market.high24hPrice, priorNumber(previous?.catalogHighPrice ?? previous?.high24hPrice));
					const low = observed(market.low24hPrice, priorNumber(previous?.catalogLowPrice ?? previous?.low24hPrice));
					const lastLow = observed(market.lastLowPrice, previous?.lastLowPrice ?? null);
					const change48h = observed(market.changeLast48hPercent, priorNumber(previous?.changeLast48hPercent));
					const hasPriceObservation =
						market.avg24hPrice != null ||
						market.high24hPrice != null ||
						market.low24hPrice != null ||
						market.lastLowPrice != null ||
						market.lastOfferCount != null ||
						market.changeLast48hPercent != null;
					const referenceUpdatedAt = hasPriceObservation
						? observed(market.updatedAt, previousTimestamp)
						: previousTimestamp;
					const purchaseOffers = purchaseObservation ?? previous?.traderPurchaseOffers ?? [];
					const sellOffers = market.sellFor ?? previous?.traderSellOffers ?? [];
					const set = {
						avg24hPrice: average == null ? null : String(average),
						high24hPrice: high == null ? null : integer(high),
						low24hPrice: low == null ? null : integer(low),
						lastLowPrice: lastLow == null ? null : integer(lastLow),
						changeLast48hPercent: change48h == null ? null : String(change48h),
						catalogAveragePrice: average == null ? null : String(average),
						catalogHighPrice: high == null ? null : String(integer(high)),
						catalogLowPrice: low == null ? null : String(integer(low)),
						catalogReferenceUpdatedAt: referenceUpdatedAt,
						traderPurchaseOffers: purchaseOffers,
						traderSellOffers: sellOffers,
					};
					if (
						previous &&
						Object.keys(set).every((key) =>
							sameJson(previous[key as keyof typeof previous], set[key as keyof typeof set]),
						)
					)
						return [];
					return [
						{
							itemId: record.itemId,
							mode,
							...set,
							lastChangedAt: Math.max(Date.now(), (previous?.lastChangedAt ?? 0) + 1),
						},
					];
				});
				if (writes.length) {
					await tx
						.insert(itemPrices)
						.values(writes)
						.onConflictDoUpdate({
							target: [itemPrices.itemId, itemPrices.mode],
							set: {
								avg24hPrice: excluded("avg_24h_price"),
								high24hPrice: excluded("high_24h_price"),
								low24hPrice: excluded("low_24h_price"),
								lastLowPrice: excluded("last_low_price"),
								changeLast48hPercent: excluded("change_last_48h_percent"),
								catalogAveragePrice: excluded("catalog_average_price"),
								catalogHighPrice: excluded("catalog_high_price"),
								catalogLowPrice: excluded("catalog_low_price"),
								catalogReferenceUpdatedAt: excluded("catalog_reference_updated_at"),
								traderPurchaseOffers: excluded("trader_purchase_offers"),
								traderSellOffers: excluded("trader_sell_offers"),
								lastChangedAt: excluded("last_changed_at"),
							},
						});
				}
			});
		}
	}

	async writeOutcomes(mode: TarkovDataMode, runId: string, outcomes: PriceRefreshOutcome[]): Promise<void> {
		if (!outcomes.length) return;
		if (new Set(outcomes.map((outcome) => outcome.itemId)).size !== outcomes.length) {
			throw new Error(`Price outcome chunk for ${mode} contains duplicate item IDs`);
		}
		await this.database.transaction(async (tx) => {
			await this.assertLease(tx, mode, runId);
			const ids = outcomes.map((outcome) => outcome.itemId);
			const memberships = await tx
				.select({ itemId: itemModes.itemId })
				.from(itemModes)
				.where(and(eq(itemModes.mode, mode), inArray(itemModes.itemId, ids)))
				.for("key share");
			const present = new Set(memberships.map((row) => row.itemId));
			const currentRows = await tx
				.select()
				.from(itemPrices)
				.where(and(eq(itemPrices.mode, mode), inArray(itemPrices.itemId, ids)));
			const currentById = new Map(currentRows.map((row) => [row.itemId, row]));
			const syncRows = await tx
				.select()
				.from(itemPriceSync)
				.where(and(eq(itemPriceSync.mode, mode), inArray(itemPriceSync.itemId, ids)));
			const syncById = new Map(syncRows.map((row) => [row.itemId, row]));
			const priceWrites: Array<typeof itemPrices.$inferInsert> = [];
			const syncWrites: Array<typeof itemPriceSync.$inferInsert> = [];
			for (const outcome of outcomes) {
				if (!present.has(outcome.itemId)) {
					console.warn(`Skipped flea price for missing item mode ${mode}/${outcome.itemId}`);
					continue;
				}
				const current = currentById.get(outcome.itemId);
				const sync = syncById.get(outcome.itemId);
				if (outcome.status === "updated") {
					const points = storedPoints(outcome.points);
					if (!points.length || points.length !== outcome.points.length || points.length > 10)
						throw new Error(`Invalid bounded history for ${mode}/${outcome.itemId}`);
					if (
						!Number.isInteger(outcome.sampleCount) ||
						outcome.sampleCount < 0 ||
						!Number.isInteger(outcome.totalOfferCount) ||
						outcome.totalOfferCount < 0 ||
						(outcome.effectivePrice !== null &&
							(!Number.isSafeInteger(outcome.effectivePrice) || outcome.effectivePrice < 0))
					) {
						throw new Error(`Invalid derived price values for ${mode}/${outcome.itemId}`);
					}
					if (current?.latestPointAt != null && points.at(-1)!.timestamp < current.latestPointAt) {
						throw new Error(`Price endpoint returned older observations for ${mode}/${outcome.itemId}`);
					}
					const latest = points.at(-1)!;
					const previousPoints = storedPoints(current?.recentPoints);
					const previousByTimestamp = new Map(previousPoints.map((point) => [point.timestamp, point]));
					const retainedPoints = points.map((point) => {
						const previous = previousByTimestamp.get(point.timestamp);
						const unchanged =
							previous &&
							previous.price === point.price &&
							previous.priceMin === point.priceMin &&
							previous.offerCount === point.offerCount;
						return { ...point, observedAt: unchanged ? previous.observedAt : outcome.checkedAt };
					});
					const update: typeof itemPrices.$inferInsert = {
						itemId: outcome.itemId,
						mode,
						price: outcome.effectivePrice === null ? null : integer(outcome.effectivePrice),
						referencePrice: integer(latest.price),
						latestPrice: integer(latest.price),
						latestPriceMin: integer(latest.priceMin),
						latestOfferCount: latest.offerCount,
						latestPointAt: latest.timestamp,
						sampleCount: outcome.sampleCount,
						totalOfferCount: outcome.totalOfferCount,
						lastCheckedAt: outcome.checkedAt,
						lastChangedAt: Math.max(outcome.checkedAt, (current?.lastChangedAt ?? 0) + 1),
						recentPoints: retainedPoints,
						...(!current ? { traderPurchaseOffers: [], traderSellOffers: [] } : {}),
					};
					const unchanged =
						current &&
						current.price === update.price &&
						current.referencePrice === update.referencePrice &&
						current.latestPrice === update.latestPrice &&
						current.latestPriceMin === update.latestPriceMin &&
						current.latestOfferCount === update.latestOfferCount &&
						current.latestPointAt === update.latestPointAt &&
						current.sampleCount === update.sampleCount &&
						current.totalOfferCount === update.totalOfferCount &&
						current.lastCheckedAt === update.lastCheckedAt &&
						current.lastChangedAt === update.lastChangedAt &&
						sameJson(current.recentPoints, retainedPoints);
					if (!unchanged) priceWrites.push(update);
				}
				const nextSync =
					outcome.status === "failed"
						? {
								itemId: outcome.itemId,
								mode,
								etag: sync?.etag ?? null,
								lastCheckedAt: outcome.checkedAt,
								consecutiveFailures: (sync?.consecutiveFailures ?? 0) + 1,
								lastError: outcome.error.slice(0, 500),
							}
						: {
								itemId: outcome.itemId,
								mode,
								etag: outcome.etag ?? sync?.etag ?? null,
								lastCheckedAt: outcome.checkedAt,
								consecutiveFailures: 0,
								lastError: null,
							};
				const nextSyncUnchanged =
					sync &&
					sync.etag === nextSync.etag &&
					sync.lastCheckedAt === nextSync.lastCheckedAt &&
					sync.consecutiveFailures === nextSync.consecutiveFailures &&
					sync.lastError === nextSync.lastError;
				if (!nextSyncUnchanged) syncWrites.push(nextSync);
			}
			if (priceWrites.length) {
				await tx
					.insert(itemPrices)
					.values(priceWrites)
					.onConflictDoUpdate({
						target: [itemPrices.itemId, itemPrices.mode],
						set: {
							price: excluded("price"),
							referencePrice: excluded("reference_price"),
							latestPrice: excluded("latest_price"),
							latestPriceMin: excluded("latest_price_min"),
							latestOfferCount: excluded("latest_offer_count"),
							latestPointAt: excluded("latest_point_at"),
							sampleCount: excluded("sample_count"),
							totalOfferCount: excluded("total_offer_count"),
							lastCheckedAt: excluded("last_checked_at"),
							lastChangedAt: excluded("last_changed_at"),
							recentPoints: excluded("recent_points"),
						},
					});
			}
			if (syncWrites.length) {
				await tx
					.insert(itemPriceSync)
					.values(syncWrites)
					.onConflictDoUpdate({
						target: [itemPriceSync.itemId, itemPriceSync.mode],
						set: {
							etag: excluded("etag"),
							lastCheckedAt: excluded("last_checked_at"),
							consecutiveFailures: excluded("consecutive_failures"),
							lastError: excluded("last_error"),
						},
					});
			}
		});
	}

	async completeRun(runId: string, summary: PriceRefreshSummary, completedAt: number): Promise<void> {
		const result = await this.database
			.update(priceRefreshState)
			.set({ lastCompletedAt: completedAt, lastSummary: summary })
			.where(
				and(
					eq(priceRefreshState.mode, summary.mode),
					eq(priceRefreshState.leaseOwner, runId),
					sql`${priceRefreshState.leaseExpiresAt} > ${completedAt}`,
				),
			)
			.returning({ mode: priceRefreshState.mode });
		if (!result.length) throw new Error(`Price refresh lease for ${summary.mode} is no longer owned by ${runId}`);
	}
}

export interface StoredPricePointData {
	points: PriceHistoryPoint[];
	updatedAt: number | null;
}

export async function getStoredPricePoints(
	database: PostgresDatabase,
	mode: TarkovDataMode,
	itemId: string,
): Promise<StoredPricePointData> {
	const [row] = await database
		.select({ recentPoints: itemPrices.recentPoints })
		.from(itemPrices)
		.where(and(eq(itemPrices.mode, mode), eq(itemPrices.itemId, itemId)))
		.limit(1);
	const points = storedPoints(row?.recentPoints);
	return {
		points: points.map(({ timestamp, price, priceMin, offerCount }) => ({ timestamp, price, priceMin, offerCount })),
		updatedAt: points.at(-1)?.timestamp ?? null,
	};
}

export function toCatalogPriceRecord(item: {
	id: string;
	marketPrice?: CurrentPrice | null;
	buyFromTrader?: TraderPurchaseOffer[];
}): CatalogPriceRecord {
	return {
		itemId: item.id,
		marketPrice: item.marketPrice ?? {},
		...(item.buyFromTrader === undefined ? {} : { traderPurchaseOffers: item.buyFromTrader }),
	};
}
