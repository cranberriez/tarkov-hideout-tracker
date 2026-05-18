"use client";

import { useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { useQuestsContext } from "../QuestsContext";
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FileSearch,
    FolderOpen,
    Info,
    TriangleAlert,
    Trash2,
    Upload,
} from "lucide-react";
import type { FullQuest } from "@/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import {
    ENABLE_QUEST_LOG_FILE_DEDUPE,
    QUEST_LOG_IMPORT_SEEN_FILES_KEY,
    applyQuestImportSelection,
    buildQuestImportBuckets,
    createQuestLogFileFingerprint,
    filterIncompleteQuestImportRows,
    readSeenQuestLogFingerprints,
    setAllQuestImportSelections,
    type ImportGameMode,
    type QuestImportBuckets,
    type QuestImportRow,
    writeSeenQuestLogFingerprints,
} from "@/lib/utils/quest-log-import";
import {
    filterQuestLogFiles,
    getPreWipeQuestLogFileNames,
    type ParsedQuestEvent,
    type QuestLogParseResult,
    parseQuestLogFiles,
    selectionLooksLikeEftLogsFolder,
} from "@/lib/utils/quest-log-parser";
import {
    buildQuestAvailabilityMap,
    isQuestAvailableForProfile,
} from "@/lib/utils/quest-availability";
import {
    NETWORK_PROVIDER_PART_1_ID,
    getSensitiveBackfillQuest,
    getSensitiveBackfillQuestName,
} from "@/lib/utils/sensitive-quest-backfill";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { QuestListByTrader } from "./QuestListByTrader";

interface QuestLogImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quests: FullQuest[];
}

type DirectoryInputAttributes = InputHTMLAttributes<HTMLInputElement> & {
    webkitdirectory?: string;
    directory?: string;
};

interface ParsedImportView {
    result: QuestLogParseResult;
    buckets: QuestImportBuckets;
}

type AutoCompleteSelectionMap = Record<string, boolean>;
type DialogStep = "select" | "review";
interface ImportSummary {
    mode: ImportGameMode;
    importedCount: number;
    prerequisiteCount: number;
}

export function QuestLogImportDialog({ open, onOpenChange, quests }: QuestLogImportDialogProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedView, setParsedView] = useState<ParsedImportView | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);
    const [importNotice, setImportNotice] = useState<string | null>(null);
    const [cacheNotice, setCacheNotice] = useState<string | null>(null);
    const [preWipeIgnoredFileNames, setPreWipeIgnoredFileNames] = useState<string[]>([]);
    const [pendingSeenFileFingerprints, setPendingSeenFileFingerprints] = useState<string[]>([]);
    const [autoCompleteSelections, setAutoCompleteSelections] = useState<AutoCompleteSelectionMap>(
        {},
    );
    const [step, setStep] = useState<DialogStep>("select");
    const [reviewMode, setReviewMode] = useState<ImportGameMode | null>(null);
    const [didConfirmImport, setDidConfirmImport] = useState(false);
    const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
    const [allowedSensitiveBackfillQuestIds, setAllowedSensitiveBackfillQuestIds] = useState<
        string[]
    >([]);
    const [deniedSensitiveBackfillQuestIds, setDeniedSensitiveBackfillQuestIds] = useState<
        string[]
    >([]);

    const { questsById } = useQuestsContext();
    const completedQuests = useUserStore((state) => state.completedQuests);
    const questsWithItems = useUserStore((state) => state.questsWithItems);
    const playerLevel = useUserStore((state) => state.playerLevel);
    const prestigeLevel = useUserStore((state) => state.prestigeLevel);
    const questFaction = useUserStore((state) => state.questFaction);
    const questTraderLoyaltyLevels = useUserStore((state) => state.questTraderLoyaltyLevels);
    const availabilityProfile = useMemo(
        () => ({
            playerLevel,
            prestigeLevel,
            faction: questFaction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            completedQuests,
        }),
        [completedQuests, playerLevel, prestigeLevel, questFaction, questTraderLoyaltyLevels],
    );
    const availableQuestIds = useMemo(() => {
        const availabilityMap = buildQuestAvailabilityMap(quests);
        const availableIds = new Set<string>();

        for (const quest of quests) {
            if (isQuestAvailableForProfile(quest, availabilityProfile, availabilityMap)) {
                availableIds.add(quest.id);
            }
        }

        return availableIds;
    }, [availabilityProfile, quests]);

    const directoryInputProps: DirectoryInputAttributes = {
        id: "quest-log-folder-upload",
        name: "quest-log-folder-upload",
        type: "file",
        multiple: true,
        webkitdirectory: "",
        directory: "",
        onChange: (event) => {
            const fileList = Array.from(event.target.files ?? []);
            void handleFilesSelected(fileList);
            event.target.value = "";
        },
    };

    async function handleFilesSelected(files: File[]) {
        setSelectedFiles(files);
        setSelectedFileNames(files.map((file) => file.name));
        setError(null);
        setImportNotice(null);
        setCacheNotice(null);
        setPreWipeIgnoredFileNames([]);
        setPendingSeenFileFingerprints([]);
        setStep("select");
        setReviewMode(null);
        setDidConfirmImport(false);
        setImportSummary(null);
        setAllowedSensitiveBackfillQuestIds([]);
        setDeniedSensitiveBackfillQuestIds([]);

        if (files.length === 0) {
            setParsedView(null);
            setAutoCompleteSelections({});
            return;
        }

        void parseSelectedFiles(files);
    }

    async function parseSelectedFiles(files: File[], options: { ignoreSeenFiles?: boolean } = {}) {
        setIsParsing(true);
        try {
            if (!selectionLooksLikeEftLogsFolder(files)) {
                setParsedView(null);
                setAutoCompleteSelections({});
                setCacheNotice(null);
                setPreWipeIgnoredFileNames([]);
                setPendingSeenFileFingerprints([]);
                setError(
                    "That selection does not look like an EFT logs folder. Try ~\\Battlestate Games\\EFT\\Logs or one of its log_* subfolders.",
                );
                return;
            }

            const { matched } = filterQuestLogFiles(files);
            let filesToParse = matched;
            const newFingerprints: string[] = [];
            const preWipeFileNamesFromPath = getPreWipeQuestLogFileNames(matched);

            if (ENABLE_QUEST_LOG_FILE_DEDUPE) {
                const seenFingerprints = readSeenQuestLogFingerprints();
                filesToParse = matched.filter((file) => {
                    const fingerprint = createQuestLogFileFingerprint(file);
                    const isNewFile = options.ignoreSeenFiles || !seenFingerprints.has(fingerprint);
                    if (isNewFile) {
                        newFingerprints.push(fingerprint);
                    }
                    return isNewFile;
                });
            } else {
                newFingerprints.push(...matched.map((file) => createQuestLogFileFingerprint(file)));
            }

            if (matched.length > 0 && filesToParse.length === 0) {
                setParsedView(null);
                setAutoCompleteSelections({});
                setPendingSeenFileFingerprints([]);
                setPreWipeIgnoredFileNames(preWipeFileNamesFromPath);
                setCacheNotice("No new files seen.");
                return;
            }

            const fileInputs = await Promise.all(
                filesToParse.map(async (file) => ({
                    name: file.name,
                    webkitRelativePath: file.webkitRelativePath,
                    text: await file.text(),
                })),
            );

            const result = parseQuestLogFiles(fileInputs, quests);
            const buckets = buildQuestImportBuckets(result);
            setParsedView({ result, buckets });
            setCacheNotice(null);
            setPreWipeIgnoredFileNames(result.preWipeIgnoredFiles ?? []);
            setPendingSeenFileFingerprints(
                Array.from(new Set(newFingerprints)).sort((left, right) =>
                    left.localeCompare(right),
                ),
            );
            setAutoCompleteSelections({
                ...setAllQuestImportSelections(buckets.pvp, false),
                ...setAllQuestImportSelections(buckets.pve, false),
            });

            if (result.totals.filesParsed === 0) {
                setError("No push-notifications log files were found in that selection.");
            }
        } catch {
            setParsedView(null);
            setAutoCompleteSelections({});
            setPreWipeIgnoredFileNames([]);
            setPendingSeenFileFingerprints([]);
            setError(
                "The selected logs could not be read. Try choosing the EFT logs folder again.",
            );
        } finally {
            setIsParsing(false);
        }
    }

    function handleChooseFolder() {
        fileInputRef.current?.click();
    }

    function handleClear() {
        setParsedView(null);
        setSelectedFiles([]);
        setSelectedFileNames([]);
        setAutoCompleteSelections({});
        setError(null);
        setImportNotice(null);
        setCacheNotice(null);
        setPreWipeIgnoredFileNames([]);
        setPendingSeenFileFingerprints([]);
        setShowInfo(false);
        setStep("select");
        setReviewMode(null);
        setDidConfirmImport(false);
        setImportSummary(null);
        setAllowedSensitiveBackfillQuestIds([]);
        setDeniedSensitiveBackfillQuestIds([]);
    }

    function handleClearCache() {
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(QUEST_LOG_IMPORT_SEEN_FILES_KEY);
        }
        setCacheNotice(null);
    }

    function handleIgnoreCacheForSelectedFiles() {
        if (selectedFiles.length === 0) {
            return;
        }

        setCacheNotice(null);
        void parseSelectedFiles(selectedFiles, { ignoreSeenFiles: true });
    }

    function handleToggleAutoComplete(mode: ImportGameMode, questId: string) {
        setAllowedSensitiveBackfillQuestIds([]);
        setDeniedSensitiveBackfillQuestIds([]);
        const key = getSelectionKey(mode, questId);
        setAutoCompleteSelections((current) => ({
            ...current,
            [key]: !current[key],
        }));
    }

    function handleSetAllForMode(mode: ImportGameMode, rows: QuestImportRow[], nextValue: boolean) {
        setAllowedSensitiveBackfillQuestIds([]);
        setDeniedSensitiveBackfillQuestIds([]);
        const nextSectionSelections = setAllQuestImportSelections(rows, nextValue);
        setAutoCompleteSelections((current) => {
            const next = { ...current };
            for (const [questId, value] of Object.entries(nextSectionSelections)) {
                next[getSelectionKey(mode, questId)] = value;
            }
            return next;
        });
    }

    function handleReviewMode(mode: ImportGameMode) {
        const rows =
            mode === "PVP" ? (parsedView?.buckets.pvp ?? []) : (parsedView?.buckets.pve ?? []);
        if (rows.length === 0) {
            setImportNotice(`No ${mode} quests are available to import.`);
            return;
        }

        setImportNotice(null);
        setReviewMode(mode);
        setDidConfirmImport(false);
        setImportSummary(null);
        setStep("review");
    }

    function handleImportMode(mode: ImportGameMode) {
        const rows =
            mode === "PVP" ? (parsedView?.buckets.pvp ?? []) : (parsedView?.buckets.pve ?? []);
        if (rows.length === 0) {
            setImportNotice(`No ${mode} quests are available to import.`);
            return;
        }

        const state = useUserStore.getState();
        const result = applyQuestImportSelection({
            mode,
            rows,
            autoCompleteSelections: Object.fromEntries(
                rows.map((row) => [
                    row.questId,
                    autoCompleteSelections[getSelectionKey(mode, row.questId)] ?? false,
                ]),
            ),
            completedQuests: state.completedQuests,
            questsWithItems: state.questsWithItems,
            questsById,
            allowedSensitiveBackfillQuestIds,
            deniedSensitiveBackfillQuestIds,
        });

        if (result.blockedSensitiveQuestIds.length > 0) {
            setImportNotice("Sensitive prerequisite backfill must be allowed before importing.");
            return;
        }

        useUserStore.setState({
            completedQuests: result.nextCompletedQuests,
            questsWithItems: result.nextQuestsWithItems,
            gameMode: result.nextGameMode,
        });

        if (ENABLE_QUEST_LOG_FILE_DEDUPE && pendingSeenFileFingerprints.length > 0) {
            const seenFingerprints = readSeenQuestLogFingerprints();
            for (const fingerprint of pendingSeenFileFingerprints) {
                seenFingerprints.add(fingerprint);
            }
            writeSeenQuestLogFingerprints(seenFingerprints);
            setPendingSeenFileFingerprints([]);
        }

        const prerequisiteCount = result.prerequisiteQuestIds.length;
        setDidConfirmImport(true);
        setImportSummary({
            mode,
            importedCount: result.importedQuestIds.length,
            prerequisiteCount,
        });
        setImportNotice(
            prerequisiteCount > 0
                ? `Imported ${result.importedQuestIds.length} ${mode} quests and auto-completed ${prerequisiteCount} prerequisite quests.`
                : `Imported ${result.importedQuestIds.length} ${mode} quests.`,
        );
    }

    const hasResults = !!parsedView;
    const hasPreWipeIgnoredFiles = preWipeIgnoredFileNames.length > 0;
    const filteredPvpRows = parsedView
        ? filterIncompleteQuestImportRows({
              rows: parsedView.buckets.pvp,
              completedQuests,
              availableQuestIds,
          })
        : [];
    const filteredPveRows = parsedView
        ? filterIncompleteQuestImportRows({
              rows: parsedView.buckets.pve,
              completedQuests,
              availableQuestIds,
          })
        : [];
    const hasAnyImportableRows = filteredPvpRows.length > 0 || filteredPveRows.length > 0;
    const reviewRows =
        reviewMode === "PVP" ? filteredPvpRows : reviewMode === "PVE" ? filteredPveRows : [];
    const reviewPreview =
        reviewMode && parsedView
            ? applyQuestImportSelection({
                  mode: reviewMode,
                  rows: reviewRows,
                  autoCompleteSelections: Object.fromEntries(
                      reviewRows.map((row) => [
                          row.questId,
                          autoCompleteSelections[getSelectionKey(reviewMode, row.questId)] ?? false,
                      ]),
                  ),
                  completedQuests,
                  questsWithItems,
                  questsById,
                  allowedSensitiveBackfillQuestIds,
                  deniedSensitiveBackfillQuestIds,
              })
            : null;
    const reviewImportedRows = reviewRows.filter((row) =>
        reviewPreview?.importedQuestIds.includes(row.questId),
    );
    const reviewPrerequisiteQuests = (reviewPreview?.prerequisiteQuestIds ?? [])
        .map((questId) => questsById.get(questId))
        .filter((quest): quest is FullQuest => !!quest);
    const reviewBlockedSensitiveQuestIds = reviewPreview?.blockedSensitiveQuestIds ?? [];
    const reviewSensitiveDecisionQuestIds = Array.from(
        new Set([
            ...reviewBlockedSensitiveQuestIds,
            ...allowedSensitiveBackfillQuestIds,
            ...deniedSensitiveBackfillQuestIds,
        ]),
    ).sort((left, right) => left.localeCompare(right));
    const showSourceSummary =
        isParsing || step === "review" || hasResults || selectedFileNames.length > 0;
    const showSelectFooter = step === "select" && hasResults && hasAnyImportableRows;
    const showReviewFooter = step === "review" && !!reviewMode && !!reviewPreview;
    const canClearSelection = isParsing || hasResults || selectedFileNames.length > 0;
    const showSuccessBanner = step === "review" && didConfirmImport;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] max-w-6xl overflow-hidden p-0">
                <div className="flex max-h-[90dvh] flex-col">
                    <DialogHeader className="border-b border-white/10 px-6 py-5">
                        <DialogTitle className="text-balance text-xl text-white">
                            Quest Log Import
                        </DialogTitle>
                        <DialogDescription className="max-w-3xl text-pretty text-sm text-gray-400">
                            Upload EFT push-notification logs at the end of a play session to update
                            quest completion state or quickly get back up to speed. For more
                            in-depth quest syncing, especially when starting fresh on the site, try
                            the main sync feature.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4">
                        <input ref={fileInputRef} className="hidden" {...directoryInputProps} />

                        {showSourceSummary && (
                            <section className="flex flex-col rounded-lg border border-white/10 bg-black/20 p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                            <FolderOpen size={16} className="text-tarkov-green" />
                                            Choose EFT logs folder
                                        </div>
                                        <p className="max-w-2xl text-pretty text-sm text-gray-400">
                                            The importer identifies PVP vs PVE quest notifications
                                            from your local logs and lets you choose which set to
                                            import.
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            <code className="rounded bg-white/5 px-1.5 py-0.5 text-gray-300">
                                                ~\Battlestate Games\EFT\Logs
                                            </code>{" "}
                                            upload the whole logs folder or individual sub-folders.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                        <button
                                            type="button"
                                            onClick={handleChooseFolder}
                                            aria-controls="quest-log-folder-upload"
                                            className={cn(
                                                "inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors",
                                                selectedFileNames.length > 0
                                                    ? "border-white/10 bg-white/5 text-gray-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
                                                    : "border-tarkov-green/30 bg-tarkov-green/10 font-semibold text-tarkov-green hover:border-tarkov-green/60",
                                            )}
                                        >
                                            <Upload size={14} />
                                            {selectedFileNames.length > 0
                                                ? "Change Folder"
                                                : "Choose Folder"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClear}
                                            disabled={!canClearSelection}
                                            aria-label="Clear selected folder"
                                            className="inline-flex size-10 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                {isParsing && (
                                    <div className="mt-4 rounded-lg border border-white/10 bg-black/30 px-3 py-3">
                                        <span className="inline-flex items-center gap-2 text-tarkov-green">
                                            <span className="size-2 rounded-full bg-tarkov-green" />
                                            Parsing logs...
                                        </span>
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-sm border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                        <AlertCircle size={14} />
                                        {error}
                                    </div>
                                )}

                                {importNotice && !showSuccessBanner && (
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-sm border border-tarkov-green/20 bg-tarkov-green/10 px-3 py-2 text-sm text-tarkov-green">
                                        <CheckCircle2 size={14} />
                                        {importNotice}
                                    </div>
                                )}

                                {hasPreWipeIgnoredFiles && (
                                    <PreWipeCutoffNotice
                                        fileCount={preWipeIgnoredFileNames.length}
                                    />
                                )}
                            </section>
                        )}

                        {step === "select" &&
                            !isParsing &&
                            !hasResults &&
                            selectedFileNames.length === 0 && (
                                <section className="mt-5 rounded-lg border border-dashed border-white/10 bg-black/10 p-8 text-center">
                                    <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
                                        <CheckCircle2 size={24} className="text-tarkov-green/80" />
                                        <h2 className="text-balance text-lg font-semibold text-white">
                                            Ready to inspect and import quest notifications
                                        </h2>
                                        <p className="text-pretty text-sm text-gray-400">
                                            Choose your EFT logs folder and the importer will
                                            identify PVP vs PVE quest notifications so you can pick
                                            which set to import.
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            <code className="rounded bg-white/5 px-1.5 py-0.5 text-gray-300">
                                                ~\Battlestate Games\EFT\Logs
                                            </code>{" "}
                                            upload the whole logs folder or individual sub-folders.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleChooseFolder}
                                            className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-3 py-2 text-sm font-semibold text-tarkov-green transition-colors hover:border-tarkov-green/60"
                                        >
                                            Choose Logs Folder
                                        </button>
                                    </div>

                                    {cacheNotice && (
                                        <div className="mt-5 flex w-full flex-col items-center justify-center gap-3 rounded-sm border border-amber-400/35 bg-amber-500/12 px-4 py-3 text-center text-sm text-amber-100 sm:flex-row sm:flex-wrap">
                                            <div>No new files seen.</div>
                                            <button
                                                type="button"
                                                onClick={handleClearCache}
                                                className="text-xs text-amber-200 underline underline-offset-2 transition-colors hover:text-white"
                                            >
                                                Clear cache
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleIgnoreCacheForSelectedFiles}
                                                className="rounded-sm border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-200/60 hover:bg-amber-300/20 hover:text-white"
                                            >
                                                Ignore for these files
                                            </button>
                                        </div>
                                    )}
                                </section>
                            )}

                        {cacheNotice && showSourceSummary && (
                            <div className="mt-5 rounded-sm border border-amber-400/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
                                <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:flex-wrap">
                                    <div>No new files seen.</div>
                                    <button
                                        type="button"
                                        onClick={handleClearCache}
                                        className="text-xs text-amber-200 underline underline-offset-2 transition-colors hover:text-white"
                                    >
                                        Clear cache
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleIgnoreCacheForSelectedFiles}
                                        className="rounded-sm border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-200/60 hover:bg-amber-300/20 hover:text-white"
                                    >
                                        Ignore for these files
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === "select" &&
                            !isParsing &&
                            hasResults &&
                            !hasAnyImportableRows &&
                            !cacheNotice && (
                                <section className="mt-5 rounded-lg border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-300">
                                    All quests in logs are already completed.
                                </section>
                            )}

                        {hasResults && parsedView && step === "select" && hasAnyImportableRows && (
                            <div className="mt-5 space-y-5">
                                {filteredPvpRows.length > 0 && (
                                    <ModeSection
                                        title="PVP Quests"
                                        mode="PVP"
                                        rows={filteredPvpRows}
                                        completedQuests={completedQuests}
                                        autoCompleteSelections={autoCompleteSelections}
                                        onToggleAutoComplete={handleToggleAutoComplete}
                                        onEnableAll={() =>
                                            handleSetAllForMode("PVP", filteredPvpRows, true)
                                        }
                                        onDisableAll={() =>
                                            handleSetAllForMode("PVP", filteredPvpRows, false)
                                        }
                                    />
                                )}

                                {filteredPveRows.length > 0 && (
                                    <ModeSection
                                        title="PVE Quests"
                                        mode="PVE"
                                        rows={filteredPveRows}
                                        completedQuests={completedQuests}
                                        autoCompleteSelections={autoCompleteSelections}
                                        onToggleAutoComplete={handleToggleAutoComplete}
                                        onEnableAll={() =>
                                            handleSetAllForMode("PVE", filteredPveRows, true)
                                        }
                                        onDisableAll={() =>
                                            handleSetAllForMode("PVE", filteredPveRows, false)
                                        }
                                    />
                                )}
                            </div>
                        )}

                        {hasResults &&
                            parsedView &&
                            step === "review" &&
                            reviewMode &&
                            reviewPreview && (
                                <div className="mt-5 space-y-5">
                                    <ReviewStep
                                        mode={reviewMode}
                                        importedRows={reviewImportedRows}
                                        prerequisiteQuests={reviewPrerequisiteQuests}
                                        sensitiveDecisionQuestIds={reviewSensitiveDecisionQuestIds}
                                        allowedSensitiveQuestIds={allowedSensitiveBackfillQuestIds}
                                        deniedSensitiveQuestIds={deniedSensitiveBackfillQuestIds}
                                        didConfirmImport={didConfirmImport}
                                        importSummary={importSummary}
                                        questsById={questsById}
                                        getQuestName={(questId) =>
                                            getSensitiveBackfillQuestName(questId, questsById)
                                        }
                                        onAllowSensitiveBackfill={(questId) => {
                                            setAllowedSensitiveBackfillQuestIds((current) =>
                                                Array.from(new Set([...current, questId])),
                                            );
                                            setDeniedSensitiveBackfillQuestIds((current) =>
                                                current.filter(
                                                    (deniedQuestId) => deniedQuestId !== questId,
                                                ),
                                            );
                                        }}
                                        onDenySensitiveBackfill={(questId) => {
                                            setAllowedSensitiveBackfillQuestIds((current) =>
                                                current.filter(
                                                    (allowedQuestId) => allowedQuestId !== questId,
                                                ),
                                            );
                                            setDeniedSensitiveBackfillQuestIds((current) =>
                                                Array.from(new Set([...current, questId])),
                                            );
                                        }}
                                    />

                                    {!didConfirmImport && showInfo && (
                                        <InfoPanel
                                            result={parsedView.result}
                                            unknownModeGroups={parsedView.buckets.unknownMode}
                                        />
                                    )}
                                </div>
                            )}
                    </div>

                    {(showSelectFooter || showReviewFooter) && (
                        <div className="border-t border-white/10 bg-[#0d0d0f]/95 px-6 py-3 backdrop-blur">
                            {showSelectFooter && (
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="inline-flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                                    >
                                        <ArrowLeft size={14} />
                                        Back
                                    </button>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                        <span className="text-sm text-gray-400">
                                            Import quests from:
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {filteredPvpRows.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleReviewMode("PVP")}
                                                    className="rounded-sm border border-white/10 bg-gradient-to-b from-[#3b1c1f] to-[#241315] px-3 py-2 text-sm font-semibold text-gray-100 transition-colors hover:border-white/20 hover:from-[#472124] hover:to-[#2d1719] hover:text-white"
                                                >
                                                    Import PVP Quests
                                                </button>
                                            )}
                                            {filteredPveRows.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleReviewMode("PVE")}
                                                    className="rounded-sm border border-white/10 bg-gradient-to-b from-[#142737] to-[#0f1b28] px-3 py-2 text-sm font-semibold text-gray-100 transition-colors hover:border-white/20 hover:from-[#1a3145] hover:to-[#122231] hover:text-white"
                                                >
                                                    Import PVE Quests
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showReviewFooter && reviewMode && reviewPreview && (
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    {didConfirmImport ? (
                                        <div />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStep("select");
                                                setDidConfirmImport(false);
                                                setImportSummary(null);
                                                setAllowedSensitiveBackfillQuestIds([]);
                                                setDeniedSensitiveBackfillQuestIds([]);
                                            }}
                                            className="inline-flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                                        >
                                            <ArrowLeft size={14} />
                                            Back
                                        </button>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                        {!didConfirmImport && (
                                            <button
                                                type="button"
                                                onClick={() => setShowInfo((current) => !current)}
                                                className="inline-flex items-center gap-1 rounded-sm border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                                            >
                                                <Info size={13} />
                                                Info
                                                {showInfo ? (
                                                    <ChevronUp size={13} />
                                                ) : (
                                                    <ChevronDown size={13} />
                                                )}
                                            </button>
                                        )}
                                        {didConfirmImport ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenChange(false)}
                                                className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-3 py-2 text-sm font-semibold text-tarkov-green transition-colors hover:border-tarkov-green/60"
                                            >
                                                Close
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleImportMode(reviewMode)}
                                                disabled={reviewBlockedSensitiveQuestIds.length > 0}
                                                className={cn(
                                                    "rounded-sm px-3 py-2 text-sm font-semibold transition-colors",
                                                    reviewBlockedSensitiveQuestIds.length > 0
                                                        ? "cursor-not-allowed border border-white/10 bg-black/30 text-gray-600"
                                                        : "border border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-tarkov-green/60",
                                                )}
                                            >
                                                Confirm Import
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PreWipeCutoffNotice({ fileCount }: { fileCount: number }) {
    return (
        <div className="mt-4 flex w-full items-center gap-2 rounded-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <AlertCircle size={14} />
            <span>
                Some log files are older than the latest 1.0 wipe in November 2025 and were ignored.
                {fileCount > 1 ? ` ${fileCount} files were skipped.` : ""}
            </span>
        </div>
    );
}

function ModeSection({
    title,
    mode,
    rows,
    completedQuests,
    autoCompleteSelections,
    onToggleAutoComplete,
    onEnableAll,
    onDisableAll,
}: {
    title: string;
    mode: ImportGameMode;
    rows: QuestImportRow[];
    completedQuests: Record<string, boolean>;
    autoCompleteSelections: AutoCompleteSelectionMap;
    onToggleAutoComplete: (mode: ImportGameMode, questId: string) => void;
    onEnableAll: () => void;
    onDisableAll: () => void;
}) {
    const accentClasses =
        mode === "PVP"
            ? "from-red-500/25 via-red-500/8 to-transparent"
            : "from-sky-400/25 via-sky-400/8 to-transparent";

    return (
        <section className="rounded-lg border border-white/10 bg-black/20">
            <div className="relative flex flex-col gap-3 overflow-hidden border-b border-white/10 px-4 py-3 lg:flex-row lg:items-center">
                <div
                    aria-hidden="true"
                    className={cn(
                        "pointer-events-none absolute -left-6 -top-8 h-20 w-32 rounded-full bg-gradient-to-br blur-2xl",
                        accentClasses,
                    )}
                />
                <div className="relative">
                    <h2 className="text-balance text-lg font-semibold text-white">{title}</h2>
                </div>

                <div className="relative flex flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
                    <button
                        type="button"
                        onClick={onEnableAll}
                        className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                        Enable All
                    </button>
                    <button
                        type="button"
                        onClick={onDisableAll}
                        className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                        Disable All
                    </button>
                </div>
            </div>

            <div className="divide-y divide-white/5">
                {rows.map((row) => {
                    const selectionKey = getSelectionKey(mode, row.questId);
                    const autoCompleteEnabled = autoCompleteSelections[selectionKey] ?? false;
                    const alreadyCompleted = !!completedQuests[row.questId];
                    const showNetworkProviderWarning =
                        row.questId === NETWORK_PROVIDER_PART_1_ID && autoCompleteEnabled;

                    return (
                        <div key={`${mode}-${row.questId}`} className="px-4 py-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="truncate text-base font-semibold text-white">
                                            {row.quest.name}
                                        </div>
                                        <QuestStateBadge
                                            hasStarted={row.hasStarted}
                                            hasCompleted={row.hasCompleted}
                                        />
                                        {alreadyCompleted && (
                                            <span className="inline-flex items-center rounded-full border border-tarkov-green/20 bg-tarkov-green/10 px-2 py-1 text-[11px] font-medium uppercase text-tarkov-green">
                                                Already Complete
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">{row.questId}</div>
                                    <div className="mt-2 text-xs text-gray-500 tabular-nums">
                                        Seen {row.occurrenceCount} · Events {row.eventCount} · Files{" "}
                                        {row.sourceFiles.length}
                                    </div>
                                </div>

                                <div className="flex flex-col items-start gap-3 lg:items-end">
                                    <div className="text-xs text-gray-400 tabular-nums">
                                        Latest: {formatTimestamp(row.latestTimestamp)}
                                    </div>
                                    <label className="inline-flex items-center gap-3 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={autoCompleteEnabled}
                                            onChange={() => onToggleAutoComplete(mode, row.questId)}
                                            className="size-4 accent-[var(--accent-green)]"
                                        />
                                        Auto-complete prerequisites
                                    </label>
                                </div>
                            </div>

                            {showNetworkProviderWarning && (
                                <div className="mt-4 rounded-sm border border-red-500/35 bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-100">
                                    WARNING: If you got Network Provider - Part 1 from the story
                                    missions, do not select it. This can auto-complete a large
                                    number of quests you may not intend to do.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function ReviewStep({
    mode,
    importedRows,
    prerequisiteQuests,
    sensitiveDecisionQuestIds,
    allowedSensitiveQuestIds,
    deniedSensitiveQuestIds,
    didConfirmImport,
    importSummary,
    questsById,
    getQuestName,
    onAllowSensitiveBackfill,
    onDenySensitiveBackfill,
}: {
    mode: ImportGameMode;
    importedRows: QuestImportRow[];
    prerequisiteQuests: FullQuest[];
    sensitiveDecisionQuestIds: string[];
    allowedSensitiveQuestIds: string[];
    deniedSensitiveQuestIds: string[];
    didConfirmImport: boolean;
    importSummary: ImportSummary | null;
    questsById: ReadonlyMap<string, FullQuest>;
    getQuestName: (questId: string) => string;
    onAllowSensitiveBackfill: (questId: string) => void;
    onDenySensitiveBackfill: (questId: string) => void;
}) {
    if (didConfirmImport) {
        const successMode = importSummary?.mode ?? mode;
        const importedCount = importSummary?.importedCount ?? 0;
        const prerequisiteCount = importSummary?.prerequisiteCount ?? 0;

        return (
            <section className="mt-5">
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/12 px-5 py-5 text-emerald-100">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-emerald-300" />
                        <div>
                            <div className="text-base font-semibold text-white">
                                Successfully imported {importedCount} quest
                                {importedCount === 1 ? "" : "s"} and auto-completed{" "}
                                {prerequisiteCount} quest
                                {prerequisiteCount === 1 ? "" : "s"}.
                            </div>
                            <div className="mt-1 text-sm text-emerald-100/80">
                                Your current {successMode} quest progress has been updated.
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="mt-5 rounded-lg border border-white/10 bg-black/20">
            <div className="border-b border-white/10 px-4 py-4">
                <div>
                    <h2 className="text-balance text-lg font-semibold text-white">
                        Review {mode} Import
                    </h2>
                    <p className="mt-1 text-pretty text-sm text-gray-400">
                        Confirm the quests detected from logs and the prerequisite quests that will
                        be auto-completed for this import pass.
                    </p>
                </div>
            </div>

            <div className="space-y-5 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                    <MiniStat label="Quests" value={importedRows.length} />
                    <MiniStat label="Prereqs" value={prerequisiteQuests.length} />
                </div>

                {sensitiveDecisionQuestIds.length > 0 && (
                    <SensitiveBackfillGate
                        questIds={sensitiveDecisionQuestIds}
                        allowedQuestIds={allowedSensitiveQuestIds}
                        deniedQuestIds={deniedSensitiveQuestIds}
                        getQuestName={getQuestName}
                        onAllow={onAllowSensitiveBackfill}
                        onDeny={onDenySensitiveBackfill}
                    />
                )}

                <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">Quests from Logs</h3>
                    <QuestListByTrader
                        questIds={importedRows.map((row) => row.questId)}
                        questsById={questsById}
                        itemPrefix={() => <Check size={14} className="shrink-0 text-emerald-300" />}
                        emptyMessage={`No ${mode} quests are queued for import.`}
                    />
                </section>

                {prerequisiteQuests.length > 0 && (
                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold text-white">
                            Prerequisites to Auto-Complete
                        </h3>
                        <QuestListByTrader
                            questIds={prerequisiteQuests.map((quest) => quest.id)}
                            questsById={questsById}
                            itemPrefix={() => (
                                <Check size={14} className="shrink-0 text-emerald-300" />
                            )}
                        />
                    </section>
                )}
            </div>
        </section>
    );
}

function SensitiveBackfillGate({
    questIds,
    allowedQuestIds,
    deniedQuestIds,
    getQuestName,
    onAllow,
    onDeny,
}: {
    questIds: string[];
    allowedQuestIds: string[];
    deniedQuestIds: string[];
    getQuestName: (questId: string) => string;
    onAllow: (questId: string) => void;
    onDeny: (questId: string) => void;
}) {
    const allowedSet = new Set(allowedQuestIds);
    const deniedSet = new Set(deniedQuestIds);
    const hasUnresolvedChoices = questIds.some(
        (questId) => !allowedSet.has(questId) && !deniedSet.has(questId),
    );

    return (
        <div
            className={cn(
                "rounded-sm px-3 py-3 text-sm text-gray-200 transition-colors",
                hasUnresolvedChoices
                    ? "border border-dashed border-red-500/60"
                    : "border border-white/10 bg-white/5",
            )}
        >
            <div
                className={cn(
                    "font-semibold",
                    hasUnresolvedChoices ? "text-red-400" : "text-gray-200",
                )}
            >
                {hasUnresolvedChoices
                    ? "Choose how to handle prerequisite auto-completion."
                    : "Prerequisite auto-completion decisions recorded."}
            </div>
            <div className="mt-3 space-y-4">
                {questIds.map((questId) => (
                    <div
                        key={questId}
                        className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 font-semibold">
                                <span>{getQuestName(questId)}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-gray-400">
                                {getSensitiveBackfillQuest(questId)?.warning}
                            </p>
                        </div>
                        <div className="inline-flex shrink-0 overflow-hidden rounded-sm border border-white/10 lg:mt-0">
                            <button
                                type="button"
                                onClick={() => onDeny(questId)}
                                className={cn(
                                    "px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                                    deniedSet.has(questId)
                                        ? "bg-white/10 text-white"
                                        : "bg-transparent text-gray-300 hover:bg-white/5 hover:text-white",
                                )}
                            >
                                Deny
                            </button>
                            <button
                                type="button"
                                onClick={() => onAllow(questId)}
                                className={cn(
                                    "inline-flex items-center gap-1 border-l border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                                    allowedSet.has(questId)
                                        ? "bg-red-500/15 text-red-100"
                                        : "bg-transparent text-gray-300 hover:bg-red-500/10 hover:text-white",
                                )}
                            >
                                <TriangleAlert size={12} className="text-amber-300" />
                                Allow
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function InfoPanel({
    result,
    unknownModeGroups,
}: {
    result: QuestLogParseResult;
    unknownModeGroups: ReturnType<typeof buildQuestImportBuckets>["unknownMode"];
}) {
    return (
        <section className="rounded-lg border border-white/10 bg-black/20">
            <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-balance text-lg font-semibold text-white">Import Details</h2>
                <p className="mt-1 text-pretty text-sm text-gray-400">
                    Parser stats and raw deduped events for debugging. Unknown-mode quests remain
                    view-only.
                </p>
            </div>

            <div className="space-y-5 px-4 py-4">
                <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                    <SummaryCard label="Files Parsed" value={result.totals.filesParsed} />
                    <SummaryCard label="Ignored Files" value={result.totals.filesIgnored} />
                    <SummaryCard label="Raw Events" value={result.totals.rawEvents} />
                    <SummaryCard label="Deduped Events" value={result.totals.dedupedEvents} />
                    <SummaryCard label="Unknown Mode" value={result.totals.unknownEvents} />
                    <SummaryCard label="Started" value={result.totals.startedEvents} />
                    <SummaryCard label="Completed" value={result.totals.completedEvents} />
                    <SummaryCard label="PVP" value={result.totals.pvpEvents} />
                    <SummaryCard label="PVE" value={result.totals.pveEvents} />
                    <SummaryCard label="Resolved Groups" value={result.resolvedGroups.length} />
                </section>

                <section className="rounded-lg border border-white/10 bg-black/20">
                    <div className="border-b border-white/10 px-4 py-3">
                        <h3 className="text-sm font-semibold text-white">Unknown Mode Quests</h3>
                        <p className="mt-1 text-sm text-gray-400">
                            These were resolved to known quests but no prior mode signal was found.
                        </p>
                    </div>

                    {unknownModeGroups.length === 0 ? (
                        <div className="px-4 py-5 text-sm text-gray-500">
                            No unknown-mode quests were detected.
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {unknownModeGroups.map((group) => (
                                <div key={`${group.questId}-${group.type}`} className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-white">
                                            {group.quest?.name ?? group.questId}
                                        </span>
                                        <TypeBadge type={group.type} />
                                        <CountBadge label="Seen" value={group.occurrenceCount} />
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {group.questId} · Latest{" "}
                                        {formatTimestamp(group.latestTimestamp)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <RawEventsSection events={result.events} />
            </div>
        </section>
    );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-medium text-gray-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</div>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300">
            <span>{label}</span>
            <span className="tabular-nums text-white">{value}</span>
        </span>
    );
}

function QuestStateBadge({
    hasStarted,
    hasCompleted,
}: {
    hasStarted: boolean;
    hasCompleted: boolean;
}) {
    const label =
        hasStarted && hasCompleted ? "Started + Completed" : hasCompleted ? "Completed" : "Started";

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium uppercase",
                hasCompleted
                    ? "border-tarkov-green/25 bg-tarkov-green/10 text-tarkov-green"
                    : "border-sky-400/25 bg-sky-500/10 text-sky-200",
            )}
        >
            {label}
        </span>
    );
}

function TypeBadge({ type }: { type: ParsedQuestEvent["type"] }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium uppercase",
                type === "completed"
                    ? "border-tarkov-green/25 bg-tarkov-green/10 text-tarkov-green"
                    : "border-sky-400/25 bg-sky-500/10 text-sky-200",
            )}
        >
            {type}
        </span>
    );
}

function CountBadge({ label, value }: { label: string; value: number }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300">
            <span>{label}</span>
            <span className="tabular-nums text-white">{value}</span>
        </span>
    );
}

function RawEventsSection({ events }: { events: ParsedQuestEvent[] }) {
    return (
        <section className="rounded-lg border border-white/10 bg-black/20">
            <div className="border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Raw Events</h3>
                <p className="mt-1 text-sm text-gray-400">
                    Deduped event list for spot checking timestamps, source files, IDs, and mode
                    tags.
                </p>
            </div>

            {events.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No quest events were parsed.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="px-4 py-3 font-medium">Timestamp</th>
                                <th className="px-4 py-3 font-medium">Quest</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Mode</th>
                                <th className="px-4 py-3 font-medium">Seen</th>
                                <th className="px-4 py-3 font-medium">Source File</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {events.map((event, index) => (
                                <tr
                                    key={`${event.questId}-${event.type}-${event.raidMode}-${index}`}
                                >
                                    <td className="px-4 py-3 text-gray-300 tabular-nums">
                                        {formatTimestamp(event.timestamp)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-200">{event.questId}</td>
                                    <td className="px-4 py-3">
                                        <TypeBadge type={event.type} />
                                    </td>
                                    <td className="px-4 py-3 text-gray-300 uppercase">
                                        {event.raidMode}
                                    </td>
                                    <td className="px-4 py-3 text-gray-300 tabular-nums">
                                        {event.occurrenceCount}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{event.sourceFile}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function getSelectionKey(mode: ImportGameMode, questId: string) {
    return `${mode}:${questId}`;
}

function formatTimestamp(timestamp: Date | null) {
    if (!timestamp) {
        return "Unknown";
    }

    return timestamp.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
