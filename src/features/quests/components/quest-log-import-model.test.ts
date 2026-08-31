import assert from "node:assert/strict";
import test from "node:test";

import type { PlayerProfileState } from "../../../lib/stores/useUserStore.ts";
import type { ImportGameMode, QuestImportRow } from "../../../lib/utils/quest-log-import.ts";
import type { FullQuest } from "../../../types/types.ts";
import {
    buildCompletionMessage,
    buildModeImportViewModels,
    initialQuestLogImportState,
    questLogImportReducer,
    type ParsedImportView,
} from "./quest-log-import-model.ts";

test("quest log import reducer follows parsing, review, applying, and success states", () => {
    const file = { name: "push-notifications.log" } as File;
    let state = questLogImportReducer(initialQuestLogImportState, {
        type: "filesSelected",
        files: [file],
    });
    state = questLogImportReducer(state, { type: "parsingStarted" });
    assert.equal(state.status, "parsing");

    state = questLogImportReducer(state, {
        type: "parsingSucceeded",
        parsedView: emptyParsedView(),
        pendingFingerprints: ["fingerprint"],
        preWipeIgnoredFileNames: [],
        selections: { "PVP:quest": false },
    });
    state = questLogImportReducer(state, { type: "reviewStarted", mode: "PVP" });
    assert.equal(state.status, "review");
    assert.equal(state.reviewMode, "PVP");

    state = questLogImportReducer(state, { type: "applyingStarted" });
    assert.equal(state.status, "applying");
    state = questLogImportReducer(state, {
        type: "importSucceeded",
        summary: { mode: "PVP", importedCount: 2, prerequisiteCount: 1 },
        notice: "done",
    });
    assert.equal(state.status, "success");
    assert.deepEqual(state.importSummary, {
        mode: "PVP",
        importedCount: 2,
        prerequisiteCount: 1,
    });
});

test("changing selections clears stale sensitive-backfill decisions", () => {
    let state = questLogImportReducer(initialQuestLogImportState, {
        type: "sensitiveAllowed",
        questId: "sensitive",
    });
    state = questLogImportReducer(state, { type: "toggleSelection", key: "PVP:quest" });
    assert.deepEqual(state.allowedSensitiveBackfillQuestIds, []);
    assert.deepEqual(state.deniedSensitiveBackfillQuestIds, []);
    assert.equal(state.autoCompleteSelections["PVP:quest"], true);
});

test("mode view models filter completed rows without copying quest semantics into the dialog", () => {
    const quest = { id: "done", name: "Done" } as FullQuest;
    const row = {
        questId: quest.id,
        quest,
        raidMode: "pvp",
        types: ["completed"],
        hasStarted: false,
        hasCompleted: true,
        occurrenceCount: 1,
        eventCount: 1,
        latestTimestamp: null,
        sourceFiles: [],
    } satisfies QuestImportRow;
    const profiles = Object.fromEntries(
        (["PVP", "PVE", "KORD"] as ImportGameMode[]).map((mode) => [
            mode,
            { completedQuests: mode === "PVP" ? { done: true } : {}, questsWithItems: {} },
        ]),
    ) as Record<ImportGameMode, PlayerProfileState>;
    const models = buildModeImportViewModels({
        parsedView: { ...emptyParsedView(), buckets: { pvp: [row], pve: [], kord: [], unknownMode: [] } },
        profiles,
        availableQuestIdsByMode: { PVP: new Set(), PVE: new Set(), KORD: new Set() },
    });
    assert.deepEqual(models.find((model) => model.mode === "PVP")?.rows, []);
    assert.equal(
        buildCompletionMessage({ mode: "PVP", importedCount: 2, prerequisiteCount: 1 }),
        "Imported 2 PVP quests and auto-completed 1 prerequisite quests.",
    );
});

function emptyParsedView(): ParsedImportView {
    return {
        result: {
            totals: {
                filesScanned: 0,
                filesParsed: 0,
                filesIgnored: 0,
                rawEvents: 0,
                dedupedEvents: 0,
                startedEvents: 0,
                completedEvents: 0,
                pvpEvents: 0,
                pveEvents: 0,
                kordEvents: 0,
                unknownEvents: 0,
            },
            filteredFiles: [],
            ignoredFiles: [],
            events: [],
            groups: [],
            resolvedGroups: [],
            unresolvedGroups: [],
        },
        buckets: { pvp: [], pve: [], kord: [], unknownMode: [] },
    };
}
