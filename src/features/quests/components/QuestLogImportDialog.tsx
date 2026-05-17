"use client";

import { useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FileSearch,
    FolderOpen,
    Info,
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

export function QuestLogImportDialog({ open, onOpenChange, quests }: QuestLogImportDialogProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedView, setParsedView] = useState<ParsedImportView | null>(null);
    const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);
    const [importNotice, setImportNotice] = useState<string | null>(null);
    const [cacheNotice, setCacheNotice] = useState<string | null>(null);
    const [autoCompleteSelections, setAutoCompleteSelections] = useState<AutoCompleteSelectionMap>(
        {},
    );
    const [step, setStep] = useState<DialogStep>("select");
    const [reviewMode, setReviewMode] = useState<ImportGameMode | null>(null);
    const [didConfirmImport, setDidConfirmImport] = useState(false);
    const [allowedSensitiveBackfillQuestIds, setAllowedSensitiveBackfillQuestIds] = useState<
        string[]
    >([]);
    const [deniedSensitiveBackfillQuestIds, setDeniedSensitiveBackfillQuestIds] = useState<
        string[]
    >([]);

    const questsById = useMemo(() => new Map(quests.map((quest) => [quest.id, quest])), [quests]);
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
        setSelectedFileNames(files.map((file) => file.name));
        setError(null);
        setImportNotice(null);
        setCacheNotice(null);
        setStep("select");
        setReviewMode(null);
        setDidConfirmImport(false);
        setAllowedSensitiveBackfillQuestIds([]);
        setDeniedSensitiveBackfillQuestIds([]);

        if (files.length === 0) {
            setParsedView(null);
            setAutoCompleteSelections({});
            return;
        }

        void parseSelectedFiles(files);
    }

    async function parseSelectedFiles(files: File[]) {
        setIsParsing(true);
        try {
            if (!selectionLooksLikeEftLogsFolder(files)) {
                setParsedView(null);
                setAutoCompleteSelections({});
                setCacheNotice(null);
                setError(
                    "That selection does not look like an EFT logs folder. Try ~\\Battlestate Games\\EFT\\Logs or one of its log_* subfolders.",
                );
                return;
            }

            const { matched } = filterQuestLogFiles(files);
            let filesToParse = matched;
            const newFingerprints: string[] = [];

            if (ENABLE_QUEST_LOG_FILE_DEDUPE) {
                const seenFingerprints = readSeenQuestLogFingerprints();
                filesToParse = matched.filter((file) => {
                    const fingerprint = createQuestLogFileFingerprint(file);
                    const isNewFile = !seenFingerprints.has(fingerprint);
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
            setAutoCompleteSelections({
                ...setAllQuestImportSelections(buckets.pvp, false),
                ...setAllQuestImportSelections(buckets.pve, false),
            });

            if (ENABLE_QUEST_LOG_FILE_DEDUPE && newFingerprints.length > 0) {
                const seenFingerprints = readSeenQuestLogFingerprints();
                for (const fingerprint of newFingerprints) {
                    seenFingerprints.add(fingerprint);
                }
                writeSeenQuestLogFingerprints(seenFingerprints);
            }

            if (result.totals.filesParsed === 0) {
                setError("No push-notifications log files were found in that selection.");
            }
        } catch {
            setParsedView(null);
            setAutoCompleteSelections({});
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
        setSelectedFileNames([]);
        setAutoCompleteSelections({});
        setError(null);
        setImportNotice(null);
        setCacheNotice(null);
        setShowInfo(false);
        setStep("select");
        setReviewMode(null);
        setDidConfirmImport(false);
        setAllowedSensitiveBackfillQuestIds([]);
        setDeniedSensitiveBackfillQuestIds([]);
    }

    function handleClearCache() {
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(QUEST_LOG_IMPORT_SEEN_FILES_KEY);
        }
        setCacheNotice(null);
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

        const prerequisiteCount = result.prerequisiteQuestIds.length;
        setDidConfirmImport(true);
        setImportNotice(
            prerequisiteCount > 0
                ? `Imported ${result.importedQuestIds.length} ${mode} quests and auto-completed ${prerequisiteCount} prerequisite quests.`
                : `Imported ${result.importedQuestIds.length} ${mode} quests.`,
        );
    }

    const hasResults = !!parsedView;
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

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        <input ref={fileInputRef} className="hidden" {...directoryInputProps} />

                        {(isParsing ||
                            step === "review" ||
                            (hasResults && hasAnyImportableRows)) && (
                            <section className="rounded-lg border border-white/10 bg-black/20 p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleChooseFolder}
                                            aria-controls="quest-log-folder-upload"
                                            className="inline-flex items-center gap-2 rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-3 py-2 text-sm font-semibold text-tarkov-green transition-colors hover:border-tarkov-green/60"
                                        >
                                            <Upload size={14} />
                                            Choose Folder
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClear}
                                            disabled={!hasResults && selectedFileNames.length === 0}
                                            className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                    <span className="inline-flex items-center gap-2">
                                        <FileSearch size={14} className="text-gray-500" />
                                        <span className="tabular-nums">
                                            {selectedFileNames.length} file
                                            {selectedFileNames.length === 1 ? "" : "s"} selected
                                        </span>
                                    </span>
                                    {parsedView && (
                                        <>
                                            <MiniStat
                                                label="PVP"
                                                value={parsedView.buckets.pvp.length}
                                            />
                                            <MiniStat
                                                label="PVE"
                                                value={parsedView.buckets.pve.length}
                                            />
                                            <MiniStat
                                                label="Unknown"
                                                value={parsedView.buckets.unknownMode.length}
                                            />
                                        </>
                                    )}
                                    {isParsing && (
                                        <span className="inline-flex items-center gap-2 text-tarkov-green">
                                            <span className="size-2 rounded-full bg-tarkov-green" />
                                            Parsing logs...
                                        </span>
                                    )}
                                    {hasResults && (
                                        <button
                                            type="button"
                                            onClick={() => setShowInfo((current) => !current)}
                                            className="ml-auto inline-flex items-center gap-1 rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
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
                                </div>

                                {error && (
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-sm border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                        <AlertCircle size={14} />
                                        {error}
                                    </div>
                                )}

                                {importNotice && (
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-sm border border-tarkov-green/20 bg-tarkov-green/10 px-3 py-2 text-sm text-tarkov-green">
                                        <CheckCircle2 size={14} />
                                        {importNotice}
                                    </div>
                                )}
                            </section>
                        )}

                        {step === "select" &&
                            !isParsing &&
                            (!hasResults || !hasAnyImportableRows) && (
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
                                        <div className="flex items-center justify-center gap-2 mt-5 w-full rounded-sm border border-amber-400/35 bg-amber-500/12 px-4 py-3 text-center text-sm text-amber-100">
                                            <div>No new files seen.</div>
                                            <button
                                                type="button"
                                                onClick={handleClearCache}
                                                className="mt-1 text-xs text-amber-200 underline underline-offset-2 transition-colors hover:text-white"
                                            >
                                                Clear cache
                                            </button>
                                        </div>
                                    )}

                                    {!cacheNotice && hasResults && !hasAnyImportableRows && (
                                        <div className="mt-5 w-full rounded-sm border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-gray-300">
                                            All quests in logs are already completed.
                                        </div>
                                    )}
                                </section>
                            )}

                        {hasResults && parsedView && step === "select" && (
                            <div className="mt-5 space-y-5">
                                {showInfo && (
                                    <InfoPanel
                                        result={parsedView.result}
                                        unknownModeGroups={parsedView.buckets.unknownMode}
                                    />
                                )}

                                {hasAnyImportableRows && (
                                    <>
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
                                            onContinue={() => handleReviewMode("PVP")}
                                        />

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
                                            onContinue={() => handleReviewMode("PVE")}
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        {hasResults &&
                            parsedView &&
                            step === "review" &&
                            reviewMode &&
                            reviewPreview && (
                                <ReviewStep
                                    mode={reviewMode}
                                    importedRows={reviewImportedRows}
                                    prerequisiteQuests={reviewPrerequisiteQuests}
                                    blockedSensitiveQuestIds={reviewBlockedSensitiveQuestIds}
                                    didConfirmImport={didConfirmImport}
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
                                    onBack={() => {
                                        setStep("select");
                                        setDidConfirmImport(false);
                                        setAllowedSensitiveBackfillQuestIds([]);
                                        setDeniedSensitiveBackfillQuestIds([]);
                                    }}
                                    onConfirm={() => handleImportMode(reviewMode)}
                                    onClose={() => onOpenChange(false)}
                                />
                            )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
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
    onContinue,
}: {
    title: string;
    mode: ImportGameMode;
    rows: QuestImportRow[];
    completedQuests: Record<string, boolean>;
    autoCompleteSelections: AutoCompleteSelectionMap;
    onToggleAutoComplete: (mode: ImportGameMode, questId: string) => void;
    onEnableAll: () => void;
    onDisableAll: () => void;
    onContinue: () => void;
}) {
    return (
        <section className="rounded-lg border border-white/10 bg-black/20">
            <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 lg:flex-row lg:items-center">
                <div>
                    <h2 className="text-balance text-lg font-semibold text-white">{title}</h2>
                    <p className="mt-1 text-pretty text-sm text-gray-400">
                        {rows.length === 0
                            ? `No ${mode} quests were detected in the selected logs.`
                            : `Review detected ${mode} quests and choose which ones should auto-complete prerequisite chains during import.`}
                    </p>
                </div>

                {rows.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
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
                        <button
                            type="button"
                            onClick={onContinue}
                            className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-3 py-2 text-sm font-semibold text-tarkov-green transition-colors hover:border-tarkov-green/60"
                        >
                            Continue with {mode} Quests
                        </button>
                    </div>
                )}
            </div>

            {rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">Nothing to import here yet.</div>
            ) : (
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
                                        <div className="mt-1 text-xs text-gray-500">
                                            {row.questId}
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500 tabular-nums">
                                            Seen {row.occurrenceCount} · Events {row.eventCount} ·
                                            Files {row.sourceFiles.length}
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
                                                onChange={() =>
                                                    onToggleAutoComplete(mode, row.questId)
                                                }
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
            )}
        </section>
    );
}

function ReviewStep({
    mode,
    importedRows,
    prerequisiteQuests,
    blockedSensitiveQuestIds,
    didConfirmImport,
    getQuestName,
    onAllowSensitiveBackfill,
    onDenySensitiveBackfill,
    onBack,
    onConfirm,
    onClose,
}: {
    mode: ImportGameMode;
    importedRows: QuestImportRow[];
    prerequisiteQuests: FullQuest[];
    blockedSensitiveQuestIds: string[];
    didConfirmImport: boolean;
    getQuestName: (questId: string) => string;
    onAllowSensitiveBackfill: (questId: string) => void;
    onDenySensitiveBackfill: (questId: string) => void;
    onBack: () => void;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <section className="mt-5 rounded-lg border border-white/10 bg-black/20">
            <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 lg:flex-row lg:items-center">
                <div>
                    <h2 className="text-balance text-lg font-semibold text-white">
                        Review {mode} Import
                    </h2>
                    <p className="mt-1 text-pretty text-sm text-gray-400">
                        Confirm the quests detected from logs and the prerequisite quests that will
                        be auto-completed for this import pass.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
                    {!didConfirmImport && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                        >
                            Back
                        </button>
                    )}
                    {didConfirmImport ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-3 py-2 text-sm font-semibold text-tarkov-green transition-colors hover:border-tarkov-green/60"
                        >
                            Close
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={blockedSensitiveQuestIds.length > 0}
                            className={cn(
                                "rounded-sm px-3 py-2 text-sm font-semibold transition-colors",
                                blockedSensitiveQuestIds.length > 0
                                    ? "cursor-not-allowed border border-white/10 bg-black/30 text-gray-600"
                                    : "border border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-tarkov-green/60",
                            )}
                        >
                            Confirm Import
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-5 px-4 py-4">
                {didConfirmImport && (
                    <div className="inline-flex items-center gap-2 rounded-sm border border-tarkov-green/20 bg-tarkov-green/10 px-3 py-2 text-sm text-tarkov-green">
                        <CheckCircle2 size={14} />
                        Import applied to your current {mode} quest progress.
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                    <MiniStat label="Quests" value={importedRows.length} />
                    <MiniStat label="Prereqs" value={prerequisiteQuests.length} />
                </div>

                {blockedSensitiveQuestIds.length > 0 && (
                    <SensitiveBackfillGate
                        questIds={blockedSensitiveQuestIds}
                        getQuestName={getQuestName}
                        onAllow={onAllowSensitiveBackfill}
                        onDeny={onDenySensitiveBackfill}
                    />
                )}

                <ReviewList
                    title="Quests from Logs"
                    emptyState={`No ${mode} quests are queued for import.`}
                    items={importedRows.map((row) => ({
                        key: row.questId,
                        title: row.quest.name,
                        subtitle: row.questId,
                        meta:
                            row.hasStarted && row.hasCompleted
                                ? "Started + Completed"
                                : row.hasCompleted
                                  ? "Completed"
                                  : "Started",
                    }))}
                />

                {prerequisiteQuests.length > 0 && (
                    <ReviewList
                        title="Prerequisites to Auto-Complete"
                        emptyState="No prerequisite quests will be auto-completed."
                        items={prerequisiteQuests.map((quest) => ({
                            key: quest.id,
                            title: quest.name,
                            subtitle: quest.id,
                            meta: "Prerequisite",
                        }))}
                    />
                )}
            </div>
        </section>
    );
}

function SensitiveBackfillGate({
    questIds,
    getQuestName,
    onAllow,
    onDeny,
}: {
    questIds: string[];
    getQuestName: (questId: string) => string;
    onAllow: (questId: string) => void;
    onDeny: (questId: string) => void;
}) {
    return (
        <div className="rounded-sm border border-dashed border-red-500/60 px-3 py-3 text-sm text-gray-200">
            <div className="font-semibold text-red-400">
                Sensitive prerequisite backfill blocked.
            </div>
            <div className="mt-3 space-y-4">
                {questIds.map((questId) => (
                    <div key={questId}>
                        <div className="font-semibold">{getQuestName(questId)}</div>
                        <p className="mt-1 text-xs leading-5 text-gray-400">
                            {getSensitiveBackfillQuest(questId)?.warning}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onDeny(questId)}
                                className="rounded-sm border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300 transition-colors hover:border-white/25 hover:text-white"
                            >
                                Ignore Pre-requisites
                            </button>
                            <button
                                type="button"
                                onClick={() => onAllow(questId)}
                                className="rounded-sm border border-red-500/50 bg-red-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-100 transition-colors hover:border-red-400 hover:bg-red-500/25 hover:text-white"
                            >
                                Complete Pre-requisites
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ReviewList({
    title,
    emptyState,
    items,
}: {
    title: string;
    emptyState: string;
    items: { key: string; title: string; subtitle: string; meta: string }[];
}) {
    return (
        <section className="rounded-lg border border-white/10 bg-black/20">
            <div className="border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            {items.length === 0 ? (
                <div className="px-4 py-5 text-sm text-gray-500">{emptyState}</div>
            ) : (
                <div className="divide-y divide-white/5">
                    {items.map((item) => (
                        <div
                            key={item.key}
                            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                    {item.title}
                                </div>
                                <div className="text-xs text-gray-500">{item.subtitle}</div>
                            </div>
                            <div className="text-xs text-gray-400">{item.meta}</div>
                        </div>
                    ))}
                </div>
            )}
        </section>
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
