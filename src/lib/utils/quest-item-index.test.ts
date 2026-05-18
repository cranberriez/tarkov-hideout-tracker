import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types";
import {
    buildQuestAnyOfGroups,
    buildQuestItemIndex,
    deriveQuestItemState,
    deriveQuestItemStates,
} from "./quest-item-index";

function makeQuest(overrides: Partial<FullQuest> & Pick<FullQuest, "id" | "name">): FullQuest {
    return {
        id: overrides.id,
        name: overrides.name,
        normalizedName: overrides.normalizedName ?? overrides.name.toLowerCase().replace(/\s+/g, "-"),
        experience: overrides.experience ?? 1000,
        trader: overrides.trader ?? {
            id: "prapor",
            name: "Prapor",
            normalizedName: "prapor",
            imageLink: null,
            image4xLink: null,
        },
        taskRequirements: overrides.taskRequirements ?? [],
        traderRequirements: overrides.traderRequirements ?? [],
        requiredPrestige: overrides.requiredPrestige ?? null,
        objectives: overrides.objectives ?? [],
        wikiLink: overrides.wikiLink ?? null,
        minPlayerLevel: overrides.minPlayerLevel ?? 1,
        kappaRequired: overrides.kappaRequired ?? false,
        lightkeeperRequired: overrides.lightkeeperRequired ?? false,
        factionName: overrides.factionName ?? null,
        map: overrides.map ?? null,
    };
}

function makeQuestItem(index: number) {
    return {
        id: `item-${index}`,
        name: `Item ${index}`,
        normalizedName: `item-${index}`,
        iconLink: `/item-${index}.png`,
        gridImageLink: `/item-${index}-grid.png`,
    };
}

test("buildQuestItemIndex excludes broad any item objectives from exact item demand", () => {
    const quests = [
        makeQuest({
            id: "broad-any",
            name: "Bulk Sale",
            objectives: [
                {
                    id: "obj-any",
                    type: "giveItem",
                    description: "Sell any item to the trader",
                    optional: false,
                    count: 20,
                    foundInRaid: false,
                    items: Array.from({ length: 24 }, (_, index) => makeQuestItem(index + 1)),
                },
            ],
        }),
    ];

    assert.deepEqual(buildQuestItemIndex(quests), []);
});

test("buildQuestAnyOfGroups marks broad any item objectives as partial previews", () => {
    const quests = [
        makeQuest({
            id: "broad-any",
            name: "Bulk Sale",
            objectives: [
                {
                    id: "obj-any",
                    type: "giveItem",
                    description: "Sell any item to the trader",
                    optional: false,
                    count: 20,
                    foundInRaid: false,
                    items: Array.from({ length: 24 }, (_, index) => makeQuestItem(index + 1)),
                },
            ],
        }),
    ];

    const [group] = buildQuestAnyOfGroups(quests);

    assert.equal(group?.isPartial, true);
    assert.equal(group?.totalItemCount, 24);
    assert.equal(group?.items.length, 15);
    assert.deepEqual(group?.items.map((item) => item.id), [
        "item-1",
        "item-2",
        "item-3",
        "item-4",
        "item-5",
        "item-6",
        "item-7",
        "item-8",
        "item-9",
        "item-10",
        "item-11",
        "item-12",
        "item-13",
        "item-14",
        "item-15",
    ]);
});

test("buildQuestAnyOfGroups keeps small any-of objectives complete", () => {
    const quests = [
        makeQuest({
            id: "small-any",
            name: "Medical Choice",
            objectives: [
                {
                    id: "obj-small",
                    type: "giveItem",
                    description: "Hand over any medicine item",
                    optional: false,
                    count: 3,
                    foundInRaid: true,
                    items: [makeQuestItem(1), makeQuestItem(2), makeQuestItem(3)],
                },
            ],
        }),
    ];

    const [group] = buildQuestAnyOfGroups(quests);

    assert.equal(group?.isPartial, false);
    assert.equal(group?.totalItemCount, 3);
    assert.equal(group?.items.length, 3);
});

test("deriveQuestItemState keeps quests future when their active-only prerequisite is not available", () => {
    const quests = [
        makeQuest({ id: "root", name: "Debut", minPlayerLevel: 99 }),
        makeQuest({
            id: "follow-up",
            name: "Checking",
            taskRequirements: [{ task: { id: "root", name: "Debut" }, status: ["active"] }],
            objectives: [
                {
                    id: "obj-1",
                    type: "giveItem",
                    description: "Hand in item",
                    optional: false,
                    count: 2,
                    foundInRaid: false,
                    items: [
                        {
                            id: "bolts",
                            name: "Bolts",
                            normalizedName: "bolts",
                            iconLink: "/bolts.png",
                            gridImageLink: "/bolts-grid.png",
                        },
                    ],
                },
            ],
        }),
    ];

    const entry = buildQuestItemIndex(quests)[0];
    const state = deriveQuestItemState(entry, {
        completedQuests: {},
        ignoredQuests: {},
        pinnedQuests: {},
        playerLevel: 30,
        prestigeLevel: 0,
        faction: "USEC",
        traderLoyaltyLevels: { prapor: 3 },
        quests,
        visibilityMode: "allFuture",
    });

    assert.equal(state.relatedQuests[0]?.status, "future");
    assert.equal(state.hasAvailableQuest, false);
});

test("deriveQuestItemState treats completed active-only prerequisites as available", () => {
    const quests = [
        makeQuest({ id: "root", name: "Introduction" }),
        makeQuest({
            id: "follow-up",
            name: "Supplier",
            taskRequirements: [{ task: { id: "root", name: "Introduction" }, status: ["active"] }],
            objectives: [
                {
                    id: "obj-1",
                    type: "giveItem",
                    description: "Hand in item",
                    optional: false,
                    count: 2,
                    foundInRaid: false,
                    items: [
                        {
                            id: "bolts",
                            name: "Bolts",
                            normalizedName: "bolts",
                            iconLink: "/bolts.png",
                            gridImageLink: "/bolts-grid.png",
                        },
                    ],
                },
            ],
        }),
    ];

    const entry = buildQuestItemIndex(quests)[0];
    const state = deriveQuestItemState(entry, {
        completedQuests: { root: true },
        ignoredQuests: {},
        pinnedQuests: {},
        playerLevel: 30,
        prestigeLevel: 0,
        faction: "USEC",
        traderLoyaltyLevels: { prapor: 3 },
        quests,
    });

    assert.equal(state.relatedQuests[0]?.status, "available");
    assert.equal(state.hasAvailableQuest, true);
});

test("deriveQuestItemStates includes next layer quest demand from available roots", () => {
    const quests = [
        makeQuest({ id: "root", name: "Debut" }),
        makeQuest({
            id: "depth-2",
            name: "Checking",
            taskRequirements: [{ task: { id: "root", name: "Debut" }, status: ["complete"] }],
            objectives: [
                {
                    id: "obj-1",
                    type: "giveItem",
                    description: "Hand in bolts",
                    optional: false,
                    count: 2,
                    foundInRaid: false,
                    items: [
                        {
                            id: "bolts",
                            name: "Bolts",
                            normalizedName: "bolts",
                            iconLink: "/bolts.png",
                            gridImageLink: "/bolts-grid.png",
                        },
                    ],
                },
            ],
        }),
        makeQuest({
            id: "depth-3",
            name: "Bad Rep Evidence",
            taskRequirements: [{ task: { id: "depth-2", name: "Checking" }, status: ["complete"] }],
            objectives: [
                {
                    id: "obj-2",
                    type: "giveItem",
                    description: "Hand in screws",
                    optional: false,
                    count: 1,
                    foundInRaid: false,
                    items: [
                        {
                            id: "screws",
                            name: "Screws",
                            normalizedName: "screws",
                            iconLink: "/screws.png",
                            gridImageLink: "/screws-grid.png",
                        },
                    ],
                },
            ],
        }),
    ];

    const questItemIndex = buildQuestItemIndex(quests);
    const baseOptions = {
        completedQuests: {},
        ignoredQuests: {},
        pinnedQuests: {},
        playerLevel: 30,
        prestigeLevel: 0,
        faction: "USEC" as const,
        traderLoyaltyLevels: { prapor: 3 },
        quests,
    };

    const availableOnly = deriveQuestItemStates(questItemIndex, baseOptions);
    const nextLayer = deriveQuestItemStates(questItemIndex, {
        ...baseOptions,
        visibilityMode: "nextLayer",
    });

    assert.deepEqual(availableOnly.map((entry) => entry.itemId), []);
    assert.deepEqual(nextLayer.map((entry) => entry.itemId), ["bolts", "screws"]);
    assert.equal(nextLayer[0]?.relatedQuests[0]?.status, "future");
});

test("deriveQuestItemStates excludes opposing faction quests from override paths", () => {
    const quests = [
        makeQuest({
            id: "bear-fir",
            name: "BEAR FiR hand-in",
            factionName: "BEAR",
            objectives: [
                {
                    id: "obj-1",
                    type: "giveItem",
                    description: "Hand in FiR flash drive",
                    optional: false,
                    count: 1,
                    foundInRaid: true,
                    items: [
                        {
                            id: "flash-drive",
                            name: "Secure Flash drive",
                            normalizedName: "secure-flash-drive",
                            iconLink: "/flash-drive.png",
                            gridImageLink: "/flash-drive-grid.png",
                        },
                    ],
                },
            ],
        }),
        makeQuest({
            id: "bear-pinned",
            name: "BEAR pinned hand-in",
            factionName: "BEAR",
            objectives: [
                {
                    id: "obj-2",
                    type: "giveItem",
                    description: "Hand in bolts",
                    optional: false,
                    count: 2,
                    foundInRaid: false,
                    items: [
                        {
                            id: "bolts",
                            name: "Bolts",
                            normalizedName: "bolts",
                            iconLink: "/bolts.png",
                            gridImageLink: "/bolts-grid.png",
                        },
                    ],
                },
            ],
        }),
    ];

    const states = deriveQuestItemStates(buildQuestItemIndex(quests), {
        completedQuests: {},
        ignoredQuests: {},
        pinnedQuests: { "bear-pinned": true },
        playerLevel: 30,
        prestigeLevel: 0,
        faction: "USEC",
        traderLoyaltyLevels: { prapor: 3 },
        quests,
        showFutureFir: true,
    });

    assert.deepEqual(states.map((entry) => entry.itemId), []);
});
