import type { Pool } from "pg";
import type { TarkovDataMode } from "../../src/types/common";
import type { VendorPrice } from "../../src/types/prices";
import type { AnalysisBaseline, AnalysisRun } from "./analysis";
import type { MarketObservation } from "./analytics/observation";

const INSERT_CHUNK_SIZE = 500;

const OBSERVATION_COLUMNS: readonly [name: string, type: string][] = [
	["mode", "text"],
	["item_id", "text"],
	["calculated_at", "bigint"],
	["run_id", "text"],
	["source_updated_at", "bigint"],
	["live_price", "integer"],
	["live_price_min", "integer"],
	["live_offer_count", "integer"],
	["market_value", "integer"],
	["stability", "text"],
	["median_24h", "integer"],
	["median_7d", "integer"],
	["median_30d", "integer"],
	["range_low_7d", "integer"],
	["range_high_7d", "integer"],
	["change_6h", "real"],
	["change_24h", "real"],
	["change_7d", "real"],
	["percentile_30d", "real"],
	["volatility_7d", "real"],
	["trend", "text"],
	["persistence_hours", "real"],
	["depth_median_24h", "real"],
	["confidence", "text"],
	["base_price", "integer"],
	["trader_value", "integer"],
	["flea_net", "integer"],
	["trader_break_even", "integer"],
	["practical_break_even", "integer"],
	["max_net_price", "integer"],
	["confidence_reasons", "text[]"],
	["stability_reasons", "text[]"],
	["coverage_24h", "real"],
	["coverage_7d", "real"],
	["coverage_30d", "real"],
	["regime_points", "smallint"],
	["trader_id", "text"],
	["flea_fee", "integer"],
	["max_net", "integer"],
];
const COLUMN_NAMES = OBSERVATION_COLUMNS.map(([name]) => name).join(", ");
const RECORD_TYPE = OBSERVATION_COLUMNS.map(([name, type]) => `${name} ${type}`).join(", ");

function observationRecord(mode: TarkovDataMode, runId: string, observation: MarketObservation) {
	return {
		mode,
		item_id: observation.itemId,
		calculated_at: observation.calculatedAt,
		run_id: runId,
		source_updated_at: observation.sourceUpdatedAt,
		live_price: observation.livePrice,
		live_price_min: observation.livePriceMin,
		live_offer_count: observation.liveOfferCount,
		market_value: observation.marketValue,
		stability: observation.stability,
		median_24h: observation.median24h,
		median_7d: observation.median7d,
		median_30d: observation.median30d,
		range_low_7d: observation.rangeLow7d,
		range_high_7d: observation.rangeHigh7d,
		change_6h: observation.change6h,
		change_24h: observation.change24h,
		change_7d: observation.change7d,
		percentile_30d: observation.percentile30d,
		volatility_7d: observation.volatility7d,
		trend: observation.trend,
		persistence_hours: observation.persistenceHours,
		depth_median_24h: observation.depthMedian24h,
		confidence: observation.confidence,
		base_price: observation.basePrice,
		trader_value: observation.traderValue,
		flea_net: observation.fleaNet,
		trader_break_even: observation.traderBreakEven,
		practical_break_even: observation.practicalBreakEven,
		max_net_price: observation.maxNetPrice,
		confidence_reasons: observation.confidenceReasons,
		stability_reasons: observation.stabilityReasons,
		coverage_24h: observation.coverage24h,
		coverage_7d: observation.coverage7d,
		coverage_30d: observation.coverage30d,
		regime_points: observation.regimePoints,
		trader_id: observation.traderId,
		flea_fee: observation.fleaFee,
		max_net: observation.maxNet,
	};
}

/** PostgreSQL persistence for derived analytics (migration 0002). */
export class PostgresAnalyticsStore {
	constructor(private readonly pool: Pool) {}

	async readTraderSellOffers(mode: TarkovDataMode): Promise<Map<string, VendorPrice[]>> {
		const result = await this.pool.query<{ item_id: string; trader_sell_offers: VendorPrice[] }>(
			"SELECT item_id, trader_sell_offers FROM item_prices WHERE mode = $1",
			[mode],
		);
		return new Map(
			result.rows.map((row) => [row.item_id, Array.isArray(row.trader_sell_offers) ? row.trader_sell_offers : []]),
		);
	}

	async readAnalysisBaseline(mode: TarkovDataMode): Promise<AnalysisBaseline> {
		const [runs, latest] = await Promise.all([
			this.pool.query<{ last_run_at: string | null }>(
				"SELECT max(started_at) AS last_run_at FROM market_analysis_runs WHERE mode = $1",
				[mode],
			),
			this.pool.query<{ item_id: string; source_updated_at: string }>(
				`SELECT DISTINCT ON (item_id) item_id, source_updated_at FROM item_market_observations
				WHERE mode = $1 ORDER BY item_id, calculated_at DESC`,
				[mode],
			),
		]);
		const lastRunAt = runs.rows[0]?.last_run_at;
		return {
			lastRunAt: lastRunAt == null ? null : Number(lastRunAt),
			analyzed: new Map(latest.rows.map((row) => [row.item_id, Number(row.source_updated_at)])),
		};
	}

	/** The run and all of its observations commit together or not at all. */
	async writeRun(run: AnalysisRun, observations: readonly MarketObservation[]): Promise<void> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				`INSERT INTO market_analysis_runs
					(run_id, mode, started_at, completed_at, status, analyzed_count, unchanged_count, missing_count, summary)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
				[
					run.runId,
					run.mode,
					run.startedAt,
					run.completedAt,
					run.status,
					run.analyzedCount,
					run.unchangedCount,
					run.missingCount,
					JSON.stringify(run.summary),
				],
			);
			for (let offset = 0; offset < observations.length; offset += INSERT_CHUNK_SIZE) {
				const records = observations
					.slice(offset, offset + INSERT_CHUNK_SIZE)
					.map((observation) => observationRecord(run.mode, run.runId, observation));
				await client.query(
					`INSERT INTO item_market_observations (${COLUMN_NAMES})
					SELECT ${COLUMN_NAMES} FROM jsonb_to_recordset($1::jsonb) AS x(${RECORD_TYPE})`,
					[JSON.stringify(records)],
				);
			}
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK").catch(() => undefined);
			throw error;
		} finally {
			client.release();
		}
	}
}
