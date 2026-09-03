import assert from "node:assert/strict";
import test from "node:test";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { DataResult, TarkovDataMode } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import type { FullQuest } from "@/types/quests";
import {
    COLLECTOR_QUEST_ID_BY_MODE,
    getKappaChecklistPageData,
} from "./getKappaChecklistPageData";

const MODES: readonly TarkovDataMode[] = ["regular", "pve", "pvp-season"];

function result<T>(data: T, updatedAt: number): DataResult<T> {
    return { data, updatedAt, diagnostics: { provider: "json" } };
}

function collectorQuest(id: string): FullQuest {
    return {
        id,
        name: "Collector",
        normalizedName: "collector",
        experience: 0,
        trader: {
            id: "fence",
            name: "Fence",
            normalizedName: "fence",
            imageLink: "fence.png",
            image4xLink: "fence-4x.png",
        },
        taskRequirements: [],
        traderRequirements: [],
        otherRequirements: [],
        objectives: [
            {
                id: "give-items",
                type: "giveItem",
                description: "Hand over the items",
                optional: false,
                count: 1,
                foundInRaid: true,
                itemIds: ["item-b", "item-a", "item-b", "missing-item"],
            },
            {
                id: "find-item",
                type: "findItem",
                description: "Find another item",
                optional: false,
                count: 1,
                foundInRaid: true,
                itemIds: ["ignored-find-item"],
            },
        ],
    };
}

test("Kappa requests only the configured Collector and its give-item records in every mode", async () => {
    for (const mode of MODES) {
        const collectorId = COLLECTOR_QUEST_ID_BY_MODE[mode];
        const calls = {
            questByIds: [] as Array<[TarkovDataMode, readonly string[]]>,
            itemByIds: [] as Array<[TarkovDataMode, readonly string[]]>,
            currentPrices: [] as Array<[TarkovDataMode, readonly string[]]>,
            questAll: 0,
            hideout: 0,
            traders: 0,
            barters: 0,
            crafts: 0,
            priceHistory: 0,
            maps: 0,
        };
        const items: Record<string, ItemSummary> = {
            "item-a": { id: "item-a", name: "A", normalizedName: "a" },
            "item-b": { id: "item-b", name: "B", normalizedName: "b" },
        };
        const prices: Record<string, CurrentPrice> = {
            "item-a": { price: 100 },
            "item-b": { price: 200 },
        };
        type ForbiddenCall =
            | "questAll"
            | "hideout"
            | "traders"
            | "barters"
            | "crafts"
            | "priceHistory";
        const forbidden = (name: ForbiddenCall) => async () => {
            calls[name] += 1;
            throw new Error(`${name} must not be called`);
        };
        const repository: TarkovDataRepository = {
            items: {
                async getByIds(requestMode, ids) {
                    calls.itemByIds.push([requestMode, [...ids]]);
                    return result(items, 20);
                },
            },
            hideout: { getStations: forbidden("hideout") },
            quests: {
                getAll: forbidden("questAll"),
                async getByIds(requestMode, ids) {
                    calls.questByIds.push([requestMode, [...ids]]);
                    return result({ [collectorId]: collectorQuest(collectorId) }, 10);
                },
            },
            traders: {
                getAll: forbidden("traders"),
                getByIds: forbidden("traders"),
            },
            recipes: {
                getBarters: forbidden("barters"),
                getCrafts: forbidden("crafts"),
            },
            prices: {
                async getCurrent(requestMode, ids) {
                    calls.currentPrices.push([requestMode, [...ids]]);
                    return result(prices, 30);
                },
                getHistory: forbidden("priceHistory"),
            },
        };

        const pageData = await getKappaChecklistPageData(mode, repository);
        const expectedItemIds = ["item-b", "item-a", "missing-item"];

        assert.deepEqual(calls.questByIds, [[mode, [collectorId]]]);
        assert.deepEqual(calls.itemByIds, [[mode, expectedItemIds]]);
        assert.deepEqual(calls.currentPrices, [[mode, expectedItemIds]]);
        assert.equal(calls.questAll, 0);
        assert.equal(calls.hideout, 0);
        assert.equal(calls.traders, 0);
        assert.equal(calls.barters, 0);
        assert.equal(calls.crafts, 0);
        assert.equal(calls.priceHistory, 0);
        assert.equal(calls.maps, 0);
        assert.deepEqual(pageData.unresolvedItemIds, ["missing-item"]);
        assert.deepEqual(
            pageData.items.map((item) => [item.id, item.marketPrice?.price]),
            [
                ["item-b", 200],
                ["item-a", 100],
            ],
        );
        assert.deepEqual(pageData.freshness, {
            questsUpdatedAt: 10,
            itemsUpdatedAt: 20,
            pricesUpdatedAt: 30,
        });
    }
});

test("Kappa keeps item results when prices fail and reports quest failures explicitly", async () => {
    const collectorId = COLLECTOR_QUEST_ID_BY_MODE.regular;
    const neverCalled = async () => {
        throw new Error("not expected");
    };
    const baseRepository: TarkovDataRepository = {
        items: {
            async getByIds() {
                return result(
                    { "item-b": { id: "item-b", name: "B", normalizedName: "b" } },
                    20,
                );
            },
        },
        hideout: { getStations: neverCalled },
        quests: {
            getAll: neverCalled,
            async getByIds() {
                return result({ [collectorId]: collectorQuest(collectorId) }, 10);
            },
        },
        traders: { getAll: neverCalled, getByIds: neverCalled },
        recipes: { getBarters: neverCalled, getCrafts: neverCalled },
        prices: { getCurrent: neverCalled, getHistory: neverCalled },
    };

    const priceFailure = await getKappaChecklistPageData("regular", baseRepository);
    assert.deepEqual(priceFailure.items.map((item) => item.id), ["item-b"]);
    assert.equal(priceFailure.errors.prices, "Collector item prices could not be loaded.");
    assert.equal(priceFailure.freshness.pricesUpdatedAt, null);

    const questFailure = await getKappaChecklistPageData("regular", {
        ...baseRepository,
        quests: { getAll: neverCalled, getByIds: neverCalled },
    });
    assert.equal(questFailure.collectorQuest, null);
    assert.equal(questFailure.errors.quests, "Collector quest data could not be loaded.");
    assert.deepEqual(questFailure.items, []);
});
