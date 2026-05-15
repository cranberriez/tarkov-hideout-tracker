import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "../../types/types.ts";
import {
    applyQuestImportSelection,
    buildQuestImportBuckets,
    filterIncompleteQuestImportRows,
    setAllQuestImportSelections,
} from "./quest-log-import.ts";
import type { QuestLogParseResult } from "./quest-log-parser.ts";

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

test("buildQuestImportBuckets merges started and completed groups for the same quest and mode", () => {
    const quest = makeQuest({ id: "quest-alpha", name: "Quest Alpha" });
    const parseResult: QuestLogParseResult = {
        totals: {
            filesScanned: 1,
            filesParsed: 1,
            filesIgnored: 0,
            rawEvents: 2,
            dedupedEvents: 2,
            startedEvents: 1,
            completedEvents: 1,
            pvpEvents: 2,
            pveEvents: 0,
            unknownEvents: 0,
        },
        filteredFiles: ["push-notifications_000.log"],
        ignoredFiles: [],
        events: [],
        groups: [],
        resolvedGroups: [
            {
                questId: "quest-alpha",
                type: "started",
                raidMode: "pvp",
                firstTimestamp: new Date("2026-05-15T10:00:00Z"),
                latestTimestamp: new Date("2026-05-15T10:00:00Z"),
                eventCount: 1,
                occurrenceCount: 1,
                hasRewards: false,
                traderIds: [],
                sourceFiles: ["push-notifications_000.log"],
                quest,
            },
            {
                questId: "quest-alpha",
                type: "completed",
                raidMode: "pvp",
                firstTimestamp: new Date("2026-05-15T10:05:00Z"),
                latestTimestamp: new Date("2026-05-15T10:05:00Z"),
                eventCount: 1,
                occurrenceCount: 2,
                hasRewards: true,
                traderIds: [],
                sourceFiles: ["push-notifications_001.log"],
                quest,
            },
        ],
        unresolvedGroups: [],
    };

    const buckets = buildQuestImportBuckets(parseResult);

    assert.equal(buckets.pvp.length, 1);
    assert.equal(buckets.pvp[0]?.hasStarted, true);
    assert.equal(buckets.pvp[0]?.hasCompleted, true);
    assert.equal(buckets.pvp[0]?.occurrenceCount, 3);
    assert.deepEqual(buckets.pvp[0]?.types, ["completed", "started"]);
});

test("applyQuestImportSelection imports rows and optional prerequisite chains", () => {
    const root = makeQuest({ id: "root", name: "Root" });
    const child = makeQuest({
        id: "child",
        name: "Child",
        taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
    });
    const leaf = makeQuest({
        id: "leaf",
        name: "Leaf",
        taskRequirements: [{ task: { id: "child", name: "Child" }, status: ["Success"] }],
    });
    const rows = [
        {
            questId: "leaf",
            quest: leaf,
            raidMode: "pvp" as const,
            types: ["started"] as ("started" | "completed")[],
            hasStarted: true,
            hasCompleted: false,
            occurrenceCount: 1,
            eventCount: 1,
            latestTimestamp: null,
            sourceFiles: ["push-notifications_000.log"],
        },
    ];

    const result = applyQuestImportSelection({
        mode: "PVP",
        rows,
        autoCompleteSelections: { leaf: true },
        completedQuests: {},
        questsWithItems: { leaf: true, child: true, root: true },
        questsById: new Map([
            [root.id, root],
            [child.id, child],
            [leaf.id, leaf],
        ]),
    });

    assert.deepEqual(result.importedQuestIds, ["leaf"]);
    assert.deepEqual(result.prerequisiteQuestIds, ["child", "root"]);
    assert.equal(result.nextCompletedQuests.leaf, true);
    assert.equal(result.nextCompletedQuests.child, true);
    assert.equal(result.nextCompletedQuests.root, true);
    assert.equal(result.nextQuestsWithItems.leaf, false);
    assert.equal(result.nextQuestsWithItems.child, false);
    assert.equal(result.nextQuestsWithItems.root, false);
    assert.equal(result.nextGameMode, "PVP");
});

test("applyQuestImportSelection does not list already completed prerequisites for auto-complete", () => {
    const root = makeQuest({ id: "root", name: "Root" });
    const child = makeQuest({
        id: "child",
        name: "Child",
        taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
    });

    const result = applyQuestImportSelection({
        mode: "PVP",
        rows: [
            {
                questId: "child",
                quest: child,
                raidMode: "pvp",
                types: ["completed"],
                hasStarted: false,
                hasCompleted: true,
                occurrenceCount: 1,
                eventCount: 1,
                latestTimestamp: null,
                sourceFiles: [],
            },
        ],
        autoCompleteSelections: { child: true },
        completedQuests: { root: true },
        questsWithItems: {},
        questsById: new Map([
            [root.id, root],
            [child.id, child],
        ]),
    });

    assert.deepEqual(result.prerequisiteQuestIds, []);
    assert.equal(result.nextCompletedQuests.root, true);
});

test("setAllQuestImportSelections populates each quest id with the requested toggle state", () => {
    const rows = [
        {
            questId: "a",
            quest: makeQuest({ id: "a", name: "A" }),
            raidMode: "pvp" as const,
            types: ["started"] as ("started" | "completed")[],
            hasStarted: true,
            hasCompleted: false,
            occurrenceCount: 1,
            eventCount: 1,
            latestTimestamp: null,
            sourceFiles: [],
        },
        {
            questId: "b",
            quest: makeQuest({ id: "b", name: "B" }),
            raidMode: "pvp" as const,
            types: ["completed"] as ("started" | "completed")[],
            hasStarted: false,
            hasCompleted: true,
            occurrenceCount: 1,
            eventCount: 1,
            latestTimestamp: null,
            sourceFiles: [],
        },
    ];

    assert.deepEqual(setAllQuestImportSelections(rows, true), { a: true, b: true });
});

test("filterIncompleteQuestImportRows removes quests already completed in the store", () => {
    const rows = [
        {
            questId: "a",
            quest: makeQuest({ id: "a", name: "A" }),
            raidMode: "pvp" as const,
            types: ["started"] as ("started" | "completed")[],
            hasStarted: true,
            hasCompleted: false,
            occurrenceCount: 1,
            eventCount: 1,
            latestTimestamp: null,
            sourceFiles: [],
        },
        {
            questId: "b",
            quest: makeQuest({ id: "b", name: "B" }),
            raidMode: "pvp" as const,
            types: ["completed"] as ("started" | "completed")[],
            hasStarted: false,
            hasCompleted: true,
            occurrenceCount: 1,
            eventCount: 1,
            latestTimestamp: null,
            sourceFiles: [],
        },
    ];

    const filtered = filterIncompleteQuestImportRows(rows, { b: true });

    assert.deepEqual(filtered.map((row) => row.questId), ["a"]);
});
