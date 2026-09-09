"use client";

import { useMemo, type CSSProperties } from "react";
import { useQuestsContext } from "../QuestsContext";
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FolderOpen,
    Info,
    TriangleAlert,
    Trash2,
    Upload,
} from "lucide-react";
import type { FullQuest } from "@/types/quests";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import {
    type ImportGameMode,
    type QuestImportBuckets,
    type QuestImportRow,
} from "@/lib/utils/quest-log-import";
import {
    type ParsedQuestEvent,
    type QuestLogParseResult,
} from "@/lib/utils/quest-log-parser";
import {
    buildQuestAvailabilityMap,
    isQuestAvailableForProfile,
} from "@/lib/utils/quest-availability";
import { NETWORK_PROVIDER_PART_1_ID, getSensitiveBackfillQuest, getSensitiveBackfillQuestName } from "@/lib/utils/sensitive-quest-backfill";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { QuestListByTrader } from "./QuestListByTrader";
import { getSelectionKey, type AutoCompleteSelectionMap, type ImportSummary } from "./quest-log-import-model";
import { useQuestLogImportController } from "./useQuestLogImportController";
import { PROFILE_BASE_COLORS } from "@/lib/cfg/profile-colors";

interface QuestLogImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quests: FullQuest[];
}

export function QuestLogImportDialog({ open, onOpenChange, quests }: QuestLogImportDialogProps) {
    const { questsById } = useQuestsContext();
    const gameMode = useUserStore((state) => state.gameMode);
    const profiles = useUserStore((state) => state.profiles);
    const availableQuestIdsByMode = useMemo(() => {
        const availabilityMap = buildQuestAvailabilityMap(quests);
        const result = {} as Record<ImportGameMode, Set<string>>;

        for (const mode of ["PVP", "PVE", "KORD"] as const) {
            const profile = profiles[mode];
            const availableIds = new Set<string>();
            const availabilityProfile = {
                playerLevel: profile.playerLevel,
                prestigeLevel: profile.prestigeLevel,
                faction: profile.questFaction,
                traderLoyaltyLevels: profile.questTraderLoyaltyLevels,
                fenceReputation: profile.questFenceReputation,
                completedQuests: profile.completedQuests,
            };

            for (const quest of quests) {
                if (isQuestAvailableForProfile(quest, availabilityProfile, availabilityMap)) {
                    availableIds.add(quest.id);
                }
            }

            result[mode] = availableIds;
        }

        return result;
    }, [profiles, quests]);

    const controller = useQuestLogImportController({
        quests,
        questsById,
        gameMode,
        profiles,
        availableQuestIdsByMode,
    });
    const { state, modeModels, reviewModel, fileInputRef, directoryInputProps, commands } = controller;
    const {
        parsedView,
        selectedFileNames,
        error,
        showInfo,
        importNotice,
        cacheNotice,
        preWipeIgnoredFileNames,
        autoCompleteSelections,
        reviewMode,
        importSummary,
        allowedSensitiveBackfillQuestIds,
        deniedSensitiveBackfillQuestIds,
    } = state;
    const isParsing = state.status === "parsing";
    const didConfirmImport = state.status === "success";
    const step = state.status === "review" || state.status === "applying" || state.status === "success" ? "review" : "select";
    const hasResults = !!parsedView;
    const hasPreWipeIgnoredFiles = preWipeIgnoredFileNames.length > 0;
    const filteredPvpRows = modeModels.find((model) => model.mode === "PVP")?.rows ?? [];
    const filteredPveRows = modeModels.find((model) => model.mode === "PVE")?.rows ?? [];
    const filteredKordRows = modeModels.find((model) => model.mode === "KORD")?.rows ?? [];
    const hasAnyImportableRows = modeModels.some((model) => model.rows.length > 0);
    const reviewPreview = reviewModel;
    const reviewImportedRows = reviewModel?.importedRows ?? [];
    const reviewPrerequisiteQuests = reviewModel?.prerequisiteQuests ?? [];
    const reviewBlockedSensitiveQuestIds = reviewModel?.blockedSensitiveQuestIds ?? [];
    const reviewSensitiveDecisionQuestIds = reviewModel?.sensitiveDecisionQuestIds ?? [];
    const showSourceSummary = isParsing || step === "review" || hasResults || selectedFileNames.length > 0;
    const showSelectFooter = step === "select" && hasResults && hasAnyImportableRows;
    const showReviewFooter = step === "review" && !!reviewMode && !!reviewPreview;
    const canClearSelection = isParsing || hasResults || selectedFileNames.length > 0;
    const showSuccessBanner = didConfirmImport;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] max-w-6xl overflow-hidden p-0">
                <div className="flex max-h-[90dvh] flex-col">
                    <DialogHeader className="border-b border-highlight/10 px-6 py-5">
                        <DialogTitle className="text-balance text-xl text-foreground">
                            Quest Log Import
                        </DialogTitle>
                        <DialogDescription className="max-w-3xl text-pretty text-sm text-muted-foreground">
                            Upload EFT push-notification logs at the end of a play session to update
                            quest completion state or quickly get back up to speed. For more
                            in-depth quest syncing, especially when starting fresh on the site, try
                            the main sync feature.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4">
                        <input ref={fileInputRef} className="hidden" {...directoryInputProps} />

                        {showSourceSummary && (
                            <section className="flex flex-col rounded-lg border border-highlight/10 bg-shadow/20 p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                            <FolderOpen size={16} className="text-brand" />
                                            Choose EFT logs folder
                                        </div>
                                        <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
                                            The importer reads {gameMode} quest notifications for
                                            your active profile. Other modes in the same files stay
                                            unprocessed for a later upload.
                                        </p>
                                        <p className="text-xs text-subtle-foreground">
                                            <code className="rounded bg-highlight/5 px-1.5 py-0.5 text-foreground">
                                                ~\Battlestate Games\EFT\Logs
                                            </code>{" "}
                                            upload the whole logs folder or individual sub-folders.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                        <button
                                            type="button"
                                            onClick={commands.chooseFolder}
                                            aria-controls="quest-log-folder-upload"
                                            className={cn(
                                                "inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors",
                                                selectedFileNames.length > 0
                                                    ? "border-highlight/10 bg-highlight/5 text-foreground hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
                                                    : "border-brand/30 bg-brand/10 font-semibold text-brand hover:border-brand/60",
                                            )}
                                        >
                                            <Upload size={14} />
                                            {selectedFileNames.length > 0
                                                ? "Change Folder"
                                                : "Choose Folder"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={commands.clear}
                                            disabled={!canClearSelection}
                                            aria-label="Clear selected folder"
                                            className="inline-flex size-10 items-center justify-center rounded-sm border border-highlight/10 bg-highlight/5 text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                {isParsing && (
                                    <div className="mt-4 rounded-lg border border-highlight/10 bg-shadow/30 px-3 py-3">
                                        <span className="inline-flex items-center gap-2 text-success">
                                            <span className="size-2 rounded-full bg-success" />
                                            Parsing logs...
                                        </span>
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-sm border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                                        <AlertCircle size={14} />
                                        {error}
                                    </div>
                                )}

                                {importNotice && !showSuccessBanner && (
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-sm border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
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
                                <section className="mt-5 rounded-lg border border-dashed border-highlight/10 bg-shadow/10 p-8 text-center">
                                    <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
                                        <CheckCircle2 size={24} className="text-success/80" />
                                        <h2 className="text-balance text-lg font-semibold text-foreground">
                                            Ready to inspect and import quest notifications
                                        </h2>
                                        <p className="text-pretty text-sm text-muted-foreground">
                                            Choose your EFT logs folder and the importer will
                                            import {gameMode} quest notifications for your active
                                            profile. Other modes in the same files stay unprocessed.
                                        </p>
                                        <p className="text-xs text-subtle-foreground">
                                            <code className="rounded bg-highlight/5 px-1.5 py-0.5 text-foreground">
                                                ~\Battlestate Games\EFT\Logs
                                            </code>{" "}
                                            upload the whole logs folder or individual sub-folders.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={commands.chooseFolder}
                                            className="rounded-sm border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand transition-colors hover:border-brand/60"
                                        >
                                            Choose Logs Folder
                                        </button>
                                    </div>

                                    {cacheNotice && (
                                        <div className="mt-5 flex w-full flex-col items-center justify-center gap-3 rounded-sm border border-warning/35 bg-warning/12 px-4 py-3 text-center text-sm text-warning sm:flex-row sm:flex-wrap">
                                            <div>{cacheNotice}</div>
                                            <button
                                                type="button"
                                                onClick={commands.clearCache}
                                                className="text-xs text-warning underline underline-offset-2 transition-colors hover:text-foreground"
                                            >
                                                Clear cache
                                            </button>
                                            <button
                                                type="button"
                                                onClick={commands.ignoreCache}
                                                className="rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning transition-colors hover:border-warning/60 hover:bg-warning/20 hover:text-foreground"
                                            >
                                                Ignore for these files
                                            </button>
                                        </div>
                                    )}
                                </section>
                            )}

                        {cacheNotice && showSourceSummary && (
                            <div className="mt-5 rounded-sm border border-warning/35 bg-warning/12 px-4 py-3 text-sm text-warning">
                                <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:flex-wrap">
                                    <div>{cacheNotice}</div>
                                    <button
                                        type="button"
                                        onClick={commands.clearCache}
                                        className="text-xs text-warning underline underline-offset-2 transition-colors hover:text-foreground"
                                    >
                                        Clear cache
                                    </button>
                                    <button
                                        type="button"
                                        onClick={commands.ignoreCache}
                                        className="rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning transition-colors hover:border-warning/60 hover:bg-warning/20 hover:text-foreground"
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
                                <section className="mt-5 rounded-lg border border-highlight/10 bg-shadow/20 px-4 py-4 text-sm text-foreground">
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
                                        completedQuests={profiles.PVP.completedQuests}
                                        autoCompleteSelections={autoCompleteSelections}
                                        onToggleAutoComplete={commands.toggleAutoComplete}
                                        onEnableAll={() =>
                                            commands.setAllForMode("PVP", filteredPvpRows, true)
                                        }
                                        onDisableAll={() =>
                                            commands.setAllForMode("PVP", filteredPvpRows, false)
                                        }
                                    />
                                )}

                                {filteredPveRows.length > 0 && (
                                    <ModeSection
                                        title="PVE Quests"
                                        mode="PVE"
                                        rows={filteredPveRows}
                                        completedQuests={profiles.PVE.completedQuests}
                                        autoCompleteSelections={autoCompleteSelections}
                                        onToggleAutoComplete={commands.toggleAutoComplete}
                                        onEnableAll={() =>
                                            commands.setAllForMode("PVE", filteredPveRows, true)
                                        }
                                        onDisableAll={() =>
                                            commands.setAllForMode("PVE", filteredPveRows, false)
                                        }
                                    />
                                )}

                                {filteredKordRows.length > 0 && (
                                    <ModeSection
                                        title="KORD Seasonal Quests"
                                        mode="KORD"
                                        rows={filteredKordRows}
                                        completedQuests={profiles.KORD.completedQuests}
                                        autoCompleteSelections={autoCompleteSelections}
                                        onToggleAutoComplete={commands.toggleAutoComplete}
                                        onEnableAll={() =>
                                            commands.setAllForMode("KORD", filteredKordRows, true)
                                        }
                                        onDisableAll={() =>
                                            commands.setAllForMode("KORD", filteredKordRows, false)
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
                                        onAllowSensitiveBackfill={commands.allowSensitiveQuest}
                                        onDenySensitiveBackfill={commands.denySensitiveQuest}
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
                        <div className="border-t border-highlight/10 bg-card/95 px-6 py-3 backdrop-blur">
                            {showSelectFooter && (
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <button
                                        type="button"
                                        onClick={commands.clear}
                                        className="inline-flex items-center gap-2 rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-sm text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
                                    >
                                        <ArrowLeft size={14} />
                                        Back
                                    </button>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                        <span className="text-sm text-muted-foreground">
                                            Import quests from:
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {filteredPvpRows.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => commands.reviewMode("PVP")}
                                                    style={{ "--profile-color": PROFILE_BASE_COLORS.PVP } as CSSProperties}
                                                    className="rounded-sm border border-[color-mix(in_srgb,var(--profile-color)_45%,transparent)] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--profile-color)_22%,var(--background)),color-mix(in_srgb,var(--profile-color)_10%,var(--background)))] px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--profile-color)_60%,transparent)] hover:bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--profile-color)_30%,var(--background)),color-mix(in_srgb,var(--profile-color)_15%,var(--background)))]"
                                                >
                                                    Import PVP Quests
                                                </button>
                                            )}
                                            {filteredPveRows.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => commands.reviewMode("PVE")}
                                                    style={{ "--profile-color": PROFILE_BASE_COLORS.PVE } as CSSProperties}
                                                    className="rounded-sm border border-[color-mix(in_srgb,var(--profile-color)_45%,transparent)] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--profile-color)_22%,var(--background)),color-mix(in_srgb,var(--profile-color)_10%,var(--background)))] px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--profile-color)_60%,transparent)] hover:bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--profile-color)_30%,var(--background)),color-mix(in_srgb,var(--profile-color)_15%,var(--background)))]"
                                                >
                                                    Import PVE Quests
                                                </button>
                                            )}
                                            {filteredKordRows.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => commands.reviewMode("KORD")}
                                                    style={{ "--profile-color": PROFILE_BASE_COLORS.KORD } as CSSProperties}
                                                    className="rounded-sm border border-[color-mix(in_srgb,var(--profile-color)_45%,transparent)] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--profile-color)_22%,var(--background)),color-mix(in_srgb,var(--profile-color)_10%,var(--background)))] px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--profile-color)_60%,transparent)] hover:bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--profile-color)_30%,var(--background)),color-mix(in_srgb,var(--profile-color)_15%,var(--background)))]"
                                                >
                                                    Import KORD Seasonal Quests
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
                                            onClick={commands.cancelReview}
                                            className="inline-flex items-center gap-2 rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-sm text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
                                        >
                                            <ArrowLeft size={14} />
                                            Back
                                        </button>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                        {!didConfirmImport && (
                                            <button
                                                type="button"
                                                onClick={commands.toggleInfo}
                                                className="inline-flex items-center gap-1 rounded-sm border border-highlight/10 bg-highlight/5 px-2.5 py-2 text-xs text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
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
                                                className="rounded-sm border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand transition-colors hover:border-brand/60"
                                            >
                                                Close
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => commands.applyImport(reviewMode)}
                                                disabled={reviewBlockedSensitiveQuestIds.length > 0}
                                                className={cn(
                                                    "rounded-sm px-3 py-2 text-sm font-semibold transition-colors",
                                                    reviewBlockedSensitiveQuestIds.length > 0
                                                        ? "cursor-not-allowed border border-highlight/10 bg-shadow/30 text-subtle-foreground"
                                                        : "border border-brand/30 bg-brand/10 text-brand hover:border-brand/60",
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
        <div className="mt-4 flex w-full items-center gap-2 rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
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
        "from-[color-mix(in_srgb,var(--profile-color)_25%,transparent)] via-[color-mix(in_srgb,var(--profile-color)_8%,transparent)] to-transparent";

    return (
        <section
            style={{ "--profile-color": PROFILE_BASE_COLORS[mode] } as CSSProperties}
            className="rounded-lg border border-highlight/10 bg-shadow/20"
        >
            <div className="relative flex flex-col gap-3 overflow-hidden border-b border-highlight/10 px-4 py-3 lg:flex-row lg:items-center">
                <div
                    aria-hidden="true"
                    className={cn(
                        "pointer-events-none absolute -left-6 -top-8 h-20 w-32 rounded-full bg-gradient-to-br blur-2xl",
                        accentClasses,
                    )}
                />
                <div className="relative">
                    <h2 className="text-balance text-lg font-semibold text-foreground">{title}</h2>
                </div>

                <div className="relative flex flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
                    <button
                        type="button"
                        onClick={onEnableAll}
                        className="rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-sm text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
                    >
                        Enable All
                    </button>
                    <button
                        type="button"
                        onClick={onDisableAll}
                        className="rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-sm text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
                    >
                        Disable All
                    </button>
                </div>
            </div>

            <div className="divide-y divide-highlight/5">
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
                                        <div className="truncate text-base font-semibold text-foreground">
                                            {row.quest.name}
                                        </div>
                                        <QuestStateBadge
                                            hasStarted={row.hasStarted}
                                            hasCompleted={row.hasCompleted}
                                        />
                                        {alreadyCompleted && (
                                            <span className="inline-flex items-center rounded-full border border-success/20 bg-success/10 px-2 py-1 text-[11px] font-medium uppercase text-success">
                                                Already Complete
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs text-subtle-foreground">{row.questId}</div>
                                    <div className="mt-2 text-xs text-subtle-foreground tabular-nums">
                                        Seen {row.occurrenceCount} · Events {row.eventCount} · Files{" "}
                                        {row.sourceFiles.length}
                                    </div>
                                </div>

                                <div className="flex flex-col items-start gap-3 lg:items-end">
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                        Latest: {formatTimestamp(row.latestTimestamp)}
                                    </div>
                                    <label className="inline-flex items-center gap-3 rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-sm text-foreground">
                                        <input
                                            type="checkbox"
                                            checked={autoCompleteEnabled}
                                            onChange={() => onToggleAutoComplete(mode, row.questId)}
                                            className="size-4 accent-brand"
                                        />
                                        Auto-complete prerequisites
                                    </label>
                                </div>
                            </div>

                            {showNetworkProviderWarning && (
                                <div className="mt-4 rounded-sm border border-danger/35 bg-danger/12 px-3 py-2 text-xs font-semibold text-danger">
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
                <div className="rounded-lg border border-success/25 bg-success/12 px-5 py-5 text-success">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-success" />
                        <div>
                            <div className="text-base font-semibold text-foreground">
                                Successfully imported {importedCount} quest
                                {importedCount === 1 ? "" : "s"} and auto-completed{" "}
                                {prerequisiteCount} quest
                                {prerequisiteCount === 1 ? "" : "s"}.
                            </div>
                            <div className="mt-1 text-sm text-success/80">
                                Your current {successMode} quest progress has been updated.
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="mt-5 rounded-lg border border-highlight/10 bg-shadow/20">
            <div className="border-b border-highlight/10 px-4 py-4">
                <div>
                    <h2 className="text-balance text-lg font-semibold text-foreground">
                        Review {mode} Import
                    </h2>
                    <p className="mt-1 text-pretty text-sm text-muted-foreground">
                        Confirm the quests detected from logs and the prerequisite quests that will
                        be auto-completed for this import pass.
                    </p>
                </div>
            </div>

            <div className="space-y-5 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
                    <h3 className="text-sm font-semibold text-foreground">Quests from Logs</h3>
                    <QuestListByTrader
                        questIds={importedRows.map((row) => row.questId)}
                        questsById={questsById}
                        itemPrefix={() => <Check size={14} className="shrink-0 text-success" />}
                        emptyMessage={`No ${mode} quests are queued for import.`}
                    />
                </section>

                {prerequisiteQuests.length > 0 && (
                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">
                            Prerequisites to Auto-Complete
                        </h3>
                        <QuestListByTrader
                            questIds={prerequisiteQuests.map((quest) => quest.id)}
                            questsById={questsById}
                            itemPrefix={() => (
                                <Check size={14} className="shrink-0 text-success" />
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
                "rounded-sm px-3 py-3 text-sm text-foreground transition-colors",
                hasUnresolvedChoices
                    ? "border border-dashed border-danger/60"
                    : "border border-highlight/10 bg-highlight/5",
            )}
        >
            <div
                className={cn(
                    "font-semibold",
                    hasUnresolvedChoices ? "text-danger" : "text-foreground",
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
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {getSensitiveBackfillQuest(questId)?.warning}
                            </p>
                        </div>
                        <div className="inline-flex shrink-0 overflow-hidden rounded-sm border border-highlight/10 lg:mt-0">
                            <button
                                type="button"
                                onClick={() => onDeny(questId)}
                                className={cn(
                                    "px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                                    deniedSet.has(questId)
                                        ? "bg-highlight/10 text-foreground"
                                        : "bg-transparent text-foreground hover:bg-highlight/5 hover:text-foreground",
                                )}
                            >
                                Deny
                            </button>
                            <button
                                type="button"
                                onClick={() => onAllow(questId)}
                                className={cn(
                                    "inline-flex items-center gap-1 border-l border-highlight/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                                    allowedSet.has(questId)
                                        ? "bg-danger/15 text-danger"
                                        : "bg-transparent text-foreground hover:bg-danger/10 hover:text-foreground",
                                )}
                            >
                                <TriangleAlert size={12} className="text-warning" />
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
    unknownModeGroups: QuestImportBuckets["unknownMode"];
}) {
    return (
        <section className="rounded-lg border border-highlight/10 bg-shadow/20">
            <div className="border-b border-highlight/10 px-4 py-3">
                <h2 className="text-balance text-lg font-semibold text-foreground">Import Details</h2>
                <p className="mt-1 text-pretty text-sm text-muted-foreground">
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
                    <SummaryCard label="KORD" value={result.totals.kordEvents} />
                    <SummaryCard label="Resolved Groups" value={result.resolvedGroups.length} />
                </section>

                <section className="rounded-lg border border-highlight/10 bg-shadow/20">
                    <div className="border-b border-highlight/10 px-4 py-3">
                        <h3 className="text-sm font-semibold text-foreground">Unknown Mode Quests</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            These were resolved to known quests but no prior mode signal was found.
                        </p>
                    </div>

                    {unknownModeGroups.length === 0 ? (
                        <div className="px-4 py-5 text-sm text-subtle-foreground">
                            No unknown-mode quests were detected.
                        </div>
                    ) : (
                        <div className="divide-y divide-highlight/5">
                            {unknownModeGroups.map((group) => (
                                <div key={`${group.questId}-${group.type}`} className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-foreground">
                                            {group.quest?.name ?? group.questId}
                                        </span>
                                        <TypeBadge type={group.type} />
                                        <CountBadge label="Seen" value={group.occurrenceCount} />
                                    </div>
                                    <div className="mt-1 text-xs text-subtle-foreground">
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
        <div className="rounded-lg border border-highlight/10 bg-shadow/20 p-4">
            <div className="text-xs font-medium text-subtle-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-highlight/10 bg-highlight/5 px-2 py-1 text-xs text-foreground">
            <span>{label}</span>
            <span className="tabular-nums text-foreground">{value}</span>
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
                    ? "border-success/25 bg-success/10 text-success"
                    : "border-info/25 bg-info/10 text-info",
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
                    ? "border-success/25 bg-success/10 text-success"
                    : "border-info/25 bg-info/10 text-info",
            )}
        >
            {type}
        </span>
    );
}

function CountBadge({ label, value }: { label: string; value: number }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-highlight/10 bg-highlight/5 px-2 py-1 text-[11px] text-foreground">
            <span>{label}</span>
            <span className="tabular-nums text-foreground">{value}</span>
        </span>
    );
}

function RawEventsSection({ events }: { events: ParsedQuestEvent[] }) {
    return (
        <section className="rounded-lg border border-highlight/10 bg-shadow/20">
            <div className="border-b border-highlight/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Raw Events</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Deduped event list for spot checking timestamps, source files, IDs, and mode
                    tags.
                </p>
            </div>

            {events.length === 0 ? (
                <div className="px-4 py-6 text-sm text-subtle-foreground">No quest events were parsed.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-highlight/5 text-xs uppercase text-subtle-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Timestamp</th>
                                <th className="px-4 py-3 font-medium">Quest</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Mode</th>
                                <th className="px-4 py-3 font-medium">Seen</th>
                                <th className="px-4 py-3 font-medium">Source File</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-highlight/5">
                            {events.map((event, index) => (
                                <tr
                                    key={`${event.questId}-${event.type}-${event.raidMode}-${index}`}
                                >
                                    <td className="px-4 py-3 text-foreground tabular-nums">
                                        {formatTimestamp(event.timestamp)}
                                    </td>
                                    <td className="px-4 py-3 text-foreground">{event.questId}</td>
                                    <td className="px-4 py-3">
                                        <TypeBadge type={event.type} />
                                    </td>
                                    <td className="px-4 py-3 text-foreground uppercase">
                                        {event.raidMode}
                                    </td>
                                    <td className="px-4 py-3 text-foreground tabular-nums">
                                        {event.occurrenceCount}
                                    </td>
                                    <td className="px-4 py-3 text-subtle-foreground">{event.sourceFile}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
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
