"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuestActions } from "../QuestActionsContext";
import {
	AlertCircle,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	CircleDot,
	FolderOpen,
	MinusCircle,
	TriangleAlert,
	Upload,
} from "lucide-react";
import type { QuestWorkspaceQuest } from "@/types/quests";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { IMPORT_GAME_MODES, type ImportGameMode, type QuestImportBuckets } from "@/lib/quests/quest-log-import";
import { type ParsedQuestEvent, type QuestLogParseResult } from "@/lib/quests/quest-log-parser";
import { buildQuestAvailabilityMap, isQuestAvailableForProfile } from "@/lib/quests/quest-availability";
import { getSensitiveBackfillQuest, getSensitiveBackfillQuestName } from "@/lib/quests/sensitive-quest-backfill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuestListByTrader } from "../components/QuestListByTrader";
import { type ImportSummary } from "./quest-log-import-model";
import { useQuestLogImportController } from "./useQuestLogImportController";

interface QuestLogImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	quests: QuestWorkspaceQuest[];
}

const secondaryButton =
	"inline-flex items-center gap-2 rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-sm text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10";
const primaryButton =
	"inline-flex items-center gap-2 rounded-sm border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand transition-colors hover:border-brand/60 disabled:cursor-not-allowed disabled:border-highlight/10 disabled:bg-shadow/30 disabled:text-subtle-foreground";

export function QuestLogImportDialog({ open, onOpenChange, quests }: QuestLogImportDialogProps) {
	const { questsById } = useQuestActions();
	const gameMode = useUserStore((state) => state.gameMode);
	const profiles = useUserStore((state) => state.profiles);
	const availableQuestIdsByMode = useMemo(() => {
		const availabilityMap = buildQuestAvailabilityMap(quests);
		const result = {} as Record<ImportGameMode, Set<string>>;

		for (const mode of IMPORT_GAME_MODES) {
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
		error,
		showInfo,
		cacheNotice,
		preWipeIgnoredFileNames,
		autoCompleteSelections,
		reviewMode,
		importSummary,
		allowedSensitiveBackfillQuestIds,
		deniedSensitiveBackfillQuestIds,
	} = state;
	const isParsing = state.status === "parsing";
	const isSuccess = state.status === "success";
	const isReview = (state.status === "review" || state.status === "applying") && !!reviewMode && !!reviewModel;
	const isSelect = !isReview && !isSuccess;

	const mode = reviewMode ?? gameMode;
	const reviewRows = modeModels.find((model) => model.mode === mode)?.rows ?? [];
	const importedRows = reviewModel?.importedRows ?? [];
	const prerequisiteQuests = reviewModel?.prerequisiteQuests ?? [];
	const blockedSensitiveQuestIds = reviewModel?.blockedSensitiveQuestIds ?? [];
	const sensitiveDecisionQuestIds = reviewModel?.sensitiveDecisionQuestIds ?? [];
	const autoCompleteAll =
		reviewRows.length > 0 && reviewRows.every((row) => autoCompleteSelections[`${mode}:${row.questId}`]);
	const hasPreWipeIgnoredFiles = preWipeIgnoredFileNames.length > 0;
	const hasChanges = reviewRows.length > 0;
	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) commands.clear();
		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-h-[90dvh] max-w-3xl overflow-hidden p-0"
				{...(isSelect ? {} : { "aria-describedby": undefined })}
			>
				<div className="flex max-h-[90dvh] flex-col">
					<input ref={fileInputRef} className="hidden" {...directoryInputProps} />

					{isSelect ? (
						<DialogHeader className="px-6 pb-2 pt-5">
							<DialogTitle className="text-balance text-lg text-foreground">Quest Log Import</DialogTitle>
							<DialogDescription className="text-pretty text-sm text-muted-foreground">
								Update {mode} quest progress from EFT logs. Lightkeeper quests are not synced yet.
							</DialogDescription>
						</DialogHeader>
					) : (
						<DialogTitle className="sr-only">Quest Log Import</DialogTitle>
					)}

					<div className="flex-1 overflow-y-auto px-6 py-5">
						{isSelect && (
							<div className="flex flex-col items-center gap-3 text-center">
								<LogDropzone busy={isParsing} onChoose={commands.chooseFolder} onDrop={commands.dropFolder} />
								{error && <Notice tone="danger" icon={<AlertCircle size={14} />} message={error} />}
								{cacheNotice && (
									<div className="flex flex-wrap items-center justify-center gap-3 rounded-sm border border-warning/35 bg-warning/12 px-4 py-3 text-sm text-warning">
										<span>{cacheNotice}</span>
										<button
											type="button"
											onClick={commands.clearCache}
											className="text-xs underline underline-offset-2 hover:text-foreground"
										>
											Clear cache
										</button>
										<button
											type="button"
											onClick={commands.ignoreCache}
											className="rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold hover:border-warning/60 hover:text-foreground"
										>
											Ignore for these files
										</button>
									</div>
								)}
								{hasPreWipeIgnoredFiles && <PreWipeCutoffNotice fileCount={preWipeIgnoredFileNames.length} />}
							</div>
						)}

						{isReview && (
							<div className="space-y-5">
								{hasChanges && (
									<div className="flex flex-wrap items-center justify-between gap-3 pr-8">
										<h2 className="text-balance text-lg font-semibold text-foreground">
											{importedRows.length} {mode} quest{importedRows.length === 1 ? "" : "s"} will change
										</h2>
										<label className="inline-flex items-center gap-2 text-sm text-foreground">
											<input
												type="checkbox"
												checked={autoCompleteAll}
												onChange={() => commands.setAllForMode(mode, reviewRows, !autoCompleteAll)}
												className="size-4 accent-brand"
											/>
											Complete prerequisites
										</label>
									</div>
								)}

								{!hasChanges ? (
									<NothingImported message={`Your ${mode} progress already matches these logs.`} />
								) : (
									<>
										{sensitiveDecisionQuestIds.length > 0 && (
											<SensitiveBackfillGate
												questIds={sensitiveDecisionQuestIds}
												allowedQuestIds={allowedSensitiveBackfillQuestIds}
												deniedQuestIds={deniedSensitiveBackfillQuestIds}
												getQuestName={(questId) => getSensitiveBackfillQuestName(questId, questsById)}
												onAllow={commands.allowSensitiveQuest}
												onDeny={commands.denySensitiveQuest}
											/>
										)}

										<QuestListByTrader
											questIds={importedRows.map((row) => row.questId)}
											questsById={questsById}
											itemPrefix={(quest) => {
												const row = importedRows.find((candidate) => candidate.questId === quest.id);
												return row?.hasCompleted ? (
													<Check size={14} className="shrink-0 text-success" aria-label="Completed" />
												) : (
													<CircleDot size={14} className="shrink-0 text-info" aria-label="Started" />
												);
											}}
										/>

										{prerequisiteQuests.length > 0 && (
											<section className="space-y-2">
												<h3 className="text-sm font-semibold text-foreground">
													Prerequisites to complete ({prerequisiteQuests.length})
												</h3>
												<QuestListByTrader
													questIds={prerequisiteQuests.map((quest) => quest.id)}
													questsById={questsById}
													itemPrefix={() => <Check size={14} className="shrink-0 text-success" />}
												/>
											</section>
										)}
									</>
								)}

								{hasPreWipeIgnoredFiles && <PreWipeCutoffNotice fileCount={preWipeIgnoredFileNames.length} />}
								{error && <Notice tone="danger" icon={<AlertCircle size={14} />} message={error} />}
								{showInfo && parsedView && (
									<InfoPanel result={parsedView.result} unknownModeGroups={parsedView.buckets.unknownMode} />
								)}
							</div>
						)}

						{isSuccess && <ImportResult summary={importSummary} mode={mode} />}
					</div>

					{isReview && (
						<div className="flex items-center justify-between gap-3 border-t border-highlight/10 px-6 py-3">
							<button type="button" onClick={commands.cancelReview} className={secondaryButton}>
								Back
							</button>
							<div className="flex items-center gap-2">
								<button type="button" onClick={commands.toggleInfo} className={secondaryButton}>
									Details
									{showInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
								</button>
								{hasChanges ? (
									<button
										type="button"
										onClick={() => commands.applyImport(mode)}
										disabled={blockedSensitiveQuestIds.length > 0 || state.status === "applying"}
										className={primaryButton}
									>
										Confirm import
									</button>
								) : (
									<button type="button" onClick={() => handleOpenChange(false)} className={primaryButton}>
										Close
									</button>
								)}
							</div>
						</div>
					)}

					{isSuccess && (
						<div className="flex justify-end border-t border-highlight/10 px-6 py-3">
							<button type="button" onClick={() => handleOpenChange(false)} className={primaryButton}>
								Close
							</button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function LogDropzone({
	busy,
	onChoose,
	onDrop,
}: {
	busy: boolean;
	onChoose: () => void;
	onDrop: (dataTransfer: DataTransfer) => void;
}) {
	const [dragging, setDragging] = useState(false);

	return (
		<div
			role="button"
			tabIndex={0}
			aria-label="Choose EFT logs folder"
			aria-disabled={busy}
			onClick={() => !busy && onChoose()}
			onKeyDown={(event) => {
				if (!busy && (event.key === "Enter" || event.key === " ")) {
					event.preventDefault();
					onChoose();
				}
			}}
			onDragOver={(event) => {
				event.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(event) => {
				event.preventDefault();
				setDragging(false);
				if (!busy) onDrop(event.dataTransfer);
			}}
			className={cn(
				"flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 transition-colors",
				dragging ? "border-brand/60 bg-brand/10" : "border-highlight/15 bg-highlight/[0.03] hover:border-highlight/30",
				busy && "cursor-progress opacity-70",
			)}
		>
			<Upload size={28} className={dragging ? "text-brand" : "text-muted-foreground"} />
			<div>
				<div className="text-base font-semibold text-foreground">
					{busy ? "Reading logs…" : "Drop your EFT logs folder here"}
				</div>
				<div className="mt-1 text-sm text-muted-foreground">or click to browse</div>
			</div>
			<button
				type="button"
				disabled={busy}
				onClick={(event) => {
					event.stopPropagation();
					onChoose();
				}}
				className={secondaryButton}
			>
				<FolderOpen size={14} />
				Choose folder
			</button>
			<div className="space-y-1 text-xs text-subtle-foreground">
				<p>
					Usually found at{" "}
					<code className="whitespace-nowrap rounded bg-highlight/5 px-1.5 py-0.5 font-mono text-foreground">
						{String.raw`~\Battlestate Games\EFT\Logs`}
					</code>
				</p>
				<p>Select the whole Logs folder or a single log_ subfolder.</p>
			</div>
		</div>
	);
}

function Notice({ tone, icon, message }: { tone: "danger" | "warning"; icon: ReactNode; message: string }) {
	return (
		<div
			className={cn(
				"inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm",
				tone === "danger"
					? "border-danger/20 bg-danger/10 text-danger"
					: "border-warning/30 bg-warning/10 text-warning",
			)}
		>
			{icon}
			{message}
		</div>
	);
}

function PreWipeCutoffNotice({ fileCount }: { fileCount: number }) {
	return (
		<Notice
			tone="warning"
			icon={<AlertCircle size={14} />}
			message={`Log files older than the November 2025 wipe were ignored${fileCount > 1 ? ` (${fileCount} files)` : ""}.`}
		/>
	);
}

function NothingImported({ message }: { message: string }) {
	return (
		<div className="flex items-center gap-3 rounded-md bg-highlight/5 px-4 py-4 text-muted-foreground">
			<MinusCircle size={20} className="shrink-0" />
			<div>
				<div className="text-base font-semibold text-foreground">Nothing was imported</div>
				<div className="mt-0.5 text-sm">{message}</div>
			</div>
		</div>
	);
}

function ImportResult({ summary, mode }: { summary: ImportSummary | null; mode: ImportGameMode }) {
	const importedCount = summary?.importedCount ?? 0;
	const prerequisiteCount = summary?.prerequisiteCount ?? 0;
	if (importedCount === 0 && prerequisiteCount === 0) {
		return <NothingImported message={`No ${mode} quests needed updating.`} />;
	}
	return (
		<div className="flex items-center gap-3 rounded-md border border-success/25 bg-success/12 px-4 py-4">
			<CheckCircle2 size={20} className="shrink-0 text-success" />
			<div>
				<div className="text-base font-semibold text-foreground">
					Imported {importedCount} quest{importedCount === 1 ? "" : "s"}
					{prerequisiteCount > 0
						? ` and completed ${prerequisiteCount} prerequisite${prerequisiteCount === 1 ? "" : "s"}`
						: ""}
					.
				</div>
				<div className="mt-0.5 text-sm text-success/80">Your {summary?.mode ?? mode} quest progress is up to date.</div>
			</div>
		</div>
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
	const hasUnresolvedChoices = questIds.some((questId) => !allowedSet.has(questId) && !deniedSet.has(questId));

	return (
		<div
			className={cn(
				"rounded-sm px-3 py-3 text-sm text-foreground transition-colors",
				hasUnresolvedChoices ? "border border-dashed border-danger/60" : "border border-highlight/10 bg-highlight/5",
			)}
		>
			<div className={cn("font-semibold", hasUnresolvedChoices ? "text-danger" : "text-foreground")}>
				{hasUnresolvedChoices
					? "Choose how to handle prerequisite auto-completion."
					: "Prerequisite auto-completion decisions recorded."}
			</div>
			<div className="mt-3 space-y-4">
				{questIds.map((questId) => (
					<div key={questId} className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="font-semibold">{getQuestName(questId)}</div>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{getSensitiveBackfillQuest(questId)?.warning}
							</p>
						</div>
						<div className="inline-flex shrink-0 overflow-hidden rounded-sm border border-highlight/10">
							<button
								type="button"
								onClick={() => onDeny(questId)}
								className={cn(
									"px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
									deniedSet.has(questId) ? "bg-highlight/10 text-foreground" : "hover:bg-highlight/5",
								)}
							>
								Deny
							</button>
							<button
								type="button"
								onClick={() => onAllow(questId)}
								className={cn(
									"inline-flex items-center gap-1 border-l border-highlight/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
									allowedSet.has(questId) ? "bg-danger/15 text-danger" : "hover:bg-danger/10",
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

/** Parser stats and raw deduped events for debugging. */
function InfoPanel({
	result,
	unknownModeGroups,
}: {
	result: QuestLogParseResult;
	unknownModeGroups: QuestImportBuckets["unknownMode"];
}) {
	const stats: Array<[string, number]> = [
		["Files parsed", result.totals.filesParsed],
		["Files ignored", result.totals.filesIgnored],
		["Raw events", result.totals.rawEvents],
		["Deduped events", result.totals.dedupedEvents],
		["Started", result.totals.startedEvents],
		["Completed", result.totals.completedEvents],
		["Unknown mode", result.totals.unknownEvents],
	];

	return (
		<section className="space-y-4 border-t border-highlight/10 pt-4">
			<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
				{stats.map(([label, value]) => (
					<span key={label}>
						{label} <span className="tabular-nums text-foreground">{value}</span>
					</span>
				))}
			</div>

			{unknownModeGroups.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-foreground">Unknown mode quests</h3>
					<ul className="mt-1 space-y-1 text-xs text-muted-foreground">
						{unknownModeGroups.map((group) => (
							<li key={`${group.questId}-${group.type}`}>
								{group.quest?.name ?? group.questId} · {group.type} · seen {group.occurrenceCount} · latest{" "}
								{formatTimestamp(group.latestTimestamp)}
							</li>
						))}
					</ul>
				</div>
			)}

			<RawEventsTable events={result.events} />
		</section>
	);
}

function RawEventsTable({ events }: { events: ParsedQuestEvent[] }) {
	if (events.length === 0) return <p className="text-sm text-subtle-foreground">No quest events were parsed.</p>;

	return (
		<div className="max-h-64 overflow-auto">
			<table className="min-w-full text-left text-xs">
				<thead className="sticky top-0 bg-card uppercase text-subtle-foreground">
					<tr>
						<th className="px-2 py-2 font-medium">Timestamp</th>
						<th className="px-2 py-2 font-medium">Quest</th>
						<th className="px-2 py-2 font-medium">Type</th>
						<th className="px-2 py-2 font-medium">Mode</th>
						<th className="px-2 py-2 font-medium">Seen</th>
						<th className="px-2 py-2 font-medium">Source file</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-highlight/5">
					{events.map((event, index) => (
						<tr key={`${event.questId}-${event.type}-${event.raidMode}-${index}`}>
							<td className="px-2 py-2 tabular-nums text-foreground">{formatTimestamp(event.timestamp)}</td>
							<td className="px-2 py-2 text-foreground">{event.questId}</td>
							<td className="px-2 py-2 capitalize text-foreground">{event.type}</td>
							<td className="px-2 py-2 uppercase text-foreground">{event.raidMode}</td>
							<td className="px-2 py-2 tabular-nums text-foreground">{event.occurrenceCount}</td>
							<td className="px-2 py-2 text-subtle-foreground">{event.sourceFile}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
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
