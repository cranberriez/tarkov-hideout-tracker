import { sql } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type { MarketOverviewItem, MarketPageData } from "@/types/contracts";
import { getPostgresDb, type PostgresDatabase } from "../postgres/connection";
import { DatabaseDataIntegrityError } from "./errors";
import { isMissingAnalyticsSchema, toItemMarketAnalytics } from "./market-analytics";
import { readPoints } from "./price-data";

/** Stored recent points span about a day; older points belong to a stalled refresh. */
const SPARKLINE_WINDOW_MS = 36 * 60 * 60 * 1000;

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value ? value : null;
}

function sparklineOf(value: unknown, now: number): MarketOverviewItem["sparkline"] {
	const points = readPoints(value).filter((point) => point.timestamp >= now - SPARKLINE_WINDOW_MS);
	if (points.length < 2) return null;
	return {
		from: points[0].timestamp,
		to: points[points.length - 1].timestamp,
		prices: points.map((point) => point.priceMin),
	};
}

function toMarketOverviewItem(row: Record<string, unknown>, now: number): MarketOverviewItem {
	const analytics = toItemMarketAnalytics(row);
	const name = stringOrNull(row.name);
	if (name === null) throw new DatabaseDataIntegrityError(`Market item ${analytics.itemId} has no name`);
	const prices = [analytics.marketValue, analytics.currentLevel, analytics.rangeLow7d, analytics.rangeHigh7d];
	if (
		prices.some((price) => price !== null && price < 0) ||
		(analytics.percentile30d !== null && (analytics.percentile30d < 0 || analytics.percentile30d > 1)) ||
		(analytics.volatility7d !== null && analytics.volatility7d < 0) ||
		(analytics.rangeLow7d !== null && analytics.rangeHigh7d !== null && analytics.rangeLow7d > analytics.rangeHigh7d)
	)
		throw new DatabaseDataIntegrityError(`Market analytics for ${analytics.itemId} are out of range`);
	return {
		id: analytics.itemId,
		name,
		shortName: stringOrNull(row.short_name),
		category: stringOrNull(row.category_name),
		calculatedAt: analytics.calculatedAt,
		confidence: analytics.confidence,
		trend: analytics.trend,
		marketValue: analytics.marketValue,
		currentLevel: analytics.currentLevel,
		liveOfferCount: analytics.liveOfferCount,
		median7d: analytics.median7d,
		median30d: analytics.median30d,
		rangeLow7d: analytics.rangeLow7d,
		rangeHigh7d: analytics.rangeHigh7d,
		change24h: analytics.change24h,
		change7d: analytics.change7d,
		change24hRub: analytics.change24hRub,
		change7dRub: analytics.change7dRub,
		move12h: analytics.move12h,
		percentile30d: analytics.percentile30d,
		volatility7d: analytics.volatility7d,
		depthMedian24h: analytics.depthMedian24h,
		shock: analytics.shock && {
			phase: analytics.shock.phase,
			baseline: analytics.shock.baseline,
			extreme: analytics.shock.extreme,
			retracement: analytics.shock.retracement,
		},
		traderValue: analytics.traderValue,
		traderId: analytics.traderId,
		fleaFee: analytics.fleaFee,
		fleaNet: analytics.fleaNet,
		sparkline: sparklineOf(row.recent_points, now),
	};
}

/**
 * Latest observation for every flea-sellable item in one mode, for the market page. A per-item
 * lateral read keeps this an index lookup per catalog item as the append-only history grows.
 */
export async function getMarketPageData(
	mode: TarkovDataMode,
	database: PostgresDatabase = getPostgresDb(),
): Promise<MarketPageData> {
	const now = Date.now();
	try {
		const [observations, runs] = await Promise.all([
			database.execute(sql`
				select o.*, items.name, items.short_name, item_modes.category->>'name' as category_name,
					item_prices.recent_points
				from item_modes
				join items on items.id = item_modes.item_id
				left join item_prices on item_prices.item_id = item_modes.item_id and item_prices.mode = item_modes.mode
				cross join lateral (
					select * from item_market_observations
					where mode = item_modes.mode and item_id = item_modes.item_id
					order by calculated_at desc
					limit 1
				) o
				where item_modes.mode = ${mode} and item_modes.on_flea_market is true`),
			database.execute(sql`
				select started_at, completed_at, status from market_analysis_runs
				where mode = ${mode} order by completed_at desc limit 1`),
		]);
		const items: MarketOverviewItem[] = [];
		let invalidCount = 0;
		for (const row of observations.rows) {
			try {
				items.push(toMarketOverviewItem(row, now));
			} catch (error) {
				if (!(error instanceof DatabaseDataIntegrityError)) throw error;
				invalidCount += 1;
			}
		}
		const run = runs.rows[0];
		return {
			mode,
			latestRun: run
				? { startedAt: Number(run.started_at), completedAt: Number(run.completed_at), status: String(run.status) }
				: null,
			items,
			invalidCount,
			error: null,
		};
	} catch (error) {
		if (!isMissingAnalyticsSchema(error)) throw error;
		return {
			mode,
			latestRun: null,
			items: [],
			invalidCount: 0,
			error: "Market analytics have not been set up for this server.",
		};
	}
}
