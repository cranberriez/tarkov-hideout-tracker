import type { Client, InStatement } from "@libsql/client";
import type { TarkovDataMode } from "@/types/common";
import type { PriceHistoryPoint } from "@/types/prices";
import type {
    PriceRefreshOutcome,
    PriceRefreshStore,
    PriceRefreshSummary,
    PriceSyncState,
} from "./types";

const WRITE_BATCH_STATEMENT_LIMIT = 240;

function integer(value: number): number {
    return Math.round(value);
}

function updatedStatements(
    mode: TarkovDataMode,
    outcome: Extract<PriceRefreshOutcome, { status: "updated" }>,
): InStatement[] {
    const latest = outcome.points[outcome.points.length - 1];
    // Keep retained observations untouched, including their observed_at value.
    // The refresh adapter supplies a nonempty, timestamp-deduplicated bounded set.
    const statements: InStatement[] = [
        {
            sql: `DELETE FROM item_price_points
                WHERE mode = ? AND item_id = ?
                    AND timestamp NOT IN (${outcome.points.map(() => "?").join(", ")})`,
            args: [mode, outcome.itemId, ...outcome.points.map((point) => integer(point.timestamp))],
        },
    ];
    for (const point of outcome.points) {
        statements.push({
            sql: `
                INSERT INTO item_price_points
                    (mode, item_id, timestamp, price, price_min, offer_count, observed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (mode, item_id, timestamp) DO UPDATE SET
                    price = excluded.price,
                    price_min = excluded.price_min,
                    offer_count = excluded.offer_count,
                    observed_at = excluded.observed_at
                WHERE item_price_points.price IS NOT excluded.price
                    OR item_price_points.price_min IS NOT excluded.price_min
                    OR item_price_points.offer_count IS NOT excluded.offer_count
            `,
            args: [
                mode,
                outcome.itemId,
                integer(point.timestamp),
                integer(point.price),
                integer(point.priceMin),
                point.offerCount === null ? null : integer(point.offerCount),
                outcome.checkedAt,
            ],
        });
    }
    statements.push({
        sql: `
            INSERT INTO item_prices
                (mode, item_id, effective_price, latest_price, latest_price_min,
                 latest_offer_count, latest_point_timestamp, sample_count,
                 total_offer_count, etag, last_checked_at, last_changed_at,
                 consecutive_failures, last_error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            ON CONFLICT (mode, item_id) DO UPDATE SET
                effective_price = excluded.effective_price,
                latest_price = excluded.latest_price,
                latest_price_min = excluded.latest_price_min,
                latest_offer_count = excluded.latest_offer_count,
                latest_point_timestamp = excluded.latest_point_timestamp,
                sample_count = excluded.sample_count,
                total_offer_count = excluded.total_offer_count,
                etag = excluded.etag,
                last_checked_at = excluded.last_checked_at,
                last_changed_at = excluded.last_changed_at,
                consecutive_failures = 0,
                last_error = NULL
            WHERE (item_prices.effective_price, item_prices.latest_price,
                   item_prices.latest_price_min, item_prices.latest_offer_count,
                   item_prices.latest_point_timestamp, item_prices.sample_count,
                   item_prices.total_offer_count, item_prices.etag,
                   item_prices.last_checked_at, item_prices.last_changed_at,
                   item_prices.consecutive_failures, item_prices.last_error)
                IS NOT (excluded.effective_price, excluded.latest_price,
                        excluded.latest_price_min, excluded.latest_offer_count,
                        excluded.latest_point_timestamp, excluded.sample_count,
                        excluded.total_offer_count, excluded.etag,
                        excluded.last_checked_at, excluded.last_changed_at, 0, NULL)
        `,
        args: [
            mode,
            outcome.itemId,
            outcome.effectivePrice === null ? null : integer(outcome.effectivePrice),
            integer(latest.price),
            integer(latest.priceMin),
            latest.offerCount === null ? null : integer(latest.offerCount),
            integer(latest.timestamp),
            outcome.sampleCount,
            outcome.totalOfferCount,
            outcome.etag,
            outcome.checkedAt,
            outcome.checkedAt,
        ],
    });
    return statements;
}

function outcomeStatements(
    mode: TarkovDataMode,
    outcome: PriceRefreshOutcome,
): InStatement[] {
    if (outcome.status === "updated") return updatedStatements(mode, outcome);
    if (outcome.status === "not-modified") {
        return [{
            sql: `
                INSERT INTO item_prices
                    (mode, item_id, etag, last_checked_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (mode, item_id) DO UPDATE SET
                    etag = COALESCE(excluded.etag, item_prices.etag),
                    last_checked_at = excluded.last_checked_at,
                    consecutive_failures = 0,
                    last_error = NULL
                WHERE item_prices.etag IS NOT COALESCE(excluded.etag, item_prices.etag)
                    OR item_prices.last_checked_at IS NOT excluded.last_checked_at
                    OR item_prices.consecutive_failures IS NOT 0
                    OR item_prices.last_error IS NOT NULL
            `,
            args: [mode, outcome.itemId, outcome.etag, outcome.checkedAt],
        }];
    }
    return [{
        sql: `
            INSERT INTO item_prices
                (mode, item_id, last_checked_at, consecutive_failures, last_error)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT (mode, item_id) DO UPDATE SET
                last_checked_at = excluded.last_checked_at,
                consecutive_failures = item_prices.consecutive_failures + 1,
                last_error = excluded.last_error
        `,
        args: [mode, outcome.itemId, outcome.checkedAt, outcome.error.slice(0, 500)],
    }];
}

export class TursoPriceRefreshStore implements PriceRefreshStore {
    constructor(private readonly database: Client) {}

    async getEligibleItemIds(mode: TarkovDataMode, releaseId: string): Promise<string[]> {
        const result = await this.database.execute({
            sql: `
                SELECT item.record_id AS entity_id,
                    (json_extract(item_payload.payload_json, '$.onFleaMarket') = 1
                    OR (json_type(item_payload.payload_json, '$.onFleaMarket') IS NULL
                        AND (json_extract(price_payload.payload_json, '$.avg24hPrice') IS NOT NULL
                            OR json_extract(price_payload.payload_json, '$.lastLowPrice') IS NOT NULL))) AS eligible
                FROM active_data_releases AS active
                INNER JOIN data_releases AS release
                    ON release.mode = active.mode AND release.release_id = active.release_id
                    AND release.status = 'ready'
                LEFT JOIN current_records AS item
                    ON item.mode = active.mode AND item.record_type = 'entity' AND item.variant = 'item'
                LEFT JOIN data_payloads AS item_payload ON item_payload.payload_hash = item.payload_hash
                LEFT JOIN current_records AS legacy_price
                    ON legacy_price.mode = active.mode AND legacy_price.record_type = 'entity'
                    AND legacy_price.variant = 'price' AND legacy_price.record_id = item.record_id
                LEFT JOIN data_payloads AS price_payload ON price_payload.payload_hash = legacy_price.payload_hash
                WHERE active.mode = ? AND active.release_id = ?
                ORDER BY item.record_id
            `,
            args: [mode, releaseId],
        });
        if (!result.rows.length) {
            throw new Error(`No ready current data revision exists for ${mode}/${releaseId}; retry with the current revision.`);
        }
        return result.rows.flatMap((row) =>
            typeof row.entity_id === "string" && Number(row.eligible) === 1 ? [row.entity_id] : [],
        );
    }

    async getSyncStates(mode: TarkovDataMode): Promise<Record<string, PriceSyncState>> {
        const result = await this.database.execute({
            sql: `
                SELECT item_id, etag, latest_point_timestamp
                FROM item_prices
                WHERE mode = ?
            `,
            args: [mode],
        });
        return Object.fromEntries(
            result.rows.flatMap((row) =>
                typeof row.item_id === "string"
                    ? [[row.item_id, {
                          etag: typeof row.etag === "string" ? row.etag : null,
                          latestPointTimestamp:
                              typeof row.latest_point_timestamp === "number"
                                  ? row.latest_point_timestamp
                                  : null,
                      } satisfies PriceSyncState]]
                    : [],
            ),
        );
    }

    async tryAcquireLock(
        mode: TarkovDataMode,
        runId: string,
        lockedUntil: number,
        now: number,
    ): Promise<boolean> {
        const result = await this.database.execute({
            sql: `
                INSERT INTO price_refresh_locks (mode, run_id, locked_until)
                VALUES (?, ?, ?)
                ON CONFLICT (mode) DO UPDATE SET
                    run_id = excluded.run_id,
                    locked_until = excluded.locked_until
                WHERE price_refresh_locks.locked_until <= ?
            `,
            args: [mode, runId, lockedUntil, now],
        });
        return result.rowsAffected > 0;
    }

    async releaseLock(mode: TarkovDataMode, runId: string): Promise<void> {
        await this.database.execute({
            sql: "DELETE FROM price_refresh_locks WHERE mode = ? AND run_id = ?",
            args: [mode, runId],
        });
    }

    async startRun(runId: string, mode: TarkovDataMode, startedAt: number): Promise<void> {
        await this.database.execute({
            sql: `
                INSERT INTO price_refresh_runs (run_id, mode, started_at, status)
                VALUES (?, ?, ?, 'running')
            `,
            args: [runId, mode, startedAt],
        });
    }

    async writeOutcomes(mode: TarkovDataMode, outcomes: PriceRefreshOutcome[]): Promise<void> {
        let statements: InStatement[] = [];
        const flush = async () => {
            if (statements.length === 0) return;
            await this.database.batch(statements, "write");
            statements = [];
        };
        for (const outcome of outcomes) {
            const group = outcomeStatements(mode, outcome);
            if (
                statements.length > 0 &&
                statements.length + group.length > WRITE_BATCH_STATEMENT_LIMIT
            ) {
                await flush();
            }
            statements.push(...group);
        }
        await flush();
    }

    async completeRun(summary: PriceRefreshSummary, completedAt: number): Promise<void> {
        if (summary.status === "skipped") return;
        await this.database.execute({
            sql: `
                UPDATE price_refresh_runs
                SET completed_at = ?, status = ?, eligible_count = ?, checked_count = ?,
                    changed_count = ?, not_modified_count = ?, failed_count = ?, error = ?
                WHERE run_id = ?
            `,
            args: [
                completedAt,
                summary.status,
                summary.eligibleCount,
                summary.checkedCount,
                summary.changedCount,
                summary.notModifiedCount,
                summary.failedCount,
                summary.error ?? null,
                summary.runId,
            ],
        });
    }
}

export interface StoredPricePointData {
    points: PriceHistoryPoint[];
    updatedAt: number | null;
}

export async function getStoredPricePoints(
    database: Client,
    mode: TarkovDataMode,
    itemId: string,
): Promise<StoredPricePointData> {
    const result = await database.execute({
        sql: `
            SELECT timestamp, price, price_min, offer_count
            FROM item_price_points
            WHERE mode = ? AND item_id = ?
            ORDER BY timestamp ASC
        `,
        args: [mode, itemId],
    });
    const points = result.rows.map((row) => ({
        timestamp: Number(row.timestamp),
        price: Number(row.price),
        priceMin: Number(row.price_min),
        offerCount: row.offer_count === null ? null : Number(row.offer_count),
    }));
    return {
        points,
        updatedAt: points[points.length - 1]?.timestamp ?? null,
    };
}
