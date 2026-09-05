import assert from "node:assert/strict";
import test from "node:test";
import { PRICE_HISTORY_CUTOFF_TIMESTAMP } from "../services/priceHistory";
import type {
    PriceRefreshOutcome,
    PriceRefreshStore,
    PriceRefreshSummary,
} from "./types";
import { refreshPriceMode } from "./refresh-prices";

class MemoryStore implements PriceRefreshStore {
    outcomes: PriceRefreshOutcome[] = [];
    completed: PriceRefreshSummary | null = null;
    acquired = true;

    async getEligibleItemIds() {
        return ["item-a", "item-b", "item-c"];
    }
    async getSyncStates() {
        return { "item-a": { etag: '"a"', latestPointTimestamp: 1 } };
    }
    async tryAcquireLock() {
        return this.acquired;
    }
    async releaseLock() {}
    async startRun() {}
    async writeOutcomes(_mode: string, outcomes: PriceRefreshOutcome[]) {
        this.outcomes.push(...outcomes);
    }
    async completeRun(summary: PriceRefreshSummary) {
        this.completed = summary;
    }
}

test("refreshes eligible items, keeps ten points, and reports partial failures", async () => {
    const store = new MemoryStore();
    const summary = await refreshPriceMode({
        mode: "pvp-season",
        releaseId: "release-a",
        store,
        concurrency: 2,
        fetchHistory: async (_mode, itemId, etag) => {
            if (itemId === "item-a") {
                assert.equal(etag, '"a"');
                return { status: "not-modified", etag };
            }
            if (itemId === "item-c") throw new Error("provider unavailable");
            return {
                status: "updated",
                etag: '"b"',
                data: Array.from({ length: 11 }, (_, index) => ({
                    timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP + index,
                    price: 100 + index,
                    priceMin: 90 + index,
                    offerCount: 1,
                })),
            };
        },
    });

    assert.equal(summary.status, "partial");
    assert.equal(summary.eligibleCount, 3);
    assert.equal(summary.changedCount, 1);
    assert.equal(summary.notModifiedCount, 1);
    assert.equal(summary.failedCount, 1);
    const updated = store.outcomes.find(
        (outcome): outcome is Extract<PriceRefreshOutcome, { status: "updated" }> =>
            outcome.status === "updated",
    );
    assert.ok(updated);
    assert.equal(updated.points.length, 10);
    assert.equal(updated.points[0].price, 101);
    assert.equal(updated.effectivePrice, 98);
    assert.equal(store.completed?.status, "partial");
});

test("skips when another refresh holds the mode lock", async () => {
    const store = new MemoryStore();
    store.acquired = false;
    const summary = await refreshPriceMode({
        mode: "regular",
        releaseId: "release-a",
        store,
    });
    assert.equal(summary.status, "skipped");
    assert.equal(store.outcomes.length, 0);
});

test("invalid updated histories produce failures rather than replacement prices", async () => {
    const store = new MemoryStore();
    const result = await refreshPriceMode({
        mode: "pve", releaseId: "release-a", store,
        fetchHistory: async (_mode, id) => ({ status: "updated", etag: "invalid", data:
            id === "item-a" ? [] : [{ timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP, price: 100, priceMin: id === "item-b" ? NaN : 0, offerCount: 1 }],
        }),
    });
    assert.equal(result.changedCount, 0);
    assert.equal(result.failedCount, 3);
    assert.ok(store.outcomes.every(outcome => outcome.status === "failed"));
});
