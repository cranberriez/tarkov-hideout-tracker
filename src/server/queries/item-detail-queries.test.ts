import assert from "node:assert/strict";
import test from "node:test";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { DataResult, TarkovDataMode } from "@/types/common";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import type { FullQuest } from "@/types/quests";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { Trader } from "@/types/traders";
import { getItemAcquisitionTreeData } from "./getItemAcquisitionTreeData";
import { getItemRelationsData } from "./getItemRelationsData";
import { getItemUsageData } from "./getItemUsageData";

function result<T>(data: T, updatedAt = 1): DataResult<T> {
    return { data, updatedAt, diagnostics: { provider: "json" } };
}

interface RepositoryOverrides {
    items?: TarkovDataRepository["items"]["getByIds"];
    stations?: TarkovDataRepository["hideout"]["getStations"];
    quests?: TarkovDataRepository["quests"]["getAll"];
    questsById?: TarkovDataRepository["quests"]["getByIds"];
    tradersById?: TarkovDataRepository["traders"]["getByIds"];
    barters?: TarkovDataRepository["recipes"]["getBarters"];
    crafts?: TarkovDataRepository["recipes"]["getCrafts"];
    prices?: TarkovDataRepository["prices"]["getCurrent"];
    history?: TarkovDataRepository["prices"]["getHistory"];
}

function createRepository(overrides: RepositoryOverrides): TarkovDataRepository {
    const forbidden = async (): Promise<never> => {
        throw new Error("Unexpected repository call");
    };
    return {
        items: { getByIds: overrides.items ?? forbidden },
        hideout: { getStations: overrides.stations ?? forbidden },
        quests: {
            getAll: overrides.quests ?? forbidden,
            getByIds: overrides.questsById ?? forbidden,
        },
        traders: { getAll: forbidden, getByIds: overrides.tradersById ?? forbidden },
        recipes: {
            getBarters: overrides.barters ?? forbidden,
            getCrafts: overrides.crafts ?? forbidden,
        },
        prices: {
            getCurrent: overrides.prices ?? forbidden,
            getHistory: overrides.history ?? forbidden,
        },
    };
}

function item(id: string): ItemSummary {
    return { id, name: id, normalizedName: id };
}

function fullQuest(
    id: string,
    options: {
        prerequisiteId?: string;
        objectiveItemIds?: string[];
        rewardItemId?: string;
    } = {},
): FullQuest {
    return {
        id,
        name: id,
        normalizedName: id,
        experience: 0,
        trader: { id: "trader-a", name: "Trader A", normalizedName: "trader-a" },
        taskRequirements: options.prerequisiteId
            ? [
                  {
                      task: { id: options.prerequisiteId, name: options.prerequisiteId },
                      status: ["complete"],
                  },
              ]
            : [],
        traderRequirements: [],
        otherRequirements: [],
        finishItemRewards: options.rewardItemId
            ? [{ itemId: options.rewardItemId, count: 2 }]
            : [],
        objectives: options.objectiveItemIds
            ? [
                  {
                      id: `${id}-give`,
                      type: "giveItem",
                      description: "Hand over items",
                      optional: false,
                      count: 1,
                      foundInRaid: false,
                      itemIds: options.objectiveItemIds,
                  },
              ]
            : [],
    };
}

test("usage requests only records referenced by the selected item's recipes", async () => {
    const calls = {
        items: [] as string[][],
        prices: [] as string[][],
        traders: [] as string[][],
        quests: [] as string[][],
        stations: [] as TarkovDataMode[],
    };
    const barters: BarterRecord[] = [
        {
            id: "barter-root",
            offeredItemId: "root-item",
            offeredCount: 1,
            traderId: "trader-a",
            minTraderLevel: 1,
            taskUnlockId: "unlock-a",
            requiredItems: [
                { itemId: "input-a", count: 2 },
                { itemId: "missing-item", count: 1 },
            ],
        },
        {
            id: "barter-unrelated",
            offeredItemId: "unrelated-item",
            offeredCount: 1,
            traderId: "trader-b",
            minTraderLevel: 1,
            taskUnlockId: "unlock-b",
            requiredItems: [{ itemId: "unrelated-input", count: 1 }],
        },
    ];
    const crafts: CraftRecord[] = [
        {
            id: "craft-root",
            productItemId: "root-item",
            productCount: 1,
            stationId: "workbench",
            level: 1,
            duration: 10,
            taskUnlockId: "unlock-c",
            requiredItems: [{ itemId: "input-c", count: 1 }],
            requiredQuestItems: [{ itemId: "quest-input", count: 1 }],
            gameEditions: [],
        },
    ];
    const repository = createRepository({
        barters: async () => result(barters, 10),
        crafts: async () => result(crafts, 20),
        items: async (_mode, ids) => {
            calls.items.push([...ids]);
            return result(
                Object.fromEntries(
                    ids
                        .filter((id) => id !== "missing-item")
                        .map((id) => [id, item(id)]),
                ),
                30,
            );
        },
        prices: async (_mode, ids) => {
            calls.prices.push([...ids]);
            return result(
                Object.fromEntries(ids.map((id) => [id, { price: id.length }])) as Record<
                    string,
                    CurrentPrice
                >,
                40,
            );
        },
        tradersById: async (_mode, ids) => {
            calls.traders.push([...ids]);
            return result(
                {
                    "trader-a": {
                        id: "trader-a",
                        name: "Trader A",
                        normalizedName: "trader-a",
                    },
                    "trader-extra": {
                        id: "trader-extra",
                        name: "Extra",
                        normalizedName: "extra",
                    },
                } satisfies Record<string, Trader>,
                50,
            );
        },
        questsById: async (_mode, ids) => {
            calls.quests.push([...ids]);
            return result(
                {
                    "unlock-a": fullQuest("unlock-a"),
                    "unlock-c": fullQuest("unlock-c"),
                    "unlock-extra": fullQuest("unlock-extra"),
                },
                60,
            );
        },
        stations: async (mode) => {
            calls.stations.push(mode);
            return result(
                [
                    {
                        id: "workbench",
                        name: "Workbench",
                        normalizedName: "workbench",
                        imageLink: "workbench.png",
                        levels: [],
                    },
                    {
                        id: "extra-station",
                        name: "Extra",
                        normalizedName: "extra",
                        levels: [],
                    },
                ],
                70,
            );
        },
    });

    const data = await getItemUsageData("root-item", "pve", repository);
    const referencedIds = [
        "root-item",
        "input-a",
        "missing-item",
        "input-c",
        "quest-input",
    ];

    assert.deepEqual(calls.items, [referencedIds]);
    assert.deepEqual(calls.prices, [referencedIds]);
    assert.deepEqual(calls.traders, [["trader-a"]]);
    assert.deepEqual(calls.quests, [["unlock-a", "unlock-c"]]);
    assert.deepEqual(calls.stations, ["pve"]);
    assert.deepEqual(data.barters.map((record) => record.id), ["barter-root"]);
    assert.deepEqual(data.crafts.map((record) => record.id), ["craft-root"]);
    assert.deepEqual(Object.keys(data.tradersById), ["trader-a"]);
    assert.deepEqual(Object.keys(data.taskUnlocksById), ["unlock-a", "unlock-c"]);
    assert.deepEqual(data.stationsById, {
        workbench: {
            id: "workbench",
            name: "Workbench",
            normalizedName: "workbench",
            imageLink: "workbench.png",
        },
    });
    assert.equal(data.freshness.stationsUpdatedAt, 70);
    assert.deepEqual(data.unresolvedItemIds, ["missing-item"]);
    assert.deepEqual(
        data.items.map((record) => record.id),
        ["root-item", "input-a", "input-c", "quest-input"],
    );
});

test("usage keeps barter data when craft loading fails", async () => {
    const repository = createRepository({
        barters: async () =>
            result([
                {
                    id: "barter-root",
                    offeredItemId: "root-item",
                    offeredCount: 1,
                    traderId: "trader-a",
                    minTraderLevel: 1,
                    requiredItems: [{ itemId: "input-a", count: 1 }],
                },
            ]),
        crafts: async () => {
            throw new Error("crafts unavailable");
        },
        items: async (_mode, ids) =>
            result(Object.fromEntries(ids.map((id) => [id, item(id)]))),
        prices: async () => result({}),
        tradersById: async () => result({}),
    });

    const data = await getItemUsageData("root-item", "regular", repository);

    assert.deepEqual(data.barters.map((record) => record.id), ["barter-root"]);
    assert.deepEqual(data.crafts, []);
    assert.equal(data.bartersError, undefined);
    assert.equal(data.craftsError, "Craft data is temporarily unavailable");
    assert.deepEqual(data.itemIds, ["root-item", "input-a"]);
    assert.deepEqual(data.stationsById, {});
    assert.equal(data.freshness.stationsUpdatedAt, null);
});

test("usage keeps craft data when station presentation fails", async () => {
    const repository = createRepository({
        barters: async () => result([]),
        crafts: async () =>
            result([
                {
                    id: "craft-root",
                    productItemId: "root-item",
                    productCount: 1,
                    stationId: "workbench",
                    level: 1,
                    duration: 10,
                    requiredItems: [],
                    requiredQuestItems: [],
                    gameEditions: [],
                },
            ]),
        items: async (_mode, ids) =>
            result(Object.fromEntries(ids.map((id) => [id, item(id)]))),
        prices: async () => result({}),
        stations: async () => {
            throw new Error("stations unavailable");
        },
    });

    const data = await getItemUsageData("root-item", "regular", repository);

    assert.deepEqual(data.crafts.map((record) => record.id), ["craft-root"]);
    assert.equal(data.craftsError, undefined);
    assert.deepEqual(data.stationsById, {});
    assert.equal(data.freshness.stationsUpdatedAt, null);
    assert.equal(
        data.presentationError,
        "Acquisition labels are temporarily unavailable",
    );
});

test("acquisition graph fetches priced summaries for every graph reference", async () => {
    const itemCalls: string[][] = [];
    const priceCalls: string[][] = [];
    const repository = createRepository({
        barters: async () =>
            result(
                [
                    {
                        id: "barter-root",
                        offeredItemId: "root-item",
                        offeredCount: 1,
                        traderId: "trader-a",
                        minTraderLevel: 1,
                        requiredItems: [{ itemId: "input-a", count: 1 }],
                    },
                    {
                        id: "barter-a",
                        offeredItemId: "input-a",
                        offeredCount: 1,
                        traderId: "trader-a",
                        minTraderLevel: 1,
                        requiredItems: [{ itemId: "input-b", count: 1 }],
                    },
                    {
                        id: "barter-unrelated",
                        offeredItemId: "unrelated-item",
                        offeredCount: 1,
                        traderId: "trader-a",
                        minTraderLevel: 1,
                        requiredItems: [],
                    },
                ],
                10,
            ),
        crafts: async () =>
            result(
                [
                    {
                        id: "craft-root",
                        productItemId: "root-item",
                        productCount: 1,
                        stationId: "workbench",
                        level: 1,
                        duration: 10,
                        requiredItems: [{ itemId: "input-c", count: 1 }],
                        requiredQuestItems: [{ itemId: "missing-quest-input", count: 1 }],
                        gameEditions: [],
                    },
                ],
                20,
            ),
        items: async (_mode, ids) => {
            itemCalls.push([...ids]);
            return result(
                Object.fromEntries(
                    ids
                        .filter((id) => id !== "missing-quest-input")
                        .map((id) => [id, item(id)]),
                ),
                30,
            );
        },
        prices: async (_mode, ids) => {
            priceCalls.push([...ids]);
            return result({}, 40);
        },
    });

    const data = await getItemAcquisitionTreeData("root-item", "pvp-season", repository);
    const expectedIds = [
        "root-item",
        "input-a",
        "input-b",
        "input-c",
        "missing-quest-input",
    ];

    assert.deepEqual(itemCalls, [expectedIds]);
    assert.deepEqual(priceCalls, [expectedIds]);
    assert.deepEqual(data.itemIds, expectedIds);
    assert.deepEqual(data.unresolvedItemIds, ["missing-quest-input"]);
    assert.deepEqual(data.barters.map((record) => record.id), ["barter-root", "barter-a"]);
    assert.deepEqual(data.crafts.map((record) => record.id), ["craft-root"]);
    assert.deepEqual(data.errors, {
        barters: null,
        crafts: null,
        items: null,
        prices: null,
    });
});

test("acquisition graph keeps barter routes when craft loading fails", async () => {
    const repository = createRepository({
        barters: async () =>
            result(
                [
                    {
                        id: "barter-root",
                        offeredItemId: "root-item",
                        offeredCount: 1,
                        traderId: "trader-a",
                        minTraderLevel: 1,
                        requiredItems: [{ itemId: "input-a", count: 1 }],
                    },
                ],
                10,
            ),
        crafts: async () => {
            throw new Error("crafts unavailable");
        },
        items: async (_mode, ids) =>
            result(Object.fromEntries(ids.map((id) => [id, item(id)])), 20),
        prices: async () => result({}, 30),
    });

    const data = await getItemAcquisitionTreeData("root-item", "regular", repository);

    assert.deepEqual(data.barters.map((record) => record.id), ["barter-root"]);
    assert.deepEqual(data.crafts, []);
    assert.equal(data.errors.barters, null);
    assert.equal(data.errors.crafts, "Craft data is temporarily unavailable");
    assert.equal(data.freshness.bartersUpdatedAt, 10);
    assert.equal(data.freshness.craftsUpdatedAt, null);
});

test("relations return only matching hideout and quest data with prerequisite availability", async () => {
    const itemCalls: string[][] = [];
    const priceCalls: string[][] = [];
    const stations: Station[] = [
        {
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
                            id: "target-requirement",
                            itemId: "target-item",
                            count: 2,
                            isFir: false,
                            isTool: false,
                        },
                        {
                            id: "other-requirement",
                            itemId: "other-item",
                            count: 1,
                            isFir: false,
                            isTool: false,
                        },
                    ],
                    stationLevelRequirements: [],
                    skillRequirements: [],
                    traderRequirements: [],
                },
            ],
        },
        {
            id: "unrelated-station",
            name: "Unrelated",
            normalizedName: "unrelated",
            levels: [],
        },
    ];
    const quests = [
        fullQuest("prerequisite"),
        fullQuest("demand", {
            prerequisiteId: "prerequisite",
            objectiveItemIds: ["target-item"],
        }),
        fullQuest("any-of", {
            objectiveItemIds: ["target-item", "alternate-item", "missing-alternate"],
        }),
        fullQuest("reward", { rewardItemId: "target-item" }),
        fullQuest("unrelated", { objectiveItemIds: ["other-item"] }),
    ];
    const repository = createRepository({
        stations: async () => result(stations, 10),
        quests: async () => result(quests, 20),
        items: async (_mode, ids) => {
            itemCalls.push([...ids]);
            return result(
                {
                    "target-item": item("target-item"),
                    "alternate-item": item("alternate-item"),
                },
                30,
            );
        },
        prices: async (_mode, ids) => {
            priceCalls.push([...ids]);
            return result({ "target-item": { price: 123 } }, 40);
        },
    });

    const data = await getItemRelationsData("target-item", "regular", repository);

    assert.deepEqual(priceCalls, [["target-item"]]);
    assert.deepEqual(itemCalls, [
        ["target-item", "alternate-item", "missing-alternate"],
    ]);
    assert.equal(data.item?.marketPrice?.price, 123);
    assert.deepEqual(
        data.relatedItems.map((record) => record.id),
        ["target-item", "alternate-item"],
    );
    assert.deepEqual(data.unresolvedItemIds, ["missing-alternate"]);
    assert.deepEqual(
        data.hideoutRequirements.map((relation) => relation.requirement.id),
        ["target-requirement"],
    );
    assert.deepEqual(data.questItemIndex[0].quests.map((entry) => entry.questId), ["demand"]);
    assert.deepEqual(data.questRewardIndex[0].quests.map((entry) => entry.questId), ["reward"]);
    assert.deepEqual(data.questAnyOfGroups.map((group) => group.questId), ["any-of"]);
    assert.deepEqual(
        data.questAvailabilityQuests.map((entry) => entry.id),
        ["any-of", "prerequisite", "reward", "demand"],
    );
});

test("relations expose missing selected items and independent partial errors", async () => {
    const repository = createRepository({
        stations: async () => {
            throw new Error("stations unavailable");
        },
        quests: async () => {
            throw new Error("quests unavailable");
        },
        items: async () => result({}, 30),
        prices: async () => {
            throw new Error("prices unavailable");
        },
    });

    const data = await getItemRelationsData("missing-item", "pve", repository);

    assert.equal(data.item, null);
    assert.deepEqual(data.unresolvedItemIds, ["missing-item"]);
    assert.equal(data.errors.items, null);
    assert.equal(data.errors.prices, "Item price data could not be loaded.");
    assert.equal(data.errors.stations, "Hideout relation data could not be loaded.");
    assert.equal(data.errors.quests, "Quest relation data could not be loaded.");
    assert.deepEqual(data.hideoutRequirements, []);
    assert.deepEqual(data.questAvailabilityQuests, []);
});
