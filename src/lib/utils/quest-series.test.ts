import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types";
import {
    applyQuestSeriesMetadata,
    getEssentialQuestSeriesMembership,
    isEssentialQuest,
    prepareQuestSeriesForGameMode,
} from "./quest-series";

const NETWORK_PROVIDER_SERIES = [
    ["625d6ff5ddc94657c21a1625", "Network Provider - Part 1"],
    ["625d6ffaf7308432be1d44c5", "Network Provider - Part 2"],
    ["625d6ffcaa168e51321d69d7", "Assessment - Part 1"],
    ["625d6fff4149f1149b5b12c9", "Assessment - Part 2"],
    ["625d7001c4874104f230c0c5", "Assessment - Part 3"],
    ["625d70031ed3bb5bcc5bd9e5", "Key to the Tower"],
    ["625d7005a4eb80027c4f2e09", "Knock-Knock"],
    ["625d700cc48e6c62a440fab5", "Getting Acquainted"],
] as const;

function makeQuest(
    id: string,
    name: string,
    traderName = "Mechanic",
    lightkeeperRequired = false,
): FullQuest {
    return {
        id,
        name,
        normalizedName: name.toLowerCase().replaceAll(" ", "-"),
        minPlayerLevel: 1,
        experience: 0,
        trader: {
            id: traderName.toLowerCase(),
            name: traderName,
            normalizedName: traderName.toLowerCase(),
        },
        taskRequirements: [],
        traderRequirements: [],
        otherRequirements: [],
        objectives: [],
        lightkeeperRequired,
    };
}

test("defines the full Network Provider access line as one ordered essential series", () => {
    assert.deepEqual(
        NETWORK_PROVIDER_SERIES.map(([questId]) => {
            const membership = getEssentialQuestSeriesMembership(questId);
            return [membership?.series.id, membership?.order, isEssentialQuest(questId)];
        }),
        NETWORK_PROVIDER_SERIES.map((_, index) => ["network-provider", index + 1, true]),
    );
});

test("keeps Good Times Part 2 in its reviewed Essential display series", () => {
    const expectedMembers = [
        "666314b4d7f171c4c20226c3",
        "666314b0acf8442f8b0531a1",
        "666314b2a9290f9e0806cca3",
        "666314bafd5ca9577902e03a",
    ];

    assert.deepEqual(
        expectedMembers.map((questId) => {
            const membership = getEssentialQuestSeriesMembership(questId);
            return [membership?.series.id, membership?.order];
        }),
        expectedMembers.map((_, index) => ["the-good-times", index + 1]),
    );
});

test("marks every Network Provider series member as Lightkeeper-required", () => {
    const quests = NETWORK_PROVIDER_SERIES.map(([id, name]) => makeQuest(id, name));
    const prepared = applyQuestSeriesMetadata(quests);

    assert.equal(prepared.every((quest) => quest.lightkeeperRequired), true);
    assert.equal(quests.every((quest) => !quest.lightkeeperRequired), true);
});

test("removes Lightkeeper and his prerequisite series from seasonal quest data", () => {
    const quests = [
        makeQuest(...NETWORK_PROVIDER_SERIES[0]),
        makeQuest("lightkeeper-task", "Information Source", "Lightkeeper"),
        makeQuest("ordinary-task", "Ordinary Quest", "Mechanic"),
    ];

    assert.deepEqual(
        prepareQuestSeriesForGameMode(quests, "pvp-season").map((quest) => quest.id),
        ["ordinary-task"],
    );
    assert.equal(prepareQuestSeriesForGameMode(quests, "regular").length, 3);
});
