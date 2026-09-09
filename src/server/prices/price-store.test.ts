import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { insertCurrentTestRecord } from "../db/current-test-fixture";
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
        await database.execute("INSERT INTO active_data_releases VALUES ('regular', 'release-a', 1)");
        for (const [itemId, payload] of itemRows) {
            await insertCurrentTestRecord(database, "regular", "entity", itemId, "item", payload);
        }
        await insertCurrentTestRecord(database, "regular", "entity", "legacy-item", "price", { avg24hPrice: 100 });

        const store = new TursoPriceRefreshStore(database);
        assert.deepEqual(
            await store.getEligibleItemIds("regular", "release-a"),
            ["flea-item", "legacy-item"],
        );
        await assert.rejects(store.getEligibleItemIds("regular", "obsolete"), /No ready current data revision/);
        await database.execute("INSERT INTO data_releases VALUES ('pve', 'empty', 1, 1, 'hash', '{}', '{}', 'ready', 1)");
        await database.execute("INSERT INTO active_data_releases VALUES ('pve', 'empty', 1)");
        assert.deepEqual(await store.getEligibleItemIds("pve", "empty"), []);
        await insertCurrentTestRecord(database, "pve", "entity", "blocked", "item", { onFleaMarket: false });
        assert.deepEqual(await store.getEligibleItemIds("pve", "empty"), []);
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

test("writes only history deltas and preserves refresh metadata and mode isolation", async () => {
    const database = createClient({ url: "file::memory:" });
    try {
        await database.executeMultiple(
            await readFile(path.join(process.cwd(), "db-scripts/schema.sql"), "utf8"),
        );
        await database.executeMultiple(`
            CREATE TABLE writes (kind TEXT);
            CREATE TRIGGER history_insert AFTER INSERT ON item_price_points
                BEGIN INSERT INTO writes VALUES ('insert'); END;
            CREATE TRIGGER history_update AFTER UPDATE ON item_price_points
                BEGIN INSERT INTO writes VALUES ('update'); END;
            CREATE TRIGGER history_delete AFTER DELETE ON item_price_points
                BEGIN INSERT INTO writes VALUES ('delete'); END;
            CREATE TRIGGER current_update AFTER UPDATE ON item_prices
                BEGIN INSERT INTO writes VALUES ('current'); END;
        `);
        const store = new TursoPriceRefreshStore(database);
        const outcome = {
            status: "updated" as const,
            itemId: "item", etag: '"v1"', checkedAt: 500,
            points: [
                { timestamp: 100, price: 1000, priceMin: 900, offerCount: 2 },
                { timestamp: 200, price: 1100, priceMin: 950, offerCount: null },
            ],
            effectivePrice: 925, sampleCount: 2, totalOfferCount: 0,
        };
        await store.writeOutcomes("regular", [outcome]);
        await store.writeOutcomes("pve", [outcome]);
        await database.execute("DELETE FROM writes");
        await store.writeOutcomes("regular", [outcome]);
        assert.deepEqual((await database.execute("SELECT kind FROM writes")).rows, []);
        await store.writeOutcomes("regular", [{ ...outcome, checkedAt: 600 }]);
        assert.deepEqual((await database.execute("SELECT kind FROM writes")).rows.map(row => row.kind), ["current"]);
        assert.deepEqual((await database.execute("SELECT observed_at FROM item_price_points WHERE mode = 'regular'")).rows.map(row => row.observed_at), [500, 500]);

        await database.execute("DELETE FROM writes");
        const changed = {
            ...outcome, checkedAt: 700, etag: '"v2"',
            points: [
                { ...outcome.points[1], price: 1200, priceMin: 975, offerCount: 3 },
                { timestamp: 300, price: 1300, priceMin: 1000, offerCount: 4 },
            ],
        };
        await store.writeOutcomes("regular", [changed]);
        assert.deepEqual((await database.execute("SELECT kind FROM writes ORDER BY kind")).rows.map(row => row.kind), ["current", "delete", "insert", "update"]);
        assert.deepEqual((await getStoredPricePoints(database, "regular", "item")).points, changed.points);
        assert.deepEqual((await getStoredPricePoints(database, "pve", "item")).points, outcome.points);
        await store.writeOutcomes("regular", [{ status: "failed", itemId: "item", checkedAt: 800, error: "failure" }]);
        await store.writeOutcomes("regular", [{ status: "not-modified", itemId: "item", checkedAt: 900, etag: null }]);
        const current = (await database.execute("SELECT * FROM item_prices WHERE mode = 'regular'")).rows[0];
        assert.equal(current.etag, '"v2"');
        assert.equal(current.last_checked_at, 900);
        assert.equal(current.last_changed_at, 700);
        assert.equal(current.consecutive_failures, 0);
        assert.equal(current.last_error, null);
        assert.equal(current.effective_price, outcome.effectivePrice);
        await database.execute("DELETE FROM writes");
        await store.writeOutcomes("regular", [{ status: "not-modified", itemId: "item", checkedAt: 900, etag: null }]);
        assert.deepEqual((await database.execute("SELECT kind FROM writes")).rows, []);
    } finally {
        database.close();
    }
});

test("rolls back history deltas when the current price write fails", async () => {
    const database = createClient({ url: "file::memory:" });
    try {
        await database.executeMultiple(
            await readFile(path.join(process.cwd(), "db-scripts/schema.sql"), "utf8"),
        );
        const store = new TursoPriceRefreshStore(database);
        const outcome = {
            status: "updated" as const, itemId: "item", etag: null, checkedAt: 500,
            points: [{ timestamp: 100, price: 1000, priceMin: 900, offerCount: 2 }],
            effectivePrice: 900, sampleCount: 1, totalOfferCount: 2,
        };
        await store.writeOutcomes("regular", [outcome]);
        await database.executeMultiple(`
            CREATE TRIGGER reject_current BEFORE UPDATE ON item_prices
                BEGIN SELECT RAISE(ABORT, 'test failure'); END;
        `);
        await assert.rejects(store.writeOutcomes("regular", [{
            ...outcome, checkedAt: 600,
            points: [{ ...outcome.points[0], timestamp: 200 }],
        }]), /test failure/);
        assert.deepEqual((await getStoredPricePoints(database, "regular", "item")).points, outcome.points);
    } finally {
        database.close();
    }
});
