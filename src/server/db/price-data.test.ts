import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { createJiti } from "jiti";
import { TursoPriceRefreshStore } from "../prices/price-store";
import { refreshPriceMode } from "../prices/refresh-prices";
import { getFleaPrice, getFleaPriceEstimate } from "../../lib/utils/market-price";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, { alias: {
    "@": path.join(process.cwd(), "src"),
    "server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
} });
const { getCurrentPriceData } = await jiti.import<typeof import("./price-data")>("./price-data.ts");
const { ACTIVE_DATA_RELEASE_IDS } = await jiti.import<typeof import("./release-config")>("./release-config.ts");

test("bounded history hydration isolates modes, corrects old prices, and retains release/refresh fallbacks", async () => {
    const db = createClient({ url: "file::memory:" });
    try {
        await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
        const modes = ["regular", "pve", "pvp-season"] as const;
        for (const mode of modes) {
            await db.execute({ sql: `INSERT INTO data_releases (mode,release_id,schema_version,generated_at,snapshot_sha256,source_freshness_json,record_counts_json,status) VALUES (?,?,1,1,'hash','{"items":1}','{}','ready')`, args: [mode, ACTIVE_DATA_RELEASE_IDS[mode]] });
            for (const [type, payload] of [["price", { avg24hPrice: 900_000 }], ["item", { id: "item-a", onFleaMarket: true }]] as const) {
                await db.execute({ sql: `INSERT INTO data_entities (mode,release_id,entity_type,entity_id,updated_at,payload_json) VALUES (?,?,?,'item-a',1,?)`, args: [mode, ACTIVE_DATA_RELEASE_IDS[mode], type, JSON.stringify(payload)] });
            }
        }
        const store = new TursoPriceRefreshStore(db);
        for (const [index, mode] of modes.entries()) {
            const now = Date.now();
            await store.writeOutcomes(mode, [{ status: "updated", itemId: "item-a", etag: "good", checkedAt: now,
                effectivePrice: 925_926, sampleCount: 5, totalOfferCount: 50,
                points: Array.from({ length: 5 }, (_, i) => ({ price: 130_000 + index * 100_000, priceMin: 120_000 + index * 100_000, offerCount: 10, timestamp: now - (4 - i) * 7_200_000 })),
            }]);
            const current = (await getCurrentPriceData(mode, ["item-a"], db)).data["item-a"];
            assert.equal(current.price, 120_000 + index * 100_000);
            assert.equal(current.referencePrice, 130_000 + index * 100_000);
            assert.equal(current.fleaStability, "stable");
        }
        const before = (await getCurrentPriceData("pvp-season", ["item-a"], db)).data["item-a"];
        const failed = await refreshPriceMode({ mode: "pvp-season", releaseId: ACTIVE_DATA_RELEASE_IDS["pvp-season"], store,
            fetchHistory: async () => ({ status: "updated", etag: "bad", data: [] }),
        });
        assert.equal(failed.failedCount, 1);
        assert.deepEqual((await getCurrentPriceData("pvp-season", ["item-a"], db)).data["item-a"], before);
        await store.writeOutcomes("pvp-season", [{ status: "not-modified", itemId: "item-a", etag: "good", checkedAt: Date.now() }]);
        assert.equal((await getCurrentPriceData("pvp-season", ["item-a"], db)).data["item-a"].price, 320_000);
        const noOffers = await refreshPriceMode({ mode: "pvp-season", releaseId: ACTIVE_DATA_RELEASE_IDS["pvp-season"], store,
            fetchHistory: async () => ({ status: "updated", etag: "empty-market", data: [{ price: 0, priceMin: 0, offerCount: 0, timestamp: Date.now() }] }),
        });
        assert.equal(noOffers.changedCount, 1);
        const unavailable = (await getCurrentPriceData("pvp-season", ["item-a"], db)).data["item-a"];
        assert.equal(unavailable.lastOfferCount, 0);
        assert.equal(unavailable.fleaStability, "unavailable");
        assert.equal(getFleaPrice(unavailable), null);
        assert.equal(getFleaPriceEstimate(unavailable), null);
        const older = await refreshPriceMode({ mode: "pvp-season", releaseId: ACTIVE_DATA_RELEASE_IDS["pvp-season"], store,
            fetchHistory: async () => ({ status: "updated", etag: "old", data: [{ price: 100, priceMin: 90, offerCount: 10, timestamp: Date.now() - 60_000 }] }),
        });
        assert.equal(older.failedCount, 1);
        assert.equal((await getCurrentPriceData("pvp-season", ["item-a"], db)).data["item-a"].fleaStability, "unavailable");
        await db.execute("DELETE FROM item_price_points WHERE mode = 'pve'");
        const fallback = (await getCurrentPriceData("pve", ["item-a"], db)).data["item-a"];
        assert.equal(getFleaPrice(fallback), 900_000);
        assert.equal(fallback.fleaStability, "reference");
        await db.execute("DROP TABLE item_price_points");
        assert.equal(getFleaPrice((await getCurrentPriceData("regular", ["item-a"], db)).data["item-a"]), 900_000);
        await db.execute("DROP TABLE item_prices");
        assert.equal(getFleaPrice((await getCurrentPriceData("pvp-season", ["item-a"], db)).data["item-a"]), 900_000);
    } finally { db.close(); }
});
