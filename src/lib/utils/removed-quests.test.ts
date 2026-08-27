import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types";
import {
    excludeRemovedQuests,
    isRemovedQuestId,
    prepareQuestsForDisplay,
    REMOVED_QUEST_IDS,
} from "./removed-quests";

function makeQuest(id: string): FullQuest {
    return {
        id,
        name: id,
        normalizedName: id,
        experience: 0,
        trader: { id: "therapist", name: "Therapist", normalizedName: "therapist" },
        taskRequirements: [],
        traderRequirements: [],
        otherRequirements: [],
        objectives: [],
    };
}

test("contains the validated removed quest IDs", () => {
    assert.equal(REMOVED_QUEST_IDS.size, 35);
    assert.equal(isRemovedQuestId("596a204686f774576d4c95de"), true);
    assert.equal(isRemovedQuestId("675c04f4db8807b75d0f38e8"), true);
    assert.equal(isRemovedQuestId("63ab180c87413d64ae0ac20a"), true);
});

test("excludes removed quests when the review flag is disabled", () => {
    const quests = [makeQuest("active"), makeQuest("596a204686f774576d4c95de")];

    assert.deepEqual(excludeRemovedQuests(quests).map((quest) => quest.id), ["active"]);
    assert.deepEqual(
        prepareQuestsForDisplay(quests, false).map((quest) => quest.id),
        ["active"],
    );
});

test("marks removed quests when the review flag is enabled", () => {
    const active = makeQuest("active");
    const removed = makeQuest("596a204686f774576d4c95de");
    const prepared = prepareQuestsForDisplay([active, removed], true);

    assert.equal(prepared[0], active);
    assert.equal(prepared[0].removed, undefined);
    assert.equal(prepared[1].removed, true);
    assert.equal(removed.removed, undefined);
});
