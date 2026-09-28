import "server-only";

import { count, eq, sql } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import { getPostgresDb } from "@/server/postgres/connection";
import {
	barters,
	catalogStatus,
	crafts,
	itemDetails,
	itemModes,
	priceRefreshState,
	questModes,
	stationModes,
} from "@/server/postgres/schema";
import { DatabaseConfigurationError } from "./errors";

export async function getCatalogDashboard(mode: TarkovDataMode) {
	const db = getPostgresDb();
	const [status] = await db.select().from(catalogStatus).where(eq(catalogStatus.mode, mode)).limit(1);
	if (!status || status.contentVersion <= 0)
		throw new DatabaseConfigurationError(`No current catalog exists for ${mode}. Run db:update.`);
	const [items, stations, quests, craftRows, barterRows, detailRows] = await Promise.all([
		db.select({ count: count() }).from(itemModes).where(eq(itemModes.mode, mode)),
		db.select({ count: count() }).from(stationModes).where(eq(stationModes.mode, mode)),
		db.select({ count: count() }).from(questModes).where(eq(questModes.mode, mode)),
		db.select({ count: count() }).from(crafts).where(eq(crafts.mode, mode)),
		db.select({ count: count() }).from(barters).where(eq(barters.mode, mode)),
		db.select({ count: count() }).from(itemDetails).where(eq(itemDetails.mode, mode)),
	]);
	return {
		contentVersion: String(status.contentVersion),
		status: status.updatedAt ? "Ready" : "Checked",
		discoveryInitialized: status.discoveryInitialized,
		checkedAt: status.checkedAt,
		updatedAt: status.updatedAt,
		counts: {
			items: items[0]?.count ?? 0,
			stations: stations[0]?.count ?? 0,
			quests: quests[0]?.count ?? 0,
			crafts: craftRows[0]?.count ?? 0,
			barters: barterRows[0]?.count ?? 0,
			itemDetails: detailRows[0]?.count ?? 0,
		},
	};
}

export interface MarketWorkerRefresh {
	lastStartedAt: number | null;
	lastCompletedAt: number | null;
	leaseActive: boolean;
	summary: Record<string, unknown> | null;
}

export interface MarketAnalysisRunRow {
	runId: string;
	startedAt: number;
	durationMs: number;
	status: string;
	analyzedCount: number;
	unchangedCount: number;
	missingCount: number;
	trend: Record<string, number>;
	confidence: Record<string, number>;
}

export interface MarketMoverRow {
	itemId: string;
	name: string;
	calculatedAt: number;
	livePriceMin: number | null;
	marketValue: number | null;
	median7d: number | null;
	change24h: number | null;
	change7d: number | null;
	percentile30d: number | null;
	depthMedian24h: number | null;
	trend: string;
	confidence: string;
	traderValue: number | null;
	fleaNet: number | null;
}

export type MarketWorkerDashboard = {
	/** Server time the dashboard was read; relative ages are computed from it. */
	loadedAt: number;
	refresh: MarketWorkerRefresh | null;
	analytics:
		| { available: false; reason: string }
		| {
				available: true;
				observationCount: number;
				itemCount: number;
				runs: MarketAnalysisRunRow[];
				movers: MarketMoverRow[];
		  };
};

function numberOrNull(value: unknown): number | null {
	return value === null || value === undefined ? null : Number(value);
}

function undefinedTable(error: unknown): boolean {
	for (let current = error; current instanceof Error; current = current.cause)
		if ((current as { code?: unknown }).code === "42P01") return true;
	return false;
}

/** Development dashboard: latest price refresh (worker or cron) and market analytics for one mode. */
export async function getMarketWorkerDashboard(mode: TarkovDataMode): Promise<MarketWorkerDashboard> {
	const db = getPostgresDb();
	const loadedAt = Date.now();
	const [state] = await db.select().from(priceRefreshState).where(eq(priceRefreshState.mode, mode)).limit(1);
	const refresh: MarketWorkerRefresh | null = state
		? {
				lastStartedAt: state.lastStartedAt,
				lastCompletedAt: state.lastCompletedAt,
				leaseActive: state.leaseExpiresAt !== null && state.leaseExpiresAt > loadedAt,
				summary: (state.lastSummary as Record<string, unknown> | null) ?? null,
			}
		: null;
	try {
		const [totals, runs, movers] = await Promise.all([
			db.execute(sql`
				select count(*) as observations, count(distinct item_id) as items
				from item_market_observations where mode = ${mode}`),
			db.execute(sql`
				select run_id, started_at, completed_at, status, analyzed_count, unchanged_count, missing_count, summary
				from market_analysis_runs where mode = ${mode} order by started_at desc limit 6`),
			db.execute(sql`
				with latest as (
					select distinct on (item_id) item_id, calculated_at, live_price_min, market_value, median_7d,
						change_24h, change_7d, percentile_30d, depth_median_24h, trend, confidence, trader_value, flea_net
					from item_market_observations where mode = ${mode}
					order by item_id, calculated_at desc
				)
				select latest.*, items.name from latest join items on items.id = latest.item_id
				where latest.change_24h is not null and latest.confidence <> 'low'
				order by abs(latest.change_24h) desc limit 12`),
		]);
		const total = totals.rows[0] ?? {};
		return {
			loadedAt,
			refresh,
			analytics: {
				available: true,
				observationCount: Number(total.observations ?? 0),
				itemCount: Number(total.items ?? 0),
				runs: runs.rows.map((row) => {
					const summary = (row.summary ?? {}) as {
						trend?: Record<string, number>;
						confidence?: Record<string, number>;
					};
					return {
						runId: String(row.run_id),
						startedAt: Number(row.started_at),
						durationMs: Number(row.completed_at) - Number(row.started_at),
						status: String(row.status),
						analyzedCount: Number(row.analyzed_count),
						unchangedCount: Number(row.unchanged_count),
						missingCount: Number(row.missing_count),
						trend: summary.trend ?? {},
						confidence: summary.confidence ?? {},
					};
				}),
				movers: movers.rows.map((row) => ({
					itemId: String(row.item_id),
					name: String(row.name),
					calculatedAt: Number(row.calculated_at),
					livePriceMin: numberOrNull(row.live_price_min),
					marketValue: numberOrNull(row.market_value),
					median7d: numberOrNull(row.median_7d),
					change24h: numberOrNull(row.change_24h),
					change7d: numberOrNull(row.change_7d),
					percentile30d: numberOrNull(row.percentile_30d),
					depthMedian24h: numberOrNull(row.depth_median_24h),
					trend: String(row.trend),
					confidence: String(row.confidence),
					traderValue: numberOrNull(row.trader_value),
					fleaNet: numberOrNull(row.flea_net),
				})),
			},
		};
	} catch (error) {
		if (undefinedTable(error))
			return {
				loadedAt,
				refresh,
				analytics: { available: false, reason: "Analytics tables are missing. Run npm run db:migrate (0002)." },
			};
		throw error;
	}
}
