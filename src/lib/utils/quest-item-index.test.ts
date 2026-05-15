import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types.ts";
import { buildQuestItemIndex, deriveQuestItemState, deriveQuestItemStates } from "./quest-item-index.ts";

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

test("deriveQuestItemState keeps quests future when their prerequisite is only active", () => {
    const quests = [
        makeQuest({ id: "root", name: "Debut" }),
        makeQuest({
            id: "follow-up",
            name: "Checking",
            taskRequirements: [{ task: { id: "root", name: "Debut" }, status: ["complete", "active"] }],
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
    });

    assert.equal(state.relatedQuests[0]?.status, "future");
    assert.equal(state.hasAvailableQuest, false);
});

test("deriveQuestItemStates caps quest demand by max depth from strictly available quests", () => {
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

    const depthOne = deriveQuestItemStates(questItemIndex, { ...baseOptions, maxDepth: 1 });
    const depthTwo = deriveQuestItemStates(questItemIndex, { ...baseOptions, maxDepth: 2 });
    const depthThree = deriveQuestItemStates(questItemIndex, { ...baseOptions, maxDepth: 3 });

    assert.deepEqual(depthOne.map((entry) => entry.itemId), []);
    assert.deepEqual(depthTwo.map((entry) => entry.itemId), ["bolts"]);
    assert.deepEqual(depthThree.map((entry) => entry.itemId), ["bolts", "screws"]);
    assert.equal(depthTwo[0]?.relatedQuests[0]?.status, "future");
});
