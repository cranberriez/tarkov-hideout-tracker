import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { TursoPriceRefreshStore, getStoredPricePoints } from "./price-store";

test("selects flea items and stores only the supplied bounded point set", async () => {
    const database = createClient({ url: "file::memory:" });
    try {
        await database.executeMultiple(
            await readFile(path.join(process.cwd(), "db-scripts/schema.sql"), "utf8"),
        );
        await database.execute({
            sql: `
                INSERT INTO data_releases
                    (mode, release_id, schema_version, generated_at, snapshot_sha256,
                     source_freshness_json, record_counts_json, status)
                VALUES ('regular', 'release-a', 1, 1, 'hash', '{}', '{}', 'ready')
            `,
            args: [],
        });
        const itemRows = [
            ["flea-item", { id: "flea-item", onFleaMarket: true }],
            ["blocked-item", { id: "blocked-item", onFleaMarket: false }],
            ["legacy-item", { id: "legacy-item" }],
        ] as const;
        for (const [itemId, payload] of itemRows) {
            await database.execute({
                sql: `
                    INSERT INTO data_entities
                        (mode, release_id, entity_type, entity_id, updated_at, payload_json)
                    VALUES ('regular', 'release-a', 'item', ?, 1, ?)
                `,
                args: [itemId, JSON.stringify(payload)],
            });
        }
        await database.execute({
            sql: `
                INSERT INTO data_entities
                    (mode, release_id, entity_type, entity_id, updated_at, payload_json)
                VALUES ('regular', 'release-a', 'price', 'legacy-item', 1, ?)
            `,
            args: [JSON.stringify({ avg24hPrice: 100 })],
        });

        const store = new TursoPriceRefreshStore(database);
        assert.deepEqual(
            await store.getEligibleItemIds("regular", "release-a"),
            ["flea-item", "legacy-item"],
        );
        await store.writeOutcomes("regular", [{
            status: "updated",
            itemId: "flea-item",
            etag: '"v1"',
            checkedAt: 500,
            points: Array.from({ length: 10 }, (_, index) => ({
                timestamp: 100 + index,
                price: 1_000 + index,
                priceMin: 900 + index,
                offerCount: 2,
            })),
            effectivePrice: 1_007,
            sampleCount: 5,
            totalOfferCount: 10,
        }]);

        const stored = await getStoredPricePoints(database, "regular", "flea-item");
        assert.equal(stored.points.length, 10);
        assert.equal(stored.points[9].price, 1_009);
        const current = await database.execute({
            sql: "SELECT effective_price, etag FROM item_prices WHERE mode = 'regular' AND item_id = 'flea-item'",
            args: [],
        });
        assert.equal(current.rows[0].effective_price, 1_007);
        assert.equal(current.rows[0].etag, '"v1"');

        await store.writeOutcomes("regular", [{
            status: "failed",
            itemId: "flea-item",
            checkedAt: 600,
            error: "temporary failure",
        }]);
        const afterFailure = await database.execute({
            sql: "SELECT effective_price, consecutive_failures FROM item_prices WHERE mode = 'regular' AND item_id = 'flea-item'",
            args: [],
        });
        assert.equal(afterFailure.rows[0].effective_price, 1_007);
        assert.equal(afterFailure.rows[0].consecutive_failures, 1);
    } finally {
        database.close();
    }
});
