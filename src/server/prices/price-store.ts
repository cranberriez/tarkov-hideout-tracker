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
    const statements: InStatement[] = [
        {
            sql: "DELETE FROM item_price_points WHERE mode = ? AND item_id = ?",
            args: [mode, outcome.itemId],
        },
    ];
    for (const point of outcome.points) {
        statements.push({
            sql: `
                INSERT INTO item_price_points
                    (mode, item_id, timestamp, price, price_min, offer_count, observed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
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
        `,
        args: [
            mode,
            outcome.itemId,
            integer(outcome.effectivePrice),
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
                SELECT item.entity_id
                FROM data_entities AS item
                INNER JOIN data_releases AS release
                    ON release.mode = item.mode
                    AND release.release_id = item.release_id
                    AND release.status = 'ready'
                LEFT JOIN data_entities AS legacy_price
                    ON legacy_price.mode = item.mode
                    AND legacy_price.release_id = item.release_id
                    AND legacy_price.entity_type = 'price'
                    AND legacy_price.entity_id = item.entity_id
                WHERE item.mode = ?
                    AND item.release_id = ?
                    AND item.entity_type = 'item'
                    AND (
                        json_extract(item.payload_json, '$.onFleaMarket') = 1
                        OR (
                            json_type(item.payload_json, '$.onFleaMarket') IS NULL
                            AND (
                                json_extract(legacy_price.payload_json, '$.avg24hPrice') IS NOT NULL
                                OR json_extract(legacy_price.payload_json, '$.lastLowPrice') IS NOT NULL
                            )
                        )
                    )
                ORDER BY item.entity_id
            `,
            args: [mode, releaseId],
        });
        return result.rows.flatMap((row) =>
            typeof row.entity_id === "string" ? [row.entity_id] : [],
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
