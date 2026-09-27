import type { PlayerProfileState } from "../../../lib/stores/useUserStore";
import {
    applyQuestImportSelection,
    filterIncompleteQuestImportRows,
    type ImportGameMode,
    type QuestImportBuckets,
    type QuestImportRow,
} from "../../../lib/utils/quest-log-import";
import type { FullQuest } from "@/types/quests";

export interface ParsedImportView {
    result: import("../../../lib/utils/quest-log-parser").QuestLogParseResult;
    buckets: QuestImportBuckets;
}

export type AutoCompleteSelectionMap = Record<string, boolean>;

export interface ImportSummary {
    mode: ImportGameMode;
    importedCount: number;
    prerequisiteCount: number;
}

export interface QuestLogImportState {
    status: "select" | "parsing" | "review" | "applying" | "success" | "error";
    parsedView: ParsedImportView | null;
    selectedFiles: File[];
    selectedFileNames: string[];
    error: string | null;
    showInfo: boolean;
    importNotice: string | null;
    cacheNotice: string | null;
    preWipeIgnoredFileNames: string[];
    pendingSeenFileFingerprints: string[];
    autoCompleteSelections: AutoCompleteSelectionMap;
    reviewMode: ImportGameMode | null;
    importSummary: ImportSummary | null;
    allowedSensitiveBackfillQuestIds: string[];
    deniedSensitiveBackfillQuestIds: string[];
}

export type QuestLogImportAction =
    | { type: "filesSelected"; files: File[] }
    | { type: "parsingStarted" }
    | {
          type: "parsingSucceeded";
          parsedView: ParsedImportView;
          pendingFingerprints: string[];
          preWipeIgnoredFileNames: string[];
          selections: AutoCompleteSelectionMap;
          error?: string;
      }
    | { type: "parsingFailed"; error: string }
    | { type: "noUnprocessedFiles"; notice: string; preWipeIgnoredFileNames: string[] }
    | { type: "clear" }
    | { type: "clearCacheNotice" }
    | { type: "setImportNotice"; notice: string | null }
    | { type: "toggleSelection"; key: string }
    | { type: "setSelections"; selections: AutoCompleteSelectionMap }
    | { type: "reviewStarted"; mode: ImportGameMode }
    | { type: "reviewCancelled" }
    | { type: "toggleInfo" }
    | { type: "sensitiveAllowed"; questId: string }
    | { type: "sensitiveDenied"; questId: string }
    | { type: "applyingStarted" }
    | { type: "importSucceeded"; summary: ImportSummary; notice: string }
    | { type: "fingerprintsCommitted" };

export const initialQuestLogImportState: QuestLogImportState = {
    status: "select",
    parsedView: null,
    selectedFiles: [],
    selectedFileNames: [],
    error: null,
    showInfo: false,
    importNotice: null,
    cacheNotice: null,
    preWipeIgnoredFileNames: [],
    pendingSeenFileFingerprints: [],
    autoCompleteSelections: {},
    reviewMode: null,
    importSummary: null,
    allowedSensitiveBackfillQuestIds: [],
    deniedSensitiveBackfillQuestIds: [],
};

const resetReview = {
    reviewMode: null,
    importSummary: null,
    allowedSensitiveBackfillQuestIds: [] as string[],
    deniedSensitiveBackfillQuestIds: [] as string[],
};

export function questLogImportReducer(
    state: QuestLogImportState,
    action: QuestLogImportAction,
): QuestLogImportState {
    switch (action.type) {
        case "filesSelected":
            return {
                ...state,
                status: "select",
                parsedView: action.files.length === 0 ? null : state.parsedView,
                selectedFiles: action.files,
                selectedFileNames: action.files.map((file) => file.name),
                error: null,
                importNotice: null,
                cacheNotice: null,
                preWipeIgnoredFileNames: [],
                pendingSeenFileFingerprints: [],
                autoCompleteSelections:
                    action.files.length === 0 ? {} : state.autoCompleteSelections,
                ...resetReview,
            };
        case "parsingStarted":
            return { ...state, status: "parsing", error: null };
        case "parsingSucceeded":
            return {
                ...state,
                status: action.error ? "error" : "select",
                parsedView: action.parsedView,
                autoCompleteSelections: action.selections,
                cacheNotice: null,
                preWipeIgnoredFileNames: action.preWipeIgnoredFileNames,
                pendingSeenFileFingerprints: action.pendingFingerprints,
                error: action.error ?? null,
            };
        case "parsingFailed":
            return {
                ...state,
                status: "error",
                parsedView: null,
                autoCompleteSelections: {},
                cacheNotice: null,
                preWipeIgnoredFileNames: [],
                pendingSeenFileFingerprints: [],
                error: action.error,
            };
        case "noUnprocessedFiles":
            return {
                ...state,
                status: "select",
                parsedView: null,
                autoCompleteSelections: {},
                pendingSeenFileFingerprints: [],
                preWipeIgnoredFileNames: action.preWipeIgnoredFileNames,
                cacheNotice: action.notice,
            };
        case "clear":
            return initialQuestLogImportState;
        case "clearCacheNotice":
            return { ...state, cacheNotice: null };
        case "setImportNotice":
            return { ...state, importNotice: action.notice };
        case "toggleSelection":
            return {
                ...state,
                autoCompleteSelections: {
                    ...state.autoCompleteSelections,
                    [action.key]: !state.autoCompleteSelections[action.key],
                },
                allowedSensitiveBackfillQuestIds: [],
                deniedSensitiveBackfillQuestIds: [],
            };
        case "setSelections":
            return {
                ...state,
                autoCompleteSelections: { ...state.autoCompleteSelections, ...action.selections },
                allowedSensitiveBackfillQuestIds: [],
                deniedSensitiveBackfillQuestIds: [],
            };
        case "reviewStarted":
            return {
                ...state,
                status: "review",
                reviewMode: action.mode,
                importNotice: null,
                importSummary: null,
            };
        case "reviewCancelled":
            return { ...state, status: "select", ...resetReview };
        case "toggleInfo":
            return { ...state, showInfo: !state.showInfo };
        case "sensitiveAllowed":
            return {
                ...state,
                allowedSensitiveBackfillQuestIds: Array.from(
                    new Set([...state.allowedSensitiveBackfillQuestIds, action.questId]),
                ),
                deniedSensitiveBackfillQuestIds: state.deniedSensitiveBackfillQuestIds.filter(
                    (questId) => questId !== action.questId,
                ),
            };
        case "sensitiveDenied":
            return {
                ...state,
                allowedSensitiveBackfillQuestIds: state.allowedSensitiveBackfillQuestIds.filter(
                    (questId) => questId !== action.questId,
                ),
                deniedSensitiveBackfillQuestIds: Array.from(
                    new Set([...state.deniedSensitiveBackfillQuestIds, action.questId]),
                ),
            };
        case "applyingStarted":
            return { ...state, status: "applying", importNotice: null };
        case "importSucceeded":
            return {
                ...state,
                status: "success",
                importSummary: action.summary,
                importNotice: action.notice,
            };
        case "fingerprintsCommitted":
            return { ...state, pendingSeenFileFingerprints: [] };
    }
}

export function getSelectionKey(mode: ImportGameMode, questId: string) {
    return `${mode}:${questId}`;
}

export function getModeRows(buckets: QuestImportBuckets, mode: ImportGameMode) {
    if (mode === "PVP") return buckets.pvp;
    if (mode === "PVE") return buckets.pve;
    return buckets.kord;
}

export interface ModeImportViewModel {
    mode: ImportGameMode;
    title: string;
    rows: QuestImportRow[];
    completedQuests: Record<string, boolean>;
}

export function buildModeImportViewModels(input: {
    parsedView: ParsedImportView | null;
    profiles: Record<ImportGameMode, PlayerProfileState>;
    availableQuestIdsByMode: Record<ImportGameMode, Set<string>>;
}): ModeImportViewModel[] {
    if (!input.parsedView) return [];
    const titles: Record<ImportGameMode, string> = {
        PVP: "PVP Quests",
        PVE: "PVE Quests",
        KORD: "KORD Seasonal Quests",
    };
    return (["PVP", "PVE", "KORD"] as const).map((mode) => ({
        mode,
        title: titles[mode],
        rows: filterIncompleteQuestImportRows({
            rows: getModeRows(input.parsedView!.buckets, mode),
            completedQuests: input.profiles[mode].completedQuests,
            availableQuestIds: input.availableQuestIdsByMode[mode],
        }),
        completedQuests: input.profiles[mode].completedQuests,
    }));
}

export interface ReviewImportViewModel {
    mode: ImportGameMode;
    importedRows: QuestImportRow[];
    prerequisiteQuests: FullQuest[];
    blockedSensitiveQuestIds: string[];
    sensitiveDecisionQuestIds: string[];
    importedCount: number;
    prerequisiteCount: number;
}

export function buildReviewImportViewModel(input: {
    mode: ImportGameMode | null;
    modeModels: ModeImportViewModel[];
    profiles: Record<ImportGameMode, PlayerProfileState>;
    questsById: ReadonlyMap<string, FullQuest>;
    selections: AutoCompleteSelectionMap;
    allowedSensitiveQuestIds: string[];
    deniedSensitiveQuestIds: string[];
}): ReviewImportViewModel | null {
    if (!input.mode) return null;
    const rows = input.modeModels.find((model) => model.mode === input.mode)?.rows ?? [];
    const preview = applyQuestImportSelection({
        mode: input.mode,
        rows,
        autoCompleteSelections: Object.fromEntries(
            rows.map((row) => [
                row.questId,
                input.selections[getSelectionKey(input.mode!, row.questId)] ?? false,
            ]),
        ),
        completedQuests: input.profiles[input.mode].completedQuests,
        questsWithItems: input.profiles[input.mode].questsWithItems,
        questsById: input.questsById,
        allowedSensitiveBackfillQuestIds: input.allowedSensitiveQuestIds,
        deniedSensitiveBackfillQuestIds: input.deniedSensitiveQuestIds,
    });
    const importedRows = rows.filter((row) => preview.importedQuestIds.includes(row.questId));
    const prerequisiteQuests = preview.prerequisiteQuestIds
        .map((questId) => input.questsById.get(questId))
        .filter((quest): quest is FullQuest => !!quest);
    return {
        mode: input.mode,
        importedRows,
        prerequisiteQuests,
        blockedSensitiveQuestIds: preview.blockedSensitiveQuestIds,
        sensitiveDecisionQuestIds: Array.from(
            new Set([
                ...preview.blockedSensitiveQuestIds,
                ...input.allowedSensitiveQuestIds,
                ...input.deniedSensitiveQuestIds,
            ]),
        ).sort((left, right) => left.localeCompare(right)),
        importedCount: importedRows.length,
        prerequisiteCount: prerequisiteQuests.length,
    };
}

export function buildCompletionMessage(summary: ImportSummary) {
    return summary.prerequisiteCount > 0
        ? `Imported ${summary.importedCount} ${summary.mode} quests and auto-completed ${summary.prerequisiteCount} prerequisite quests.`
        : `Imported ${summary.importedCount} ${summary.mode} quests.`;
}
