import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types";
import type { QuestWorkspaceLockedFilterSettings } from "../../../lib/stores/useUserStore";
import {
    buildNextTaskCountGateByGroup,
    getQuestWorkspaceStatus,
    isUpcomingLockedQuest,
    questMatchesLockedFilters,
    type QuestWorkspaceProfile,
    type QuestWorkspaceStatusInfo,
} from "./quest-workspace-utils";

const DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS: QuestWorkspaceLockedFilterSettings = {
    showAll: false,
    showPlayerLevel: false,
    playerLevelUpcomingOnly: true,
    playerLevelLookahead: 5,
    showTaskCount: true,
    taskCountUpcomingOnly: true,
    showPrerequisite: true,
    prerequisiteUpcomingOnly: true,
    prerequisiteLookahead: 1,
    showFaction: false,
};

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

test("reports failed quests as resolved failed status instead of locked", () => {
    const questsById = new Map([[compensationForDamage.id, compensationForDamage]]);
    const status = getQuestWorkspaceStatus(
        compensationForDamage,
        { ...makeProfile(-1), failedQuests: { [compensationForDamage.id]: true } },
        questsById,
    );

    assert.equal(status.status, "failed");
    assert.equal(status.label, "Failed");
    assert.equal(status.terminal, "failed");
});

test("locked filters require every applicable reason to pass", () => {
    const status: QuestWorkspaceStatusInfo = {
        status: "locked",
        label: "Locked",
        terminal: null,
        reasons: [
            { kind: "level", label: "Requires level 8", currentValue: 1, requiredValue: 8 },
            { kind: "quest", label: "Requires A", currentValue: 0, requiredValue: 1 },
        ],
    };

    assert.equal(
        questMatchesLockedFilters(status, DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, new Map()),
        false,
    );
    assert.equal(
        questMatchesLockedFilters(
            status,
            { ...DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, showPlayerLevel: true },
            new Map(),
        ),
        false,
    );
    assert.equal(
        questMatchesLockedFilters(
            status,
            {
                ...DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS,
                showPlayerLevel: true,
                playerLevelLookahead: 7,
            },
            new Map(),
        ),
        true,
    );
});

test("show-all override bypasses locked reason filters", () => {
    const status: QuestWorkspaceStatusInfo = {
        status: "locked",
        label: "Locked",
        terminal: null,
        reasons: [
            { kind: "level", label: "Requires level 50", currentValue: 1, requiredValue: 50 },
            { kind: "faction", label: "Requires BEAR" },
        ],
    };
    const filters = { ...DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, showAll: true };

    assert.equal(questMatchesLockedFilters(status, filters, new Map()), true);
    assert.equal(isUpcomingLockedQuest(status, filters, new Map()), false);
});

test("task-count upcoming mode exposes only the next locked milestone", () => {
    const makeStatus = (requiredValue: number): QuestWorkspaceStatusInfo => ({
        status: "locked",
        label: "Locked",
        terminal: null,
        reasons: [{
            kind: "task-count",
            label: `Complete ${requiredValue} tasks`,
            currentValue: 0,
            requiredValue,
            groupKey: "prapor-ll1",
        }],
    });
    const first = makeStatus(1);
    const later = makeStatus(3);
    const nextGates = buildNextTaskCountGateByGroup([later, first]);

    assert.equal(questMatchesLockedFilters(first, DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, nextGates), true);
    assert.equal(questMatchesLockedFilters(later, DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, nextGates), false);
    assert.equal(isUpcomingLockedQuest(first, DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, nextGates), true);
});

test("prerequisite upcoming range counts the incomplete quest chain", () => {
    const makeQuest = (id: string, prerequisiteId?: string): FullQuest => ({
        ...compensationForDamage,
        id,
        name: id,
        normalizedName: id,
        traderRequirements: [],
        taskRequirements: prerequisiteId ? [{
            task: { id: prerequisiteId, name: prerequisiteId },
            status: ["complete"],
        }] : [],
    });
    const root = makeQuest("root");
    const middle = makeQuest("middle", "root");
    const leaf = makeQuest("leaf", "middle");
    const questsById = new Map([root, middle, leaf].map((quest) => [quest.id, quest]));

    const status = getQuestWorkspaceStatus(leaf, makeProfile(0), questsById);
    const prerequisiteReason = status.reasons.find((reason) => reason.kind === "quest");
    assert.equal(prerequisiteReason?.requiredValue, 2);
    assert.equal(
        questMatchesLockedFilters(status, DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, new Map()),
        false,
    );
});
