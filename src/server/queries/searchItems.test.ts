import assert from "node:assert/strict";
import test from "node:test";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { DataResult, TarkovDataMode } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import { ITEM_SEARCH_MAX_QUERY_LENGTH } from "../../types/contracts";
import {
    ITEM_SEARCH_RESULT_LIMIT,
    searchItems,
} from "./searchItems";

function result<T>(data: T): DataResult<T> {
    return { data, updatedAt: 1, diagnostics: { provider: "json" } };
}

function createRepository(
    catalog: ItemSummary[],
    calls: TarkovDataMode[],
): TarkovDataRepository {
    const forbidden = async (): Promise<never> => {
        throw new Error("Unexpected repository call");
    };

    return {
        items: {
            async getCatalog(mode) {
                calls.push(mode);
                return result(catalog);
            },
            getByIds: forbidden,
        },
        hideout: { getStations: forbidden },
        quests: { getAll: forbidden, getByIds: forbidden },
        traders: { getAll: forbidden, getByIds: forbidden },
        recipes: { getBarters: forbidden, getCrafts: forbidden },
        prices: { getCurrent: forbidden, getHistory: forbidden },
    };
}

test("item search uses the explicit mode and preserves normalized matching", async () => {
    const calls: TarkovDataMode[] = [];
    const repository = createRepository(
        [
            { id: "name", name: "Pack of Sugar", normalizedName: "pack-of-sugar" },
            { id: "normalized", name: "Bolts", normalizedName: "bundle-of-bolts" },
            { id: "compact", name: "LEDX", normalizedName: "led-x-skin-transilluminator" },
            { id: "miss", name: "Screw nut", normalizedName: "screw-nut" },
        ],
        calls,
    );

    assert.deepEqual((await searchItems("pack of", "pve", repository)).items.map((item) => item.id), ["name"]);
    assert.deepEqual((await searchItems("bundle-of", "pve", repository)).items.map((item) => item.id), ["normalized"]);
    assert.deepEqual((await searchItems("ledxskin", "pve", repository)).items.map((item) => item.id), ["compact"]);
    assert.deepEqual(calls, ["pve", "pve", "pve"]);
});

test("item search returns at most the fixed result limit and rejects invalid queries before reading", async () => {
    const calls: TarkovDataMode[] = [];
    const catalog = Array.from({ length: ITEM_SEARCH_RESULT_LIMIT + 5 }, (_, index) => ({
        id: `item-${index}`,
        name: `Match ${index}`,
        normalizedName: `match-${index}`,
    }));
    const repository = createRepository(catalog, calls);

    const payload = await searchItems("match", "pvp-season", repository);
    assert.equal(payload.items.length, ITEM_SEARCH_RESULT_LIMIT);
    assert.deepEqual(calls, ["pvp-season"]);

    await assert.rejects(() => searchItems("   ", "regular", repository), RangeError);
    await assert.rejects(
        () => searchItems("x".repeat(ITEM_SEARCH_MAX_QUERY_LENGTH + 1), "regular", repository),
        RangeError,
    );
    assert.deepEqual(calls, ["pvp-season"]);
});
