import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types/quests";
import type { QuestWorkspaceLockedFilterSettings } from "../../../lib/stores/useUserStore";
import {
    buildEssentialQuestSeries,
    buildNextTaskCountGateByGroup,
    getQuestWorkspaceStatus,
    isUpcomingLockedQuest,
    questMatchesLockedFilters,
    type QuestWorkspaceProfile,
    type QuestWorkspaceStatusInfo,
} from "./quest-workspace-utils";

function makeSeriesQuest(
    id: string,
    name: string,
    traderId: string,
    prerequisiteIds: string[] = [],
): FullQuest {
    return {
        id,
        name,
        normalizedName: name.toLowerCase().replaceAll(" ", "-"),
        experience: 0,
        trader: { id: traderId, name: traderId, normalizedName: traderId },
        taskRequirements: prerequisiteIds.map((prerequisiteId) => ({
            task: { id: prerequisiteId, name: prerequisiteId },
            status: ["complete"],
        })),
        traderRequirements: [],
        otherRequirements: [],
        objectives: [],
    };
}

test("builds separate Essential series from direct same-trader prerequisite chains", () => {
    const quests = [
        makeSeriesQuest("punisher-1", "The Punisher - Part 1", "prapor"),
        makeSeriesQuest("punisher-2", "The Punisher - Part 2", "prapor", ["punisher-1"]),
        makeSeriesQuest("good-times-1", "The Good Times - Part 1", "prapor"),
        makeSeriesQuest("hell-1", "Hell on Earth - Part 1", "prapor", ["good-times-1"]),
        makeSeriesQuest("hell-2", "Hell on Earth - Part 2", "prapor", ["hell-1"]),
    ];

    assert.deepEqual(buildEssentialQuestSeries(quests), [
        {
            id: "punisher-1",
            title: "The Punisher",
            questIds: ["punisher-1", "punisher-2"],
        },
        {
            id: "good-times-1",
            title: "The Good Times",
            questIds: ["good-times-1", "hell-1", "hell-2"],
        },
    ]);
});

test("stops Essential series at cross-trader, non-Essential, and singleton boundaries", () => {
    const essentialQuests = [
        makeSeriesQuest("root", "Root", "prapor"),
        makeSeriesQuest("same-trader-child", "Same Trader Child", "prapor", ["root"]),
        makeSeriesQuest("cross-trader-child", "Cross Trader Child", "therapist", ["same-trader-child"]),
        makeSeriesQuest("after-non-essential", "After Non-Essential", "prapor", ["ordinary"]),
    ];

    assert.deepEqual(buildEssentialQuestSeries(essentialQuests), [{
        id: "root",
        title: "Root",
        questIds: ["root", "same-trader-child"],
    }]);
});

test("uses a curated Essential series to bridge a reviewed cross-trader detour", () => {
    const quests = [
        makeSeriesQuest("good-times-1", "The Good Times - Part 1", "prapor"),
        makeSeriesQuest("quality-standard", "Quality Standard", "therapist", ["good-times-1"]),
        makeSeriesQuest("airmail", "Airmail", "mechanic", ["quality-standard"]),
        makeSeriesQuest("good-times-2", "The Good Times - Part 2", "prapor", ["airmail"]),
    ];

    assert.deepEqual(buildEssentialQuestSeries(quests, [{
        id: "the-good-times",
        title: "The Good Times",
        questIds: ["good-times-1", "good-times-2"],
    }]), [{
        id: "the-good-times",
        title: "The Good Times",
        questIds: ["good-times-1", "good-times-2"],
    }]);
});

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

test("treats an available active-status prerequisite as satisfied", () => {
    const prerequisite: FullQuest = {
        ...compensationForDamage,
        id: "available-prerequisite",
        name: "Available prerequisite",
        normalizedName: "available-prerequisite",
        traderRequirements: [],
    };
    const dependent: FullQuest = {
        ...prerequisite,
        id: "dependent",
        name: "Dependent",
        normalizedName: "dependent",
        taskRequirements: [{
            task: { id: prerequisite.id, name: prerequisite.name },
            status: ["active"],
        }],
    };
    const questsById = new Map([prerequisite, dependent].map((quest) => [quest.id, quest]));

    assert.equal(getQuestWorkspaceStatus(dependent, makeProfile(0), questsById).status, "active");
});

test("keeps an active-status prerequisite locked when that quest is unavailable", () => {
    const prerequisite: FullQuest = {
        ...compensationForDamage,
        id: "locked-prerequisite",
        name: "Locked prerequisite",
        normalizedName: "locked-prerequisite",
        minPlayerLevel: 40,
        traderRequirements: [],
    };
    const dependent: FullQuest = {
        ...prerequisite,
        id: "dependent-on-locked",
        name: "Dependent on locked",
        normalizedName: "dependent-on-locked",
        minPlayerLevel: 1,
        taskRequirements: [{
            task: { id: prerequisite.id, name: prerequisite.name },
            status: ["active"],
        }],
    };
    const questsById = new Map([prerequisite, dependent].map((quest) => [quest.id, quest]));
    const status = getQuestWorkspaceStatus(dependent, makeProfile(0), questsById);

    assert.equal(status.status, "locked");
    assert.equal(status.reasons.some((reason) => reason.kind === "quest"), true);
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

test("task-count upcoming mode hides milestones above the current trader loyalty", () => {
    const status: QuestWorkspaceStatusInfo = {
        status: "locked",
        label: "Locked",
        terminal: null,
        reasons: [
            { kind: "loyalty", label: "Mechanic LL4", currentValue: 3, requiredValue: 4 },
            {
                kind: "task-count",
                label: "Complete 1 Mechanic LL4 task",
                currentValue: 0,
                requiredValue: 1,
                groupKey: "mechanic-ll4",
            },
        ],
    };
    const nextGates = new Map([["mechanic-ll4", 1]]);

    assert.equal(
        questMatchesLockedFilters(status, DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, nextGates),
        false,
    );
    assert.equal(isUpcomingLockedQuest(status, DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS, nextGates), false);
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
