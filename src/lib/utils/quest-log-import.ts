import type { FullQuest } from "../../types/types.ts";
import type { ParsedQuestEventType, QuestLogParseResult, ResolvedAggregatedQuestEvent } from "./quest-log-parser.ts";
import { collectTransitivePrerequisiteIds } from "./sensitive-quest-backfill";

export type ImportGameMode = "PVP" | "PVE";

export interface QuestImportRow {
    questId: string;
    quest: FullQuest;
    raidMode: "pvp" | "pve";
    types: ParsedQuestEventType[];
    hasStarted: boolean;
    hasCompleted: boolean;
    occurrenceCount: number;
    eventCount: number;
    latestTimestamp: Date | null;
    sourceFiles: string[];
}

export interface QuestImportBuckets {
    pvp: QuestImportRow[];
    pve: QuestImportRow[];
    unknownMode: ResolvedAggregatedQuestEvent[];
}

export interface QuestImportSelectionState {
    [questId: string]: boolean;
}

export interface QuestImportApplicationResult {
    mode: ImportGameMode;
    importedQuestIds: string[];
    prerequisiteQuestIds: string[];
    blockedSensitiveQuestIds: string[];
    nextCompletedQuests: Record<string, boolean>;
    nextQuestsWithItems: Record<string, boolean>;
    nextGameMode: ImportGameMode;
}

export const QUEST_LOG_IMPORT_SEEN_FILES_KEY = "tarkov-hideout:quest-log-import:seen-files:v1";
export const ENABLE_QUEST_LOG_FILE_DEDUPE = true;

export function buildQuestImportBuckets(parseResult: QuestLogParseResult): QuestImportBuckets {
    const pvp = buildModeRows(parseResult.resolvedGroups, "pvp");
    const pve = buildModeRows(parseResult.resolvedGroups, "pve");
    const unknownMode = parseResult.resolvedGroups.filter(
        (group) => group.quest && group.raidMode === "unknown",
    );

    return { pvp, pve, unknownMode };
}

export function applyQuestImportSelection(input: {
    mode: ImportGameMode;
    rows: QuestImportRow[];
    autoCompleteSelections: QuestImportSelectionState;
    completedQuests: Record<string, boolean>;
    questsWithItems: Record<string, boolean>;
    questsById: ReadonlyMap<string, FullQuest>;
    allowedSensitiveBackfillQuestIds?: string[];
    deniedSensitiveBackfillQuestIds?: string[];
}) {
    const nextCompletedQuests = { ...input.completedQuests };
    const nextQuestsWithItems = { ...input.questsWithItems };
    const importedQuestIds: string[] = [];
    const prerequisiteQuestIds = new Set<string>();
    const blockedSensitiveQuestIds = new Set<string>();
    const allowedSensitiveQuestIds = new Set(input.allowedSensitiveBackfillQuestIds ?? []);
    const deniedSensitiveQuestIds = new Set(input.deniedSensitiveBackfillQuestIds ?? []);

    for (const row of input.rows) {
        if (!row.hasCompleted) {
            continue;
        }

        if (!nextCompletedQuests[row.questId]) {
            nextCompletedQuests[row.questId] = true;
            importedQuestIds.push(row.questId);
        }
        nextQuestsWithItems[row.questId] = false;

        if (!input.autoCompleteSelections[row.questId]) {
            continue;
        }

        const traversalResult = collectTransitivePrerequisiteIds([row.questId], input.questsById, {
            allowedSensitiveQuestIds,
            deniedSensitiveQuestIds,
        });
        for (const questId of traversalResult.blockedSensitiveQuestIds) {
            blockedSensitiveQuestIds.add(questId);
        }

        const prerequisiteIds = traversalResult.prerequisiteIds;
        for (const prerequisiteId of prerequisiteIds) {
            if (!nextCompletedQuests[prerequisiteId]) {
                prerequisiteQuestIds.add(prerequisiteId);
            }
            nextCompletedQuests[prerequisiteId] = true;
            nextQuestsWithItems[prerequisiteId] = false;
        }
    }

    return {
        mode: input.mode,
        importedQuestIds,
        prerequisiteQuestIds: Array.from(prerequisiteQuestIds).sort((left, right) =>
            left.localeCompare(right),
        ),
        blockedSensitiveQuestIds: Array.from(blockedSensitiveQuestIds).sort((left, right) =>
            left.localeCompare(right),
        ),
        nextCompletedQuests,
        nextQuestsWithItems,
        nextGameMode: input.mode,
    } satisfies QuestImportApplicationResult;
}

export function setAllQuestImportSelections(rows: QuestImportRow[], nextValue: boolean) {
    const nextSelections: QuestImportSelectionState = {};
    for (const row of rows) {
        nextSelections[row.questId] = nextValue;
    }
    return nextSelections;
}

export function filterIncompleteQuestImportRows(
    input: {
        rows: QuestImportRow[];
        completedQuests: Record<string, boolean>;
        availableQuestIds: ReadonlySet<string>;
    },
) {
    return input.rows.filter((row) => {
        if (input.completedQuests[row.questId]) {
            return false;
        }

        if (row.hasCompleted) {
            return true;
        }

        if (!row.hasStarted) {
            return true;
        }

        return !input.availableQuestIds.has(row.questId);
    });
}

export function createQuestLogFileFingerprint(file: {
    name: string;
    size?: number;
    lastModified?: number;
}) {
    return JSON.stringify({
        name: file.name,
        size: file.size ?? null,
        lastModified: file.lastModified ?? null,
    });
}

export function readSeenQuestLogFingerprints() {
    if (typeof window === "undefined") {
        return new Set<string>();
    }

    try {
        const rawValue = window.localStorage.getItem(QUEST_LOG_IMPORT_SEEN_FILES_KEY);
        if (!rawValue) {
            return new Set<string>();
        }
        const parsed = JSON.parse(rawValue) as unknown;
        return Array.isArray(parsed) ? new Set(parsed.filter((item) => typeof item === "string")) : new Set<string>();
    } catch {
        return new Set<string>();
    }
}

export function writeSeenQuestLogFingerprints(fingerprints: Iterable<string>) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(
        QUEST_LOG_IMPORT_SEEN_FILES_KEY,
        JSON.stringify(Array.from(new Set(fingerprints)).sort((left, right) => left.localeCompare(right))),
    );
}

function buildModeRows(
    groups: ResolvedAggregatedQuestEvent[],
    raidMode: "pvp" | "pve",
): QuestImportRow[] {
    const rows = new Map<string, QuestImportRow>();

    for (const group of groups) {
        if (!group.quest || group.raidMode !== raidMode) {
            continue;
        }

        const existing = rows.get(group.questId);
        if (!existing) {
            rows.set(group.questId, {
                questId: group.questId,
                quest: group.quest,
                raidMode,
                types: [group.type],
                hasStarted: group.type === "started",
                hasCompleted: group.type === "completed",
                occurrenceCount: group.occurrenceCount,
                eventCount: group.eventCount,
                latestTimestamp: group.latestTimestamp,
                sourceFiles: [...group.sourceFiles],
            });
            continue;
        }

        if (!existing.types.includes(group.type)) {
            existing.types.push(group.type);
            existing.types.sort((left, right) => left.localeCompare(right));
        }
        existing.hasStarted = existing.hasStarted || group.type === "started";
        existing.hasCompleted = existing.hasCompleted || group.type === "completed";
        existing.occurrenceCount += group.occurrenceCount;
        existing.eventCount += group.eventCount;
        if (
            group.latestTimestamp &&
            (!existing.latestTimestamp || group.latestTimestamp > existing.latestTimestamp)
        ) {
            existing.latestTimestamp = group.latestTimestamp;
        }
        for (const sourceFile of group.sourceFiles) {
            if (!existing.sourceFiles.includes(sourceFile)) {
                existing.sourceFiles.push(sourceFile);
            }
        }
    }

    return Array.from(rows.values()).sort((left, right) => {
        const leftTime = left.latestTimestamp?.getTime() ?? 0;
        const rightTime = right.latestTimestamp?.getTime() ?? 0;
        return rightTime - leftTime || left.quest.name.localeCompare(right.quest.name);
    });
}
