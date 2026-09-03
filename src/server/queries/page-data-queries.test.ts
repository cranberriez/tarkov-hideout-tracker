import assert from "node:assert/strict";
import test from "node:test";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { DataResult } from "@/types/common";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { FullQuest } from "@/types/quests";
import { getHideoutPageData } from "./getHideoutPageData";
import { getItemChecklistPageData } from "./getItemChecklistPageData";
import { getProfitPageData } from "./getProfitPageData";
import { getQuestWorkspacePageData } from "./getQuestWorkspacePageData";

function result<T>(data: T, updatedAt = 1): DataResult<T> {
    return { data, updatedAt, diagnostics: { provider: "json" } };
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
                { id: "r1", itemId: "item-a", count: 1, isFir: false, isTool: false },
                { id: "r2", itemId: "item-a", count: 2, isFir: false, isTool: false },
            ],
            stationLevelRequirements: [],
            skillRequirements: [],
            traderRequirements: [],
        },
    ],
};

const quest: FullQuest = {
    id: "quest-1",
    name: "Quest",
    normalizedName: "quest",
    experience: 0,
    trader: { id: "trader", name: "Trader", normalizedName: "trader" },
    taskRequirements: [],
    traderRequirements: [],
    otherRequirements: [],
    finishItemRewards: [{ itemId: "item-b", count: 1 }],
    objectives: [
        {
            id: "give",
            type: "giveItem",
            description: "Give",
            optional: false,
            count: 1,
            foundInRaid: false,
            itemIds: ["item-a", "item-a"],
            requiredKeyIds: [["item-c", "item-c"]],
        },
    ],
};

function createRepository(
    overrides: Partial<{
        stations: TarkovDataRepository["hideout"]["getStations"];
        quests: TarkovDataRepository["quests"]["getAll"];
        items: TarkovDataRepository["items"]["getByIds"];
        prices: TarkovDataRepository["prices"]["getCurrent"];
        barters: TarkovDataRepository["recipes"]["getBarters"];
        crafts: TarkovDataRepository["recipes"]["getCrafts"];
        traders: TarkovDataRepository["traders"]["getByIds"];
    }>,
): TarkovDataRepository {
    const forbidden = async (): Promise<never> => {
        throw new Error("Unexpected repository call");
    };
    return {
        items: { getByIds: overrides.items ?? forbidden },
        hideout: { getStations: overrides.stations ?? forbidden },
        quests: { getAll: overrides.quests ?? forbidden, getByIds: forbidden },
        traders: { getAll: forbidden, getByIds: overrides.traders ?? forbidden },
        recipes: {
            getBarters: overrides.barters ?? forbidden,
            getCrafts: overrides.crafts ?? forbidden,
        },
        prices: { getCurrent: overrides.prices ?? forbidden, getHistory: forbidden },
    };
}

test("hideout reads only deduped station item IDs and retains summaries when prices fail", async () => {
    const itemCalls: string[][] = [];
    const priceCalls: string[][] = [];
    const repository = createRepository({
        stations: async () => result([station], 10),
        items: async (_mode, ids) => {
            itemCalls.push([...ids]);
            return result({ "item-a": { id: "item-a", name: "A", normalizedName: "a" } }, 20);
        },
        prices: async (_mode, ids) => {
            priceCalls.push([...ids]);
            throw new Error("prices unavailable");
        },
    });

    const data = await getHideoutPageData("pve", repository);
    assert.deepEqual(itemCalls, [["item-a"]]);
    assert.deepEqual(priceCalls, [["item-a"]]);
    assert.deepEqual(data.items, [
        { id: "item-a", name: "A", normalizedName: "a", marketPrice: null },
    ]);
    assert.equal(data.errors.items, null);
    assert.equal(data.errors.prices, "Hideout item prices could not be loaded.");
});

test("item checklist remains usable with station data when quests fail", async () => {
    const requestedIds: string[][] = [];
    const repository = createRepository({
        stations: async () => result([station], 10),
        quests: async () => {
            throw new Error("quests unavailable");
        },
        items: async (_mode, ids) => {
            requestedIds.push([...ids]);
            return result({ "item-a": { id: "item-a", name: "A", normalizedName: "a" } });
        },
        prices: async () => result({ "item-a": { price: 100 } }),
    });

    const data = await getItemChecklistPageData("regular", repository);
    assert.deepEqual(requestedIds, [["item-a"]]);
    assert.deepEqual(data.questItemIndex, []);
    assert.equal(data.errors.quests, "Quest checklist data could not be loaded.");
    assert.equal(data.items?.[0].marketPrice?.price, 100);
});

test("item checklist excludes reward-only items and reward indexes from its route contract", async () => {
    const requestedIds: string[][] = [];
    const repository = createRepository({
        stations: async () => result([station]),
        quests: async () => result([quest]),
        items: async (_mode, ids) => {
            requestedIds.push([...ids]);
            return result(
                Object.fromEntries(
                    ids.map((id) => [id, { id, name: id, normalizedName: id }]),
                ),
            );
        },
        prices: async () => result({}),
    });

    const data = await getItemChecklistPageData("regular", repository);

    assert.deepEqual(requestedIds, [["item-a"]]);
    assert.equal("questRewardIndex" in data, false);
});

test("quest workspace requests only standard IDs referenced by delivered quests", async () => {
    const requestedIds: string[][] = [];
    const repository = createRepository({
        quests: async () => result([quest], 10),
        items: async (_mode, ids) => {
            requestedIds.push([...ids]);
            const items = Object.fromEntries(
                ids.map((id) => [id, { id, name: id, normalizedName: id } satisfies ItemSummary]),
            );
            return result(items, 20);
        },
        prices: async () => result({}, 30),
    });

    const data = await getQuestWorkspacePageData("regular", repository);
    assert.deepEqual(requestedIds, [["item-b", "item-c", "item-a"]]);
    assert.deepEqual(data.itemIds, ["item-b", "item-c", "item-a"]);
    assert.equal(data.quests?.[0].id, "quest-1");
    assert.equal(data.errors.quests, null);
    assert.equal("questItemIndex" in data, false);
    assert.equal("questRewardIndex" in data, false);
    assert.equal("questAnyOfGroups" in data, false);
    assert.equal("questAvailabilityQuests" in data, false);
});

test("profit keeps the craft graph when barter and trader domains fail", async () => {
    const requestedIds: string[][] = [];
    const repository = createRepository({
        barters: async () => {
            throw new Error("barters unavailable");
        },
        crafts: async () =>
            result([
                {
                    id: "craft-1",
                    productItemId: "item-a",
                    productCount: 1,
                    stationId: "workbench",
                    level: 1,
                    duration: 10,
                    requiredItems: [{ itemId: "item-b", count: 1 }],
                    requiredQuestItems: [{ itemId: "item-b", count: 1 }],
                    gameEditions: [],
                },
            ]),
        items: async (_mode, ids) => {
            requestedIds.push([...ids]);
            return result({
                "item-a": { id: "item-a", name: "A", normalizedName: "a" },
                "item-b": { id: "item-b", name: "B", normalizedName: "b" },
            });
        },
        prices: async () => result({}),
        stations: async () => result([station]),
    });

    const data = await getProfitPageData("pvp-season", repository);
    assert.deepEqual(requestedIds, [["item-a", "item-b"]]);
    assert.equal(data.barters.length, 0);
    assert.equal(data.crafts.length, 1);
    assert.deepEqual(data.stations.map((entry) => entry.id), ["workbench"]);
    assert.equal("levels" in data.stations[0], false);
    assert.equal(data.errors.barters, "Barter data could not be loaded.");
    assert.equal(data.errors.crafts, null);
});
