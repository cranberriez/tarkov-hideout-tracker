import assert from "node:assert/strict";
import test from "node:test";
import type { CraftRecord } from "@/types/recipes";
import {
    BITCOIN_FARM_STATION_ID,
    BOTTLE_OF_WATER_ITEM_ID,
    craftRequiredItems,
    hideoutManagementConsumptionReduction,
    isTrackedCraft,
    PHYSICAL_BITCOIN_ITEM_ID,
    PURIFIED_WATER_ITEM_ID,
    WATER_COLLECTOR_STATION_ID,
    WATER_FILTER_ITEM_ID,
} from "./craft-rules";

function craft(overrides: Partial<CraftRecord> = {}): CraftRecord {
    return {
        id: "craft",
        productItemId: "output",
        productCount: 1,
        stationId: "station",
        level: 1,
        duration: 60,
        requiredItems: [{ itemId: "input", count: 1 }],
        requiredQuestItems: [],
        gameEditions: [],
        ...overrides,
    };
}

test("passive Bitcoin production and the bottled-water refill are not tracked as crafts", () => {
    assert.equal(isTrackedCraft(craft({
        stationId: BITCOIN_FARM_STATION_ID,
        productItemId: PHYSICAL_BITCOIN_ITEM_ID,
        requiredItems: [],
    })), false);
    assert.equal(isTrackedCraft(craft({
        stationId: WATER_COLLECTOR_STATION_ID,
        productItemId: BOTTLE_OF_WATER_ITEM_ID,
        requiredItems: [{ itemId: BOTTLE_OF_WATER_ITEM_ID, count: 1 }],
    })), false);
    assert.equal(isTrackedCraft(craft()), true);
});

test("Hideout Management reduces only Superwater's Water filter consumption", () => {
    const superwater = craft({
        stationId: WATER_COLLECTOR_STATION_ID,
        productItemId: PURIFIED_WATER_ITEM_ID,
        requiredItems: [
            { itemId: WATER_FILTER_ITEM_ID, count: 0.66 },
            { itemId: "other", count: 2 },
        ],
    });
    for (const [level, reduction] of [[0, 0], [1, 0.005], [25, 0.125], [50, 0.25], [51, 0.25]] as const) {
        assert.equal(hideoutManagementConsumptionReduction(level), reduction);
        const adjusted = craftRequiredItems(superwater, level);
        assert.equal(adjusted[0].count, 0.66 * (1 - reduction));
        assert.equal(adjusted[1].count, 2);
    }
    const unrelated = craft();
    assert.strictEqual(craftRequiredItems(unrelated, 50), unrelated.requiredItems);
    assert.equal(superwater.requiredItems[0].count, 0.66);
});
