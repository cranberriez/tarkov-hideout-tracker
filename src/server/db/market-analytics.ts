import { sql } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type { ItemMarketAnalytics } from "@/types/contracts";
import type { MarketReference } from "@/types/prices";
import { getPostgresDb, type PostgresDatabase } from "../postgres/connection";
import { DatabaseDataIntegrityError } from "./errors";

// The market-analyzer worker owns these append-only tables (migrations 0002/0003); they are
// read with SQL because they are not part of the Drizzle catalog schema.

const CONFIDENCES = ["high", "medium", "low"] as const;
const TRENDS = ["rising", "falling", "stable", "unknown"] as const;
const SHOCK_PHASES = ["holding", "retracing", "settled", "reverted"] as const;

/** undefined_table / undefined_column: the analytics migrations have not been applied. */
function isMissingAnalyticsSchema(error: unknown): boolean {
	for (let current = error; current instanceof Error; current = current.cause) {
		const code = (current as { code?: unknown }).code;
		if (code === "42P01" || code === "42703") return true;
	}
	return false;
}

function finiteOrNull(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? number : null;
}

function positiveOrNull(value: unknown): number | null {
	const number = finiteOrNull(value);
	return number !== null && number > 0 ? number : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
	return allowed.includes(value as T) ? (value as T) : null;
}

/**
 * Latest medium/high-confidence reference levels for known item IDs. This optionally enriches
 * current prices: a missing analytics schema or failed read yields no references, never a
 * failed or altered price.
 */
export async function readMarketReferences(
	db: PostgresDatabase,
	mode: TarkovDataMode,
	itemIds: readonly string[],
): Promise<Record<string, MarketReference>> {
	if (!itemIds.length) return {};
	try {
		const result = await db.execute(sql`
			select distinct on (item_id) item_id, calculated_at, confidence, median_7d, range_low_7d, range_high_7d
			from item_market_observations
			where mode = ${mode} and item_id in (${sql.join(
				itemIds.map((id) => sql`${id}`),
				sql`, `,
			)})
			order by item_id, calculated_at desc`);
		const references: Record<string, MarketReference> = {};
		for (const row of result.rows) {
			if (row.confidence !== "high" && row.confidence !== "medium") continue;
			const typical = positiveOrNull(row.median_7d);
			const rangeLow = positiveOrNull(row.range_low_7d);
			const rangeHigh = positiveOrNull(row.range_high_7d);
			const calculatedAt = positiveOrNull(row.calculated_at);
			if (typical === null || rangeLow === null || rangeHigh === null || calculatedAt === null) continue;
			if (rangeLow > rangeHigh) continue;
			references[String(row.item_id)] = { typical, rangeLow, rangeHigh, calculatedAt };
		}
		return references;
	} catch (error) {
		if (!isMissingAnalyticsSchema(error)) console.warn(`Market references could not be read for ${mode}`, error);
		return {};
	}
}

function toItemMarketAnalytics(row: Record<string, unknown>): ItemMarketAnalytics {
	const calculatedAt = positiveOrNull(row.calculated_at);
	const sourceUpdatedAt = positiveOrNull(row.source_updated_at);
	const confidence = oneOf(row.confidence, CONFIDENCES);
	const trend = oneOf(row.trend, TRENDS);
	if (calculatedAt === null || sourceUpdatedAt === null || confidence === null || trend === null)
		throw new DatabaseDataIntegrityError(`Market analytics row for ${String(row.item_id)} is malformed`);
	const shockPhase = oneOf(row.shock_phase, SHOCK_PHASES);
	return {
		itemId: String(row.item_id),
		calculatedAt,
		sourceUpdatedAt,
		confidence,
		confidenceReasons: Array.isArray(row.confidence_reasons)
			? row.confidence_reasons.filter((reason): reason is string => typeof reason === "string")
			: [],
		marketValue: finiteOrNull(row.market_value),
		currentLevel: finiteOrNull(row.current_level),
		livePriceMin: finiteOrNull(row.live_price_min),
		liveOfferCount: finiteOrNull(row.live_offer_count),
		median24h: finiteOrNull(row.median_24h),
		median7d: finiteOrNull(row.median_7d),
		median30d: finiteOrNull(row.median_30d),
		rangeLow7d: finiteOrNull(row.range_low_7d),
		rangeHigh7d: finiteOrNull(row.range_high_7d),
		change6h: finiteOrNull(row.change_6h),
		change24h: finiteOrNull(row.change_24h),
		change7d: finiteOrNull(row.change_7d),
		change24hRub: finiteOrNull(row.change_24h_rub),
		change7dRub: finiteOrNull(row.change_7d_rub),
		move12h: finiteOrNull(row.move_12h),
		percentile30d: finiteOrNull(row.percentile_30d),
		volatility7d: finiteOrNull(row.volatility_7d),
		trend,
		persistenceHours: finiteOrNull(row.persistence_hours),
		depthMedian24h: finiteOrNull(row.depth_median_24h),
		coverage: {
			day: finiteOrNull(row.coverage_24h) ?? 0,
			week: finiteOrNull(row.coverage_7d) ?? 0,
			month: finiteOrNull(row.coverage_30d) ?? 0,
		},
		shock: shockPhase
			? {
					phase: shockPhase,
					baseline: finiteOrNull(row.shock_baseline),
					extreme: finiteOrNull(row.shock_extreme),
					at: finiteOrNull(row.shock_at),
					retracement: finiteOrNull(row.retracement),
				}
			: null,
		basePrice: finiteOrNull(row.base_price),
		traderValue: finiteOrNull(row.trader_value),
		traderId: typeof row.trader_id === "string" ? row.trader_id : null,
		fleaFee: finiteOrNull(row.flea_fee),
		fleaNet: finiteOrNull(row.flea_net),
		traderBreakEven: finiteOrNull(row.trader_break_even),
		practicalBreakEven: finiteOrNull(row.practical_break_even),
		maxNetPrice: finiteOrNull(row.max_net_price),
		maxNet: finiteOrNull(row.max_net),
	};
}

/** One item's latest observation, or null when the analyzer has not covered it in this mode. */
export async function getItemMarketAnalytics(
	mode: TarkovDataMode,
	itemId: string,
	database: PostgresDatabase = getPostgresDb(),
): Promise<ItemMarketAnalytics | null> {
	const result = await database.execute(sql`
		select * from item_market_observations
		where mode = ${mode} and item_id = ${itemId}
		order by calculated_at desc
		limit 1`);
	const row = result.rows[0];
	return row ? toItemMarketAnalytics(row) : null;
}
