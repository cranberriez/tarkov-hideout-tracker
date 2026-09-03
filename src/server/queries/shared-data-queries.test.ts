import assert from "node:assert/strict";
import test from "node:test";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { DataResult } from "@/types/common";
import type { Station } from "@/types/hideout";
import { getCompletedItemsConversionData } from "./getCompletedItemsConversionData";
import { getLegacyProfileConversionData } from "./getLegacyProfileConversionData";

function result<T>(data: T, updatedAt = 1): DataResult<T> {
    return {
        data,
        updatedAt,
        diagnostics: {
            provider: "json",
            localePaths: ["pve/en"],
            usedRegularLocaleFallback: false,
        },
    };
}

const station: Station = {
    id: "workbench",
    name: "Workbench",
    normalizedName: "workbench",
    levels: [
        {
            id: "workbench-1",
            level: 1,
            constructionTime: 0,
            itemRequirements: [
                {
                    id: "requirement-a",
                    itemId: "item-a",
                    count: 2,
                    isFir: false,
                    isTool: false,
                },
                {
                    id: "requirement-b",
                    itemId: "item-a",
                    count: 1,
                    isFir: true,
                    isTool: false,
                },
            ],
            stationLevelRequirements: [],
            skillRequirements: [],
            traderRequirements: [],
        },
    ],
};

function repository(overrides: {
    items?: TarkovDataRepository["items"]["getByIds"];
    stations?: TarkovDataRepository["hideout"]["getStations"];
}): TarkovDataRepository {
    const forbidden = async (): Promise<never> => {
        throw new Error("Unexpected repository call");
    };
    return {
        items: {
            getByIds: overrides.items ?? forbidden,
        },
        hideout: { getStations: overrides.stations ?? forbidden },
        quests: { getAll: forbidden, getByIds: forbidden },
        traders: { getAll: forbidden, getByIds: forbidden },
        recipes: { getBarters: forbidden, getCrafts: forbidden },
        prices: { getCurrent: forbidden, getHistory: forbidden },
    };
}

test("legacy conversion returns compact station summaries only", async () => {
    const data = await getLegacyProfileConversionData(
        "pve",
        repository({ stations: async (mode) => {
            assert.equal(mode, "pve");
            return result([station], 10);
        } }),
    );

    assert.deepEqual(data.stations, [
        { id: "workbench", name: "Workbench", maxLevel: 1 },
    ]);
    assert.equal(data.freshness.stationsUpdatedAt, 10);
    assert.equal(data.errors.stations, null);
});
test("completed-item conversion requests only unique station item IDs", async () => {
    const requestedIds: string[][] = [];
    const data = await getCompletedItemsConversionData(
        "pvp-season",
        repository({
            stations: async (mode) => {
                assert.equal(mode, "pvp-season");
                return result([station], 10);
            },
            items: async (mode, ids) => {
                assert.equal(mode, "pvp-season");
                requestedIds.push([...ids]);
                return result({
                    "item-a": {
                        id: "item-a",
                        name: "Item A",
                        normalizedName: "item a",
                        shortName: "A",
                        marketPrice: { price: 100 },
                    },
                }, 20);
            },
        }),
    );

    assert.deepEqual(requestedIds, [["item-a"]]);
    assert.deepEqual(data.items, [
        { id: "item-a", name: "Item A", normalizedName: "item a" },
    ]);
    assert.deepEqual(data.unresolvedItemIds, []);
    assert.deepEqual(data.errors, { stations: null, items: null });
});

test("completed-item conversion reports a station failure without broad reads", async () => {
    const data = await getCompletedItemsConversionData(
        "regular",
        repository({ stations: async () => { throw new Error("offline"); } }),
    );

    assert.deepEqual(data.stations, []);
    assert.deepEqual(data.items, []);
    assert.equal(data.errors.stations, "Hideout station data could not be loaded.");
    assert.equal(data.errors.items, null);
});

test("completed-item conversion retains requirements when item names fail", async () => {
    const data = await getCompletedItemsConversionData(
        "regular",
        repository({
            stations: async () => result([station], 10),
            items: async () => { throw new Error("offline"); },
        }),
    );

    assert.equal(data.stations[0]?.id, "workbench");
    assert.deepEqual(data.items, []);
    assert.deepEqual(data.unresolvedItemIds, ["item-a"]);
    assert.equal(data.errors.stations, null);
    assert.equal(data.errors.items, "Hideout item names could not be loaded.");
});
