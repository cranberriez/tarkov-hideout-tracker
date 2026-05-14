import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types.ts";
import { buildQuestItemIndex, deriveQuestItemState } from "./quest-item-index.ts";

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

test("deriveQuestItemState marks quests available when an active prerequisite is only available", () => {
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

    assert.equal(state.relatedQuests[0]?.status, "available");
    assert.equal(state.hasAvailableQuest, true);
});
