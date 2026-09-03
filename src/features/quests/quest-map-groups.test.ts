import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest, QuestMap } from "@/types/quests";
import {
    formatQuestMapSummary,
    getQuestMapGroupsForQuest,
    questMatchesSelectedMapGroups,
} from "./quest-map-groups";

const customs: QuestMap = { id: "customs", name: "Customs", normalizedName: "customs" };
const shoreline: QuestMap = { id: "shoreline", name: "Shoreline", normalizedName: "shoreline" };
const woods: QuestMap = { id: "woods", name: "Woods", normalizedName: "woods" };
const labs: QuestMap = { id: "labs", name: "The Lab", normalizedName: "laboratory" };
const factoryDay: QuestMap = {
    id: "factory-day",
    name: "Factory Day",
    normalizedName: "factory-day",
};

function makeQuest(overrides: Partial<FullQuest>): FullQuest {
    return {
        id: "quest",
        name: "Quest",
        normalizedName: "quest",
        experience: 1000,
        map: null,
        trader: {
            id: "prapor",
            name: "Prapor",
            normalizedName: "prapor",
        },
        taskRequirements: [],
        traderRequirements: [],
        otherRequirements: [],
        requiredPrestige: null,
        objectives: [],
        ...overrides,
    };
}

test("getQuestMapGroupsForQuest uses objective maps when quest map is null", () => {
    const quest = makeQuest({
        objectives: [
            {
                id: "obj-1",
                type: "visit",
                description: "Visit Customs",
                optional: false,
                maps: [customs],
            },
            {
                id: "obj-2",
                type: "visit",
                description: "Visit Shoreline",
                optional: false,
                maps: [shoreline],
            },
        ],
    });

    assert.deepEqual(
        getQuestMapGroupsForQuest(quest).map((group) => group.key),
        ["customs", "shoreline"],
    );
});

test("getQuestMapGroupsForQuest dedupes quest and objective map aliases", () => {
    const quest = makeQuest({
        map: factoryDay,
        objectives: [
            {
                id: "obj-1",
                type: "extract",
                description: "Extract from Factory",
                optional: false,
                maps: [factoryDay],
                exitName: "Gate 3",
            },
        ],
    });

    assert.deepEqual(
        getQuestMapGroupsForQuest(quest).map((group) => group.key),
        ["factory"],
    );
});

test("questMatchesSelectedMapGroups treats Any Map quests as matching selected concrete maps", () => {
    const quest = makeQuest({ map: null, objectives: [] });

    assert.equal(questMatchesSelectedMapGroups(quest, new Set(["customs"])), true);
});

test("questMatchesSelectedMapGroups matches any concrete objective map", () => {
    const quest = makeQuest({
        objectives: [
            {
                id: "obj-1",
                type: "visit",
                description: "Visit Customs",
                optional: false,
                maps: [customs],
            },
            {
                id: "obj-2",
                type: "visit",
                description: "Visit Shoreline",
                optional: false,
                maps: [shoreline],
            },
        ],
    });

    assert.equal(questMatchesSelectedMapGroups(quest, new Set(["shoreline"])), true);
    assert.equal(questMatchesSelectedMapGroups(quest, new Set(["woods"])), false);
});

test("formatQuestMapSummary shows ANY for unrestricted and all-map quests", () => {
    const allMaps = [customs, shoreline, woods].map((map) => ({
        key: map.normalizedName,
        name: map.name,
        aliases: [map.normalizedName],
    }));

    assert.equal(formatQuestMapSummary(makeQuest({}), allMaps), "ANY");
    assert.equal(formatQuestMapSummary(makeQuest({
        objectives: [{
            id: "all-maps",
            type: "shoot",
            description: "Eliminate targets",
            optional: false,
            maps: [customs, shoreline, woods],
        }],
    }), allMaps), "ANY");
});

test("formatQuestMapSummary names one or two excluded maps", () => {
    const allMaps = [customs, shoreline, woods, labs].map((map) => ({
        key: map.normalizedName,
        name: map.name,
        aliases: [map.normalizedName],
    }));
    const quest = makeQuest({
        objectives: [{
            id: "most-maps",
            type: "shoot",
            description: "Eliminate targets",
            optional: false,
            maps: [customs, shoreline],
        }],
    });

    assert.equal(formatQuestMapSummary(quest, allMaps), "Any Map, EXCEPT (The Lab, Woods)");
});

test("formatQuestMapSummary lists smaller allowed map sets", () => {
    const allMaps = [customs, shoreline, woods, labs, factoryDay].map((map) => ({
        key: map.normalizedName.includes("factory") ? "factory" : map.normalizedName,
        name: map.name,
        aliases: [map.normalizedName],
    }));
    const quest = makeQuest({
        objectives: [{
            id: "some-maps",
            type: "shoot",
            description: "Eliminate targets",
            optional: false,
            maps: [customs, shoreline],
        }],
    });

    assert.equal(formatQuestMapSummary(quest, allMaps), "Customs · Shoreline");
});
