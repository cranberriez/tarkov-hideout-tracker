import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest, QuestMap } from "../../types";
import { buildQuestDataIndex } from "./quest-data-index";
import {
    selectLegacyQuests,
    type LegacyQuestFilterSnapshot,
    type LegacyQuestProfileSnapshot,
} from "./quest-legacy-selector";

const customs: QuestMap = { id: "customs", name: "Customs", normalizedName: "customs" };
const woods: QuestMap = { id: "woods", name: "Woods", normalizedName: "woods" };

function makeQuest(id: string, overrides: Partial<FullQuest> = {}): FullQuest {
    return {
        id,
        name: id,
        normalizedName: id,
        experience: 1_000,
        map: null,
        trader: { id: "prapor", name: "Prapor", normalizedName: "prapor" },
        taskRequirements: [],
        failConditions: [],
        traderRequirements: [],
        otherRequirements: [],
        requiredPrestige: null,
        objectives: [],
        ...overrides,
    };
}

function makeProfile(overrides: Partial<LegacyQuestProfileSnapshot> = {}): LegacyQuestProfileSnapshot {
    return {
        playerLevel: 50,
        prestigeLevel: 0,
        faction: null,
        traderLoyaltyLevels: {},
        completedQuests: {},
        failedQuests: {},
        ignoredQuests: {},
        pinnedQuests: {},
        ...overrides,
    };
}

function makeFilters(overrides: Partial<LegacyQuestFilterSnapshot> = {}): LegacyQuestFilterSnapshot {
    return {
        searchQuery: "",
        selectedTraderIds: new Set(),
        selectedMapKeys: new Set(),
        showKappa: false,
        showLightkeeper: false,
        hideCompleted: false,
        visibilityMode: "all",
        activeDepth: 0,
        showHandInOnly: false,
        showFirHandInOnly: false,
        showPinnedOnly: false,
        showIgnored: false,
        ...overrides,
    };
}

const emptyManifest = { version: 1 as const, series: [] };

test("returns manifest-ordered IDs and counts resolved non-removed quests", () => {
    const quests = [
        makeQuest("complete"),
        makeQuest("failed"),
        makeQuest("removed", { removed: true }),
        makeQuest("open"),
    ];
    const index = buildQuestDataIndex(quests, emptyManifest);
    const selection = selectLegacyQuests(
        index,
        makeProfile({
            completedQuests: { complete: true, removed: true },
            failedQuests: { failed: true },
        }),
        makeFilters(),
    );

    assert.deepEqual(selection.filteredQuestIds, ["complete", "failed", "removed", "open"]);
    assert.equal(selection.completedCount, 1);
    assert.equal(selection.failedCount, 1);
});

test("hideCompleted also hides quests disabled by a completed failure requirement", () => {
    const branch = makeQuest("branch", {
        taskRequirements: [{ task: { id: "choice", name: "choice" }, status: ["failed"] }],
    });
    const index = buildQuestDataIndex([makeQuest("choice"), branch, makeQuest("open")], emptyManifest);
    const selection = selectLegacyQuests(
        index,
        makeProfile({ completedQuests: { choice: true } }),
        makeFilters({ hideCompleted: true }),
    );

    assert.deepEqual(selection.filteredQuestIds, ["open"]);
});

test("active-depth includes available quests and the requested number of unlock layers", () => {
    const root = makeQuest("root");
    const child = makeQuest("child", {
        taskRequirements: [{ task: { id: root.id, name: root.name }, status: ["complete"] }],
    });
    const grandchild = makeQuest("grandchild", {
        taskRequirements: [{ task: { id: child.id, name: child.name }, status: ["complete"] }],
    });
    const index = buildQuestDataIndex([root, child, grandchild], emptyManifest);

    assert.deepEqual(
        selectLegacyQuests(index, makeProfile(), makeFilters({ visibilityMode: "activeDepth", activeDepth: 1 })).filteredQuestIds,
        ["root", "child"],
    );
    assert.deepEqual(
        selectLegacyQuests(index, makeProfile(), makeFilters({ visibilityMode: "hideLocked" })).filteredQuestIds,
        ["root"],
    );
});

test("combines search, trader, faction, map, pin, ignore, and hand-in filters", () => {
    const therapist = { id: "therapist", name: "Therapist", normalizedName: "therapist" };
    const matching = makeQuest("matching", {
        name: "Medical supplies",
        trader: therapist,
        factionName: "USEC",
        map: customs,
        objectives: [{
            id: "give",
            type: "giveItem",
            description: "Hand over supplies",
            optional: false,
            count: 1,
            foundInRaid: true,
            itemIds: ["item"],
        }],
    });
    const wrongMap = makeQuest("wrong-map", { trader: therapist, factionName: "USEC", map: woods });
    const ignored = makeQuest("ignored", { trader: therapist, factionName: "USEC", map: customs });
    const index = buildQuestDataIndex([matching, wrongMap, ignored], emptyManifest);
    const selection = selectLegacyQuests(
        index,
        makeProfile({ ignoredQuests: { ignored: true }, pinnedQuests: { matching: true } }),
        makeFilters({
            searchQuery: "medical",
            selectedTraderIds: new Set(["therapist"]),
            selectedMapKeys: new Set(["customs"]),
            showPinnedOnly: true,
            showHandInOnly: true,
            showFirHandInOnly: true,
        }),
    );

    assert.deepEqual(selection.filteredQuestIds, ["matching"]);
});

test("kappa and lightkeeper filters include their transitive prerequisites", () => {
    const sharedRoot = makeQuest("shared-root");
    const kappa = makeQuest("kappa", {
        kappaRequired: true,
        taskRequirements: [{ task: { id: sharedRoot.id, name: sharedRoot.name }, status: ["complete"] }],
    });
    const lightkeeper = makeQuest("lightkeeper", {
        lightkeeperRequired: true,
        taskRequirements: [{ task: { id: sharedRoot.id, name: sharedRoot.name }, status: ["complete"] }],
    });
    const other = makeQuest("other");
    const index = buildQuestDataIndex([sharedRoot, kappa, lightkeeper, other], emptyManifest);

    const selection = selectLegacyQuests(
        index,
        makeProfile(),
        makeFilters({ showKappa: true, showLightkeeper: true }),
    );

    assert.deepEqual(selection.filteredQuestIds, ["shared-root", "kappa", "lightkeeper"]);
    assert.deepEqual([...selection.kappaQuestIds], ["kappa", "shared-root"]);
    assert.deepEqual([...selection.lightkeeperQuestIds], ["lightkeeper", "shared-root"]);
});
