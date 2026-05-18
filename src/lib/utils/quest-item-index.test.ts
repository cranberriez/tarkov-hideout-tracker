import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types";
import { buildQuestItemIndex, deriveQuestItemState, deriveQuestItemStates } from "./quest-item-index";

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
