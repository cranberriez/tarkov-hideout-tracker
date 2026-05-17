import test from "node:test";
import assert from "node:assert/strict";
import type { FullQuest } from "../../types/types";
import { collectCompleteCascade } from "./quest-cascade";
import { NETWORK_PROVIDER_PART_1_ID } from "../../lib/utils/sensitive-quest-backfill";

const prapor = { id: "prapor", name: "Prapor", normalizedName: "prapor", imageLink: null, image4xLink: null };
const therapist = { id: "therapist", name: "Therapist", normalizedName: "therapist", imageLink: null, image4xLink: null };

function makeQuest(overrides: Partial<FullQuest> & Pick<FullQuest, "id" | "name">): FullQuest {
    return {
        id: overrides.id,
        name: overrides.name,
        normalizedName: overrides.normalizedName ?? overrides.name.toLowerCase().replace(/\s+/g, "-"),
        experience: 1000,
        trader: overrides.trader ?? prapor,
        taskRequirements: overrides.taskRequirements ?? [],
        traderRequirements: [],
        requiredPrestige: null,
        objectives: [],
        wikiLink: null,
        minPlayerLevel: 1,
        kappaRequired: false,
        lightkeeperRequired: false,
        factionName: null,
        map: null,
    };
}

function buildQuestsById(quests: FullQuest[]) {
    return new Map(quests.map((quest) => [quest.id, quest]));
}

test("collectCompleteCascade returns just the root when there are no prereqs", () => {
    const quests = [makeQuest({ id: "root", name: "Root" })];
    const result = collectCompleteCascade("root", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.toComplete, ["root"]);
    assert.deepEqual(result.crossTraderQuestIds, []);
    assert.deepEqual(result.sensitiveQuestIds, []);
});

test("collectCompleteCascade walks transitive prereqs and skips already-complete ones", () => {
    const quests = [
        makeQuest({ id: "a", name: "A" }),
        makeQuest({ id: "b", name: "B", taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }] }),
        makeQuest({ id: "c", name: "C", taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }] }),
    ];
    const result = collectCompleteCascade("c", {
        questsById: buildQuestsById(quests),
        completedQuests: { a: true },
    });

    assert.deepEqual(result.toComplete.sort(), ["b", "c"]);
});

test("collectCompleteCascade flags cross-trader prereqs relative to the root", () => {
    const quests = [
        makeQuest({ id: "ther-root", name: "T", trader: therapist }),
        makeQuest({
            id: "prap-leaf",
            name: "P",
            taskRequirements: [{ task: { id: "ther-root", name: "T" }, status: ["Success"] }],
        }),
    ];
    const result = collectCompleteCascade("prap-leaf", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.toComplete.sort(), ["prap-leaf", "ther-root"]);
    assert.deepEqual(result.crossTraderQuestIds, ["ther-root"]);
});

test("collectCompleteCascade flags sensitive backfill quests in the chain", () => {
    const quests = [
        makeQuest({ id: NETWORK_PROVIDER_PART_1_ID, name: "Network Provider" }),
        makeQuest({
            id: "leaf",
            name: "Leaf",
            taskRequirements: [
                { task: { id: NETWORK_PROVIDER_PART_1_ID, name: "Network Provider" }, status: ["Success"] },
            ],
        }),
    ];
    const result = collectCompleteCascade("leaf", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.sensitiveQuestIds, [NETWORK_PROVIDER_PART_1_ID]);
});

test("collectCompleteCascade returns empty toComplete when root is already complete", () => {
    const quests = [makeQuest({ id: "root", name: "Root" })];
    const result = collectCompleteCascade("root", {
        questsById: buildQuestsById(quests),
        completedQuests: { root: true },
    });

    assert.deepEqual(result.toComplete, []);
});

test("collectCompleteCascade survives cycles", () => {
    const quests = [
        makeQuest({ id: "a", name: "A", taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }] }),
        makeQuest({ id: "b", name: "B", taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }] }),
    ];
    const result = collectCompleteCascade("a", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.toComplete.sort(), ["a", "b"]);
});
