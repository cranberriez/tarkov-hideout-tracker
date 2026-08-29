import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types";
import {
    buildRaidPlannerMapSummary,
    getActiveRaidPlannerQuests,
} from "./raid-planner-summary";
import type { QuestWorkspaceStatusInfo } from "./quest-workspace-utils";

const customs = { id: "customs", name: "Customs", normalizedName: "customs" };
const key = {
    id: "key-1",
    name: "Dorm room 206 key",
    shortName: "Dorm 206",
    normalizedName: "dorm-room-206-key",
    iconLink: "https://assets.tarkov.dev/key-1-icon.webp",
};

function quest(id: string, type: string, requiredKeys?: typeof key[][]) {
    return {
        id,
        name: id,
        map: customs,
        objectives: [{
            id: `${id}-objective`,
            type,
            description: `${type} objective`,
            optional: false,
            requiredKeys,
        }],
    } as FullQuest;
}

test("raid planner keeps only active quests regardless of other workspace statuses", () => {
    const quests = [quest("active", "visit"), quest("locked", "shoot"), quest("done", "extract")];
    const statuses = new Map<string, QuestWorkspaceStatusInfo>([
        ["active", { status: "active", label: "Active", reasons: [], terminal: null }],
        ["locked", { status: "locked", label: "Locked", reasons: [], terminal: null }],
        ["done", { status: "completed", label: "Completed", reasons: [], terminal: "completed" }],
    ]);

    assert.deepEqual(getActiveRaidPlannerQuests(quests, statuses).map((entry) => entry.id), ["active"]);
});

test("map summary groups unique quests by objective type and deduplicates required keys", () => {
    const summary = buildRaidPlannerMapSummary([
        quest("visit", "visit", [[key]]),
        quest("plant", "plantItem", [[key]]),
    ], "customs");

    assert.equal(summary.questCount, 2);
    assert.deepEqual(summary.objectiveGroups, [
        { category: "location", questCount: 1, keyedQuestCount: 1 },
        { category: "plant", questCount: 1, keyedQuestCount: 1 },
    ]);
    assert.deepEqual(summary.requiredKeys.map((entry) => entry.id), ["key-1"]);
    assert.equal(summary.requiredKeys[0].shortName, "Dorm 206");
    assert.equal(summary.requiredKeys[0].iconLink, key.iconLink);
});
