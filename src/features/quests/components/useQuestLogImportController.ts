"use client";

import { useMemo, useReducer, useRef, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import type { PlayerProfileState } from "@/lib/stores/useUserStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
    ENABLE_QUEST_LOG_FILE_DEDUPE,
    IMPORT_GAME_MODES,
    QUEST_LOG_IMPORT_SEEN_FILES_KEY,
    applyQuestImportSelection,
    buildQuestImportBuckets,
    createQuestLogFileFingerprint,
    readQuestLogProcessedFileModes,
    setAllQuestImportSelections,
    toParsedRaidMode,
    writeQuestLogProcessedFileModes,
    type ImportGameMode,
    type QuestImportRow,
} from "@/lib/utils/quest-log-import";
import {
    filterQuestLogFiles,
    getPreWipeQuestLogFileNames,
    parseQuestLogFiles,
    selectionLooksLikeEftLogsFolder,
} from "@/lib/utils/quest-log-parser";
import type { FullQuest } from "@/types";
import {
    buildCompletionMessage,
    buildModeImportViewModels,
    buildReviewImportViewModel,
    getModeRows,
    getSelectionKey,
    initialQuestLogImportState,
    questLogImportReducer,
} from "./quest-log-import-model";

type DirectoryInputAttributes = InputHTMLAttributes<HTMLInputElement> & {
    webkitdirectory?: string;
    directory?: string;
};

export function useQuestLogImportController(input: {
    quests: FullQuest[];
    questsById: ReadonlyMap<string, FullQuest>;
    gameMode: ImportGameMode;
    profiles: Record<ImportGameMode, PlayerProfileState>;
    availableQuestIdsByMode: Record<ImportGameMode, Set<string>>;
}) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [state, dispatch] = useReducer(questLogImportReducer, initialQuestLogImportState);

    const modeModels = useMemo(
        () =>
            buildModeImportViewModels({
                parsedView: state.parsedView,
                profiles: input.profiles,
                availableQuestIdsByMode: input.availableQuestIdsByMode,
            }),
        [input.availableQuestIdsByMode, input.profiles, state.parsedView],
    );
    const reviewModel = useMemo(
        () =>
            buildReviewImportViewModel({
                mode: state.reviewMode,
                modeModels,
                profiles: input.profiles,
                questsById: input.questsById,
                selections: state.autoCompleteSelections,
                allowedSensitiveQuestIds: state.allowedSensitiveBackfillQuestIds,
                deniedSensitiveQuestIds: state.deniedSensitiveBackfillQuestIds,
            }),
        [
            input.profiles,
            input.questsById,
            modeModels,
            state.allowedSensitiveBackfillQuestIds,
            state.autoCompleteSelections,
            state.deniedSensitiveBackfillQuestIds,
            state.reviewMode,
        ],
    );

    async function parseSelectedFiles(files: File[], options: { ignoreSeenFiles?: boolean } = {}) {
        dispatch({ type: "parsingStarted" });
        try {
            if (!selectionLooksLikeEftLogsFolder(files)) {
                dispatch({
                    type: "parsingFailed",
                    error: "That selection does not look like an EFT logs folder. Try ~\\Battlestate Games\\EFT\\Logs or one of its log_* subfolders.",
                });
                return;
            }

            const { matched } = filterQuestLogFiles(files);
            let filesToParse = matched;
            const newFingerprints: string[] = [];
            const preWipeFileNamesFromPath = getPreWipeQuestLogFileNames(matched);

            if (ENABLE_QUEST_LOG_FILE_DEDUPE) {
                const processedFileModes = readQuestLogProcessedFileModes();
                filesToParse = matched.filter((file) => {
                    const fingerprint = createQuestLogFileFingerprint(file);
                    const processedModes = processedFileModes.get(fingerprint);
                    const hasUnprocessedMode =
                        options.ignoreSeenFiles ||
                        !processedModes ||
                        !processedModes.has(input.gameMode);
                    if (hasUnprocessedMode) newFingerprints.push(fingerprint);
                    return hasUnprocessedMode;
                });
            } else {
                newFingerprints.push(...matched.map(createQuestLogFileFingerprint));
            }

            if (matched.length > 0 && filesToParse.length === 0) {
                dispatch({
                    type: "noUnprocessedFiles",
                    notice: `No unprocessed ${input.gameMode} quest logs found in these files.`,
                    preWipeIgnoredFileNames: preWipeFileNamesFromPath,
                });
                return;
            }

            const fileInputs = await Promise.all(
                filesToParse.map(async (file) => ({
                    name: file.name,
                    webkitRelativePath: file.webkitRelativePath,
                    text: await file.text(),
                    excludedRaidModes: IMPORT_GAME_MODES.filter(
                        (mode) => mode !== input.gameMode,
                    ).map(toParsedRaidMode),
                })),
            );
            const result = parseQuestLogFiles(fileInputs, input.quests);
            const buckets = buildQuestImportBuckets(result);
            dispatch({
                type: "parsingSucceeded",
                parsedView: { result, buckets },
                pendingFingerprints: Array.from(new Set(newFingerprints)).sort((a, b) =>
                    a.localeCompare(b),
                ),
                preWipeIgnoredFileNames: result.preWipeIgnoredFiles ?? [],
                selections: {
                    ...prefixSelections("PVP", setAllQuestImportSelections(buckets.pvp, false)),
                    ...prefixSelections("PVE", setAllQuestImportSelections(buckets.pve, false)),
                    ...prefixSelections("KORD", setAllQuestImportSelections(buckets.kord, false)),
                },
                error:
                    result.totals.filesParsed === 0
                        ? "No push-notifications log files were found in that selection."
                        : undefined,
            });
        } catch {
            dispatch({
                type: "parsingFailed",
                error: "The selected logs could not be read. Try choosing the EFT logs folder again.",
            });
        }
    }

    function selectFiles(files: File[]) {
        dispatch({ type: "filesSelected", files });
        if (files.length > 0) void parseSelectedFiles(files);
    }

    function setAllForMode(mode: ImportGameMode, rows: QuestImportRow[], value: boolean) {
        dispatch({
            type: "setSelections",
            selections: prefixSelections(mode, setAllQuestImportSelections(rows, value)),
        });
    }

    function reviewMode(mode: ImportGameMode) {
        const rows = modeModels.find((model) => model.mode === mode)?.rows ?? [];
        dispatch(
            rows.length === 0
                ? { type: "setImportNotice", notice: `No ${mode} quests are available to import.` }
                : { type: "reviewStarted", mode },
        );
    }

    function applyImport(mode: ImportGameMode) {
        const rows = state.parsedView ? getModeRows(state.parsedView.buckets, mode) : [];
        if (rows.length === 0) {
            dispatch({ type: "setImportNotice", notice: `No ${mode} quests are available to import.` });
            return;
        }
        dispatch({ type: "applyingStarted" });
        const store = useUserStore.getState();
        const targetProfile = store.profiles[mode];
        const result = applyQuestImportSelection({
            mode,
            rows,
            autoCompleteSelections: Object.fromEntries(
                rows.map((row) => [
                    row.questId,
                    state.autoCompleteSelections[getSelectionKey(mode, row.questId)] ?? false,
                ]),
            ),
            completedQuests: targetProfile.completedQuests,
            questsWithItems: targetProfile.questsWithItems,
            questsById: input.questsById,
            allowedSensitiveBackfillQuestIds: state.allowedSensitiveBackfillQuestIds,
            deniedSensitiveBackfillQuestIds: state.deniedSensitiveBackfillQuestIds,
        });
        if (result.blockedSensitiveQuestIds.length > 0) {
            dispatch({ type: "reviewStarted", mode });
            dispatch({
                type: "setImportNotice",
                notice: "Sensitive prerequisite backfill must be allowed before importing.",
            });
            return;
        }
        if (store.gameMode !== result.nextGameMode) store.setGameMode(result.nextGameMode);
        const targetState = useUserStore.getState();
        targetState.applyQuestCompletionChange({
            complete: Object.keys(result.nextCompletedQuests).filter(
                (questId) => result.nextCompletedQuests[questId] && !targetState.completedQuests[questId],
            ),
            uncomplete: Object.keys(targetState.completedQuests).filter(
                (questId) => targetState.completedQuests[questId] && !result.nextCompletedQuests[questId],
            ),
        });
        useUserStore.getState().applyProfilePatch({ questsWithItems: result.nextQuestsWithItems });
        router.refresh();

        if (ENABLE_QUEST_LOG_FILE_DEDUPE && state.pendingSeenFileFingerprints.length > 0) {
            const processedFiles = readQuestLogProcessedFileModes();
            for (const fingerprint of state.pendingSeenFileFingerprints) {
                const modes = processedFiles.get(fingerprint) ?? new Set<ImportGameMode>();
                modes.add(mode);
                processedFiles.set(fingerprint, modes);
            }
            writeQuestLogProcessedFileModes(processedFiles);
            dispatch({ type: "fingerprintsCommitted" });
        }
        const summary = {
            mode,
            importedCount: result.importedQuestIds.length,
            prerequisiteCount: result.prerequisiteQuestIds.length,
        };
        dispatch({ type: "importSucceeded", summary, notice: buildCompletionMessage(summary) });
    }

    const directoryInputProps: DirectoryInputAttributes = {
        id: "quest-log-folder-upload",
        name: "quest-log-folder-upload",
        type: "file",
        multiple: true,
        webkitdirectory: "",
        directory: "",
        onChange: (event) => {
            selectFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
        },
    };

    return {
        state,
        modeModels,
        reviewModel,
        fileInputRef,
        directoryInputProps,
        commands: {
            chooseFolder: () => fileInputRef.current?.click(),
            selectFiles,
            clear: () => dispatch({ type: "clear" }),
            clearCache: () => {
                if (typeof window !== "undefined") {
                    window.localStorage.removeItem(QUEST_LOG_IMPORT_SEEN_FILES_KEY);
                }
                dispatch({ type: "clearCacheNotice" });
            },
            ignoreCache: () => {
                if (state.selectedFiles.length === 0) return;
                dispatch({ type: "clearCacheNotice" });
                void parseSelectedFiles(state.selectedFiles, { ignoreSeenFiles: true });
            },
            toggleAutoComplete: (mode: ImportGameMode, questId: string) =>
                dispatch({ type: "toggleSelection", key: getSelectionKey(mode, questId) }),
            setAllForMode,
            reviewMode,
            cancelReview: () => dispatch({ type: "reviewCancelled" }),
            toggleInfo: () => dispatch({ type: "toggleInfo" }),
            allowSensitiveQuest: (questId: string) =>
                dispatch({ type: "sensitiveAllowed", questId }),
            denySensitiveQuest: (questId: string) =>
                dispatch({ type: "sensitiveDenied", questId }),
            applyImport,
        },
    };
}

function prefixSelections(mode: ImportGameMode, selections: Record<string, boolean>) {
    return Object.fromEntries(
        Object.entries(selections).map(([questId, value]) => [getSelectionKey(mode, questId), value]),
    );
}
