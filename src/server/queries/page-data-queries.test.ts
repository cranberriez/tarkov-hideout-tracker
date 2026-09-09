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
import { getKappaChecklistPageData, COLLECTOR_QUEST_ID_BY_MODE } from "./getKappaChecklistPageData";
import { getItemPriceResponse } from "./getDeferredPrices";

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
        questNames: TarkovDataRepository["quests"]["getByIds"];
        items: TarkovDataRepository["items"]["getByIds"];
        prices: TarkovDataRepository["prices"]["getCurrent"];
        barters: TarkovDataRepository["recipes"]["getBarters"];
        crafts: TarkovDataRepository["recipes"]["getCrafts"];
        traders: TarkovDataRepository["traders"]["getAll"];
    }>,
): TarkovDataRepository {
    const forbidden = async (): Promise<never> => {
        throw new Error("Unexpected repository call");
    };
    return {
        items: { getByIds: overrides.items ?? forbidden },
        hideout: { getStations: overrides.stations ?? forbidden },
        quests: { getAll: overrides.quests ?? forbidden, getByIds: overrides.questNames ?? forbidden },
        traders: { getAll: overrides.traders ?? forbidden, getByIds: forbidden },
        recipes: {
            getBarters: overrides.barters ?? forbidden,
            getCrafts: overrides.crafts ?? forbidden,
        },
        prices: { getCurrent: overrides.prices ?? forbidden, getHistory: forbidden },
    };
}

test("unpriced page reads finish without calling prices and retain unresolved requirements", async () => {
    let priceCalls = 0;
    const repository = createRepository({
        stations: async () => result([station]),
        quests: async () => result([quest]),
        questNames: async () => result({ [COLLECTOR_QUEST_ID_BY_MODE.regular]: quest }),
        items: async () => result({}),
        prices: async () => { priceCalls++; return new Promise(() => {}); },
    });
    for (const query of [getHideoutPageData, getItemChecklistPageData, getQuestWorkspacePageData, getKappaChecklistPageData]) {
        const data = await query("regular", repository, { includePrices: false });
        assert.equal(data.errors.prices, null);
        assert.equal(data.freshness.pricesUpdatedAt, null);
        assert.ok(data.unresolvedItemIds.includes("item-a"));
    }
    assert.equal(priceCalls, 0);
});

test("named checklist price scope matches checklist IDs without loading item records", async () => {
    const itemId = "000000000000000000000001";
    const rewardId = "000000000000000000000002";
    const priceStation = { ...station, levels: station.levels.map((level) => ({ ...level,
        itemRequirements: level.itemRequirements.map((requirement) => ({ ...requirement, itemId })),
    })) };
    const priceQuest: FullQuest = { ...quest, finishItemRewards: [{ itemId: rewardId, count: 1 }], objectives: [{
        id: "give", type: "giveItem", description: "Give", optional: false, count: 1, foundInRaid: false, itemIds: [itemId],
    }] };
    for (const mode of ["regular", "pve", "pvp-season"] as const) {
        const calls: string[][] = [];
        const repository = createRepository({
            stations: async () => result([priceStation]), quests: async () => result([priceQuest]),
            prices: async (requestedMode, ids) => {
                assert.equal(requestedMode, mode);
                calls.push([...ids]);
                return result({ [itemId]: { price: 17 } });
            },
        });
        const response = await getItemPriceResponse({ mode, scope: "checklist" }, repository);
        const page = await getItemChecklistPageData(mode, { ...repository, items: { getByIds: async () => result({}) } }, { includePrices: false });
        assert.deepEqual(response.itemIds, [...page.itemIds].sort());
        assert.deepEqual(calls, [response.itemIds]);
        assert.ok(!response.itemIds.includes(rewardId), "reward-only items are excluded");
        assert.equal(response.prices[itemId].price, 17);
    }
});

test("failed named price scopes reject instead of returning cacheable partial prices", async () => {
    let priceCalls = 0;
    const repository = createRepository({
        stations: async () => result([station]),
        quests: async () => { throw new Error("quest read failed"); },
        prices: async () => { priceCalls++; return result({}); },
    });
    await assert.rejects(getItemPriceResponse({ mode: "regular", scope: "checklist" }, repository), /quest read failed/);
    await assert.rejects(getItemPriceResponse({ mode: "regular", scope: "recipes" }, repository));
    assert.equal(priceCalls, 0);
});

test("unpriced profit metadata does not read prices; recipe price scope reads both graphs", async () => {
    let priceCalls = 0;
    const repository = createRepository({
        barters: async () => result([{ id: "barter", offeredItemId: "000000000000000000000001", offeredCount: 1, traderId: "trader", minTraderLevel: 1, requiredItems: [{ itemId: "000000000000000000000002", count: 1 }, { itemId: "customdogtags12345678910", count: 1 }] }]),
        crafts: async () => result([]),
        items: async () => result({}), traders: async () => result([]),
        prices: async () => { priceCalls++; return result({}); },
    });
    const data = await getProfitPageData("regular", repository, { includePrices: false });
    assert.equal(priceCalls, 0);
    assert.equal(data.freshness.pricesUpdatedAt, null);
    assert.equal(data.errors.prices, null);
    const prices = await getItemPriceResponse({ mode: "regular", scope: "recipes" }, repository);
    assert.deepEqual(prices.itemIds, ["000000000000000000000001", "000000000000000000000002"]);
    assert.ok(data.itemIds.includes("customdogtags12345678910"), "synthetic requirements remain in the recipe graph");
    assert.equal(priceCalls, 1);
});

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

test("profit trader payload includes cash-only traders referenced by graph items", async () => {
    const cashOffer = {
        traderId: "cash-trader",
        price: 53,
        priceRUB: 6_625,
        currency: "USD",
        currencyItemId: "dollars",
        minTraderLevel: 2,
    };
    const repository = createRepository({
        barters: async () => result([]),
        crafts: async () => result([{
            id: "craft-1", productItemId: "item-a", productCount: 1,
            stationId: "workbench", level: 1, duration: 10,
            requiredItems: [{ itemId: "item-b", count: 1 }],
            requiredQuestItems: [], gameEditions: [],
        }]),
        items: async () => result({
            "item-a": { id: "item-a", name: "A", normalizedName: "a" },
            "item-b": {
                id: "item-b", name: "B", normalizedName: "b",
                buyFromTrader: [cashOffer],
            },
        }),
        prices: async () => result({}),
        traders: async () => result([
            { id: "cash-trader", name: "Cash Trader", normalizedName: "cash trader" },
            { id: "unused", name: "Unused", normalizedName: "unused" },
        ]),
        stations: async () => result([station]),
    });

    const data = await getProfitPageData("regular", repository);

    assert.deepEqual(data.traders.map((trader) => trader.id), ["cash-trader"]);
    assert.equal(data.items?.find((entry) => entry.id === "item-b")?.buyFromTrader?.[0]?.price, 53);
});

test("profit resolves only referenced unlock names and preserves requirements when names fail", async () => {
    for (const mode of ["regular", "pve", "pvp-season"] as const) {
        const calls: string[][] = [];
        const recipe = {
            id: "craft", productItemId: "item-a", productCount: 1,
            stationId: "workbench", level: 3, duration: 10, taskUnlockId: "quest-1",
            requiredItems: [{ itemId: "item-b", count: 1 }], requiredQuestItems: [], gameEditions: [],
        };
        const repository = createRepository({
            barters: async () => result([]),
            crafts: async () => result([recipe]),
            items: async () => result({
                "item-a": { id: "item-a", name: "A", normalizedName: "a" },
                "item-b": {
                    id: "item-b", name: "B", normalizedName: "b",
                    buyFromTrader: ["quest-1", "missing"].map((taskUnlockId) => ({
                        traderId: "trader", price: 1, priceRUB: 1, currency: "RUB",
                        currencyItemId: "roubles", minTraderLevel: 1, taskUnlockId,
                    })),
                },
            }),
            prices: async () => result({}), traders: async () => result([]),
            stations: async () => result([station]),
            questNames: async (requestedMode, ids) => {
                assert.equal(requestedMode, mode);
                calls.push([...ids]);
                return result({ "quest-1": quest }, 42);
            },
        });
        const data = await getProfitPageData(mode, repository);
        assert.deepEqual(calls, [["quest-1", "missing"]]);
        assert.deepEqual(data.taskUnlocksById, { "quest-1": { id: "quest-1", name: "Quest", wikiLink: undefined } });
        assert.deepEqual(data.unresolvedTaskUnlockIds, ["missing"]);
        assert.equal(data.freshness.taskUnlocksUpdatedAt, 42);
        assert.match(data.errors.taskUnlocks!, /Some quest names/);
        repository.quests.getByIds = async () => { throw new Error("unavailable"); };
        const failed = await getProfitPageData(mode, repository);
        assert.deepEqual(failed.crafts, [recipe]);
        assert.equal(failed.errors.crafts, null);
        assert.equal(failed.items?.length, 2);
        assert.deepEqual(failed.unresolvedTaskUnlockIds, ["quest-1", "missing"]);
        assert.match(failed.errors.taskUnlocks!, /could not be loaded/);
    }
});
