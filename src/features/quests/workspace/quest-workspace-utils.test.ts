import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types";
import { getQuestWorkspaceStatus, type QuestWorkspaceProfile } from "./quest-workspace-utils";

const fence = {
    id: "fence",
    name: "Fence",
    normalizedName: "fence",
    imageLink: null,
    image4xLink: null,
};

const compensationForDamage: FullQuest = {
    id: "compensation-for-damage",
    name: "Compensation for Damage",
    normalizedName: "compensation-for-damage",
    minPlayerLevel: 1,
    experience: 0,
    trader: fence,
    taskRequirements: [],
    traderRequirements: [{
        id: "fence-reputation-max",
        trader: fence,
        requirementType: "reputation",
        compareMethod: "<=",
        value: -1,
    }],
    otherRequirements: [],
    objectives: [],
};

function makeProfile(fenceReputation: number): QuestWorkspaceProfile {
    return {
        playerLevel: 30,
        prestigeLevel: 0,
        faction: "USEC",
        traderLoyaltyLevels: {},
        fenceReputation,
        completedQuests: {},
        failedQuests: {},
    };
}

test("marks a maximum-Fence-reputation quest locked at the default standing", () => {
    const questsById = new Map([[compensationForDamage.id, compensationForDamage]]);

    const locked = getQuestWorkspaceStatus(
        compensationForDamage,
        makeProfile(0),
        questsById,
    );
    assert.equal(locked.status, "locked");
    assert.deepEqual(locked.reasons, [{
        kind: "reputation",
        label: "Fence Rep <= -1",
    }]);

    assert.equal(
        getQuestWorkspaceStatus(compensationForDamage, makeProfile(-1), questsById).status,
        "active",
    );
});
