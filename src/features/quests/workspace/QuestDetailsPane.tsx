"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { AlertTriangle, Bug, CheckCircle2, ChevronRight, Circle, Eye, EyeOff, ExternalLink, Flag, GitBranch, GripVertical, Map as MapIcon, PackageOpen, Pin, RotateCcw, X, XCircle } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { formatQuestTraderGate, getQuestTraderGateType } from "@/lib/utils/quest-trader-gates";
import {
    compareTraderTierCompletionCount,
    countCompletedTraderTierQuests,
    formatTraderTierCompletionGate,
    getQuestTraderTabLoyaltyLevel,
} from "@/lib/utils/quest-trader-completion-gates";
import {
    buildMultipleChoiceQuestGroups,
    getQuestFailConditionText,
    questCanFail,
} from "@/lib/utils/quest-failures";
import { formatTaskRequirementStatus } from "@/lib/utils/quest-relations";
import type { FullQuest, QuestTraderStandingReward } from "@/types/quests";
import { QuestObjectiveIcon } from "../components/QuestObjectiveIcon";
import { ObjectiveRow } from "../components/quest-card/QuestObjectiveRows";
import { useQuestsContext } from "../QuestsContext";
import { getPositionedObjectiveMaps } from "./quest-detail-markers";
import {
    buildQuestDetailsModel,
    compareRequirementValue,
    formatOtherRequirementDetails,
    humanize,
    isTaskRequirementSatisfied,
    type QuestDetailMapData,
} from "./quest-details-model";
import type { ObjectivePresentation } from "./quest-objective-presentation";
import { useQuestDetailsController } from "./useQuestDetailsController";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import type { QuestBranchLine } from "./quest-branch-graph";
import type { QuestWorkspaceStatusInfo } from "./quest-workspace-utils";

type QuestDetailsModel = ReturnType<typeof buildQuestDetailsModel>;

const LazyMapViewer = dynamic(
    () => import("@/features/maps/MapViewer").then((module) => module.MapViewer),
    {
        ssr: false,
        loading: () => <MapLoadingPlaceholder label="Loading objective map…" />,
    },
);

export function QuestDetailsPane() {
    const {
        quests,
        selectedQuest: quest,
        statusByQuestId,
        questsById,
        maps,
        branchLinesByQuestId,
        setSelectedQuestId,
        retainQuestAfterCompletion,
        openQuestVisualizer,
    } = useQuestWorkspace();
    const { itemById, leadsToByQuestId, onItemClick, requestToggleQuestCompletion, requestFailQuest, requestResetQuestStatus } = useQuestsContext();
    const pinned = useUserStore((state) => quest ? !!state.pinnedQuests[quest.id] : false);
    const hidden = useUserStore((state) => quest ? !!state.ignoredQuests[quest.id] : false);
    const completedQuestObjectives = useUserStore((state) => state.completedQuestObjectives);
    const completedQuests = useUserStore((state) => state.completedQuests);
    const failedQuests = useUserStore((state) => state.failedQuests);
    const playerLevel = useUserStore((state) => state.playerLevel);
    const prestigeLevel = useUserStore((state) => state.prestigeLevel);
    const questFaction = useUserStore((state) => state.questFaction);
    const traderLoyaltyLevels = useUserStore((state) => state.questTraderLoyaltyLevels);
    const fenceReputation = useUserStore((state) => state.questFenceReputation);
    const togglePinnedQuest = useUserStore((state) => state.togglePinnedQuest);
    const toggleIgnoredQuest = useUserStore((state) => state.toggleIgnoredQuest);
    const toggleQuestObjectiveCompletion = useUserStore((state) => state.toggleQuestObjectiveCompletion);
    const completedObjectiveIds = useMemo(
        () => new Set(
            quest
                ? Object.entries(completedQuestObjectives[quest.id] ?? {})
                    .filter(([, completed]) => completed)
                    .map(([objectiveId]) => objectiveId)
                : [],
        ),
        [completedQuestObjectives, quest],
    );
    const multipleChoiceGroups = useMemo(
        () => buildMultipleChoiceQuestGroups(quests),
        [quests],
    );
    const questDetailsModel = useMemo(() => quest ? buildQuestDetailsModel({
        quest,
        questsById,
        leadsToQuestIds: leadsToByQuestId.get(quest.id) ?? [],
        maps,
        branchLines: branchLinesByQuestId.get(quest.id) ?? [],
        multipleChoiceQuestIds: multipleChoiceGroups.get(quest.id) ?? [],
        completedObjectiveIds,
    }) : null, [branchLinesByQuestId, completedObjectiveIds, leadsToByQuestId, maps, multipleChoiceGroups, quest, questsById]);
    const controller = useQuestDetailsController(quest?.id ?? null, questDetailsModel?.mapData ?? null);

    if (!quest) {
        return (
            <div className="flex min-h-[420px] border-t border-highlight/10 flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,_var(--highlight)_2.5%,_transparent),transparent_45%)] p-8 text-center">
                <div className="max-w-xs">
                    <Flag size={24} className="mx-auto mb-4 text-subtle-foreground" />
                    <p className="text-sm text-subtle-foreground">Select a quest from the log to inspect its objectives, requirements, and progression links.</p>
                </div>
            </div>
        );
    }

    const status = statusByQuestId.get(quest.id)!;
    const {
        essential,
        traderImage,
        locationLabel,
        hasHeaderMetadata,
        hasRequirements,
        hasFailureDetails,
        leadsTo,
        traderTierCompletionGates,
        unknownOtherRequirements,
        objectivePresentation,
        visualizerLines,
        multipleChoiceQuests,
        mapData: questMapData,
    } = questDetailsModel!;
    const {
        showDebug, setShowDebug, isDesktopMapOpen, setIsDesktopMapOpen,
        isHeaderCondensed, isCompactMapOpen, closeCompactMap,
        mapWidthPercent, setMapWidthPercent, isResizingMap, setIsResizingMap,
        handleObjectiveFloorsChange,
        hoveredObjectiveId, setHoveredObjectiveId,
        mapSectionRef, detailScrollRef, detailSplitRef,
        detailMaps, selectedDetailMapKey, selectedDetailMap, detailMarkers,
        panelSelectedMap, panelMarkers, isMapUpdatePending,
        focusedObjectiveId, focusRequestKey, showObjectiveOnMap,
        selectDetailMap, openCompactMap, resizeMapFromPointer, handleDetailScroll,
    } = controller;
    const traderTabLabel = essential
        ? "Essential"
        : `LL${getQuestTraderTabLoyaltyLevel(quest)}`;

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
            <div
                ref={detailSplitRef}
                className={cn(
                    "flex min-h-0 flex-1 flex-col overflow-hidden min-[1700px]:grid min-[1700px]:grid-cols-[minmax(0,1fr)_var(--quest-map-width)]",
                    !isResizingMap && "min-[1700px]:transition-[grid-template-columns] min-[1700px]:duration-200",
                )}
                style={{ "--quest-map-width": selectedDetailMap && isDesktopMapOpen ? `${mapWidthPercent}%` : "0px" } as CSSProperties}
            >
            <div
                ref={detailScrollRef}
                onScroll={(event) => handleDetailScroll(event.currentTarget.scrollTop)}
                className={cn(
                    "min-h-0 min-w-0 overflow-y-auto pt-[212px] [overflow-anchor:none] lg:pt-0",
                    isCompactMapOpen && "hidden min-[1700px]:block",
                )}
            >
            <QuestDetailsHeader
                quest={quest}
                status={status}
                traderImage={traderImage}
                traderTabLabel={traderTabLabel}
                locationLabel={locationLabel}
                hasHeaderMetadata={hasHeaderMetadata}
                essential={essential}
                pinned={pinned}
                hidden={hidden}
                isCondensed={isHeaderCondensed}
                isCompactMapOpen={isCompactMapOpen}
                isDesktopMapOpen={isDesktopMapOpen}
                hasObjectiveMap={!!selectedDetailMap}
                visualizerLines={visualizerLines}
                onToggleCompletion={() => {
                    if (status.status !== "completed") retainQuestAfterCompletion(quest.id);
                    requestToggleQuestCompletion(quest.id);
                }}
                onFail={() => requestFailQuest(quest.id)}
                onResetStatus={() => requestResetQuestStatus(quest.id)}
                onTogglePinned={() => togglePinnedQuest(quest.id)}
                onToggleHidden={() => toggleIgnoredQuest(quest.id)}
                onShowMap={openCompactMap}
                onShowDesktopMap={() => setIsDesktopMapOpen(true)}
                onOpenVisualizer={(lineId) => openQuestVisualizer(lineId, quest.id)}
            />
            {multipleChoiceQuests.length > 1 && (
                <div className="flex h-11 min-h-11 items-stretch border-b border-warning/25 bg-warning/10 text-warning">
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-5 sm:px-7">
                    <AlertTriangle size={16} className="shrink-0 text-warning" />
                    <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-warning">Multiple choice quest</p>
                    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-xs">
                        {multipleChoiceQuests.map((choiceQuest) => choiceQuest.id === quest.id ? (
                            <span key={choiceQuest.id} className="shrink-0 font-semibold text-warning">{choiceQuest.name}</span>
                        ) : (
                            <button
                                key={choiceQuest.id}
                                type="button"
                                onClick={() => setSelectedQuestId(choiceQuest.id)}
                                className="shrink-0 cursor-pointer text-warning/70 underline decoration-warning/30 underline-offset-4 transition-colors hover:text-warning hover:decoration-current"
                            >
                                {choiceQuest.name}
                            </button>
                        ))}
                    </div>
                    </div>
                </div>
            )}
            <div className="max-w-6xl px-6 py-10 sm:px-9">
                <section>
                    {(hasRequirements || leadsTo.length > 0 || hasFailureDetails) && <div className="mb-12 flex flex-wrap gap-x-10 gap-y-8">
                        {hasRequirements && (
                            <QuestRequirementsSection
                                quest={quest}
                                quests={quests}
                                playerLevel={playerLevel}
                                prestigeLevel={prestigeLevel}
                                faction={questFaction}
                                traderLoyaltyLevels={traderLoyaltyLevels}
                                fenceReputation={fenceReputation}
                                completedQuests={completedQuests}
                                failedQuests={failedQuests}
                                traderTierCompletionGates={traderTierCompletionGates}
                                unknownOtherRequirements={unknownOtherRequirements}
                                onQuestClick={setSelectedQuestId}
                            />
                        )}
                        {leadsTo.length > 0 && <section className="min-w-[14rem] flex-[1_1_16rem]">
                            <SectionLabel>Unlocks</SectionLabel>
                            <div className="space-y-2.5 text-sm">
                                {leadsTo.map(({ quest: nextQuest, timing }) => (
                                    <div key={nextQuest.id}>
                                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">
                                            {timing}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedQuestId(nextQuest.id)}
                                            className="cursor-pointer text-left text-foreground underline decoration-highlight/30 underline-offset-4 transition-colors hover:text-foreground hover:decoration-current"
                                        >
                                            {nextQuest.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>}
                        {hasFailureDetails && <section className="min-w-[16rem] flex-[1_1_18rem]">
                            <SectionLabel>Failure conditions</SectionLabel>
                            <div className="space-y-5">
                                {(quest.failConditions?.length ?? 0) > 0 && <div className="space-y-2">{quest.failConditions?.map((condition) => {
                                    const referencedQuest = condition.type === "taskStatus" && "task" in condition
                                        ? questsById.get(condition.task.id)
                                        : null;
                                    return (
                                        <div key={condition.id} className="rounded-md bg-danger/[0.07] px-3 py-2 text-xs text-danger/80">
                                            {referencedQuest ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedQuestId(referencedQuest.id)}
                                                    className="cursor-pointer text-left underline decoration-danger/30 underline-offset-4 transition-colors hover:text-danger hover:decoration-current"
                                                >
                                                    {referencedQuest.name}
                                                </button>
                                            ) : (
                                                <p>{getQuestFailConditionText(condition)}</p>
                                            )}
                                            {condition.type === "taskStatus" && "status" in condition && <p className="mt-1 text-[10px] text-danger/40">Quest status: {condition.status.join(" or ")}</p>}
                                        </div>
                                    );
                                })}</div>}
                                {(quest.failureTraderStandingRewards?.length ?? 0) > 0 && <StandingRewards label="Failure reputation" rewards={quest.failureTraderStandingRewards ?? []} />}
                            </div>
                        </section>}
                    </div>}
                    <QuestObjectivesSection
                        questId={quest.id}
                        objectiveCount={quest.objectives.length}
                        objectivePresentation={objectivePresentation}
                        completedObjectiveIds={completedObjectiveIds}
                        mapData={questMapData}
                        selectedMapKey={selectedDetailMapKey}
                        focusedObjectiveId={focusedObjectiveId}
                        onHoverObjective={setHoveredObjectiveId}
                        onShowObjectiveOnMap={showObjectiveOnMap}
                        onToggleObjectiveCompletion={toggleQuestObjectiveCompletion}
                        onItemClick={onItemClick ?? undefined}
                    />

                    {(quest.experience > 0 || (quest.finishItemRewards?.length ?? 0) > 0 || (quest.finishTraderStandingRewards?.length ?? 0) > 0) && <div className="mt-12">
                        <SectionLabel>Rewards</SectionLabel>
                        <div className="space-y-4 text-sm">
                            <div className="space-y-1.5">
                                {quest.experience > 0 && (
                                    <p className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="text-subtle-foreground">Experience</span>
                                        <span className="font-mono font-semibold text-success">{quest.experience.toLocaleString()} XP</span>
                                    </p>
                                )}
                                {(quest.finishTraderStandingRewards ?? []).map((reward, index) => (
                                    <p key={`${reward.trader.id}-${index}`} className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="text-subtle-foreground">{reward.trader.name} reputation</span>
                                        <span className={reward.standing >= 0 ? "font-mono font-semibold text-success" : "font-mono font-semibold text-danger"}>{formatStanding(reward.standing)}</span>
                                    </p>
                                ))}
                            </div>
                            {(quest.finishItemRewards?.length ?? 0) > 0 && <div className="flex flex-wrap gap-2.5">
                            {(quest.finishItemRewards ?? []).map((reward, index) => {
                                const item = itemById[reward.itemId];
                                const imageLink = item?.iconLink ?? item?.gridImageLink;
                                return (
                                    <button
                                        key={`${reward.itemId}-${index}`}
                                        type="button"
                                        onClick={() => item && onItemClick?.(item.id)}
                                        disabled={!item || !onItemClick}
                                        className="flex min-w-[13rem] max-w-xs flex-[1_1_14rem] items-center border border-highlight/10 bg-shadow/20 text-left transition-colors enabled:hover:border-brand/35 enabled:hover:bg-brand/[0.04] disabled:cursor-default"
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-highlight/15 bg-highlight/5">
                                            {imageLink ? <img src={imageLink} alt="" className="h-8 w-8 object-contain" /> : <PackageOpen size={15} className="text-subtle-foreground" />}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate px-2.5 text-xs text-foreground">{item?.name ?? "Unknown item"}</span>
                                        <span className="shrink-0 pr-2.5 font-mono text-xs font-semibold text-foreground">×{reward.count.toLocaleString()}</span>
                                    </button>
                                );
                            })}
                            </div>}
                        </div>
                    </div>}
                </section>
            </div>
            </div>

            {selectedDetailMap && (
                <aside
                    ref={mapSectionRef}
                    className={cn(
                        "relative min-h-0 flex-1 flex-col bg-[var(--background)]",
                        isCompactMapOpen ? "flex" : "hidden",
                        "min-[1700px]:order-last min-[1700px]:h-auto min-[1700px]:min-h-0 min-[1700px]:border-l min-[1700px]:border-highlight/10",
                        isDesktopMapOpen ? "min-[1700px]:flex" : "min-[1700px]:hidden",
                    )}
                >
                    {isDesktopMapOpen && (
                        <div
                            role="separator"
                            aria-label="Resize objective map"
                            aria-orientation="vertical"
                            aria-valuemin={28}
                            aria-valuemax={65}
                            aria-valuenow={Math.round(mapWidthPercent)}
                            tabIndex={0}
                            onPointerDown={(event) => {
                                event.preventDefault();
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setIsResizingMap(true);
                                resizeMapFromPointer(event.clientX);
                            }}
                            onPointerMove={(event) => {
                                if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeMapFromPointer(event.clientX);
                            }}
                            onPointerUp={(event) => {
                                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                                setIsResizingMap(false);
                            }}
                            onPointerCancel={() => setIsResizingMap(false)}
                            onKeyDown={(event) => {
                                if (event.key === "ArrowLeft") setMapWidthPercent((current) => Math.min(65, current + 2));
                                if (event.key === "ArrowRight") setMapWidthPercent((current) => Math.max(28, current - 2));
                            }}
                            className={cn(
                                "absolute inset-y-0 left-0 z-30 hidden w-2 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none transition-colors min-[1700px]:flex",
                                "after:h-14 after:w-px after:bg-highlight/15 after:transition-all hover:bg-brand/10 hover:after:h-24 hover:after:bg-brand focus-visible:bg-brand/10 focus-visible:after:h-24 focus-visible:after:bg-brand",
                                isResizingMap && "bg-brand/15 after:h-24 after:w-0.5 after:bg-brand",
                            )}
                        >
                            <GripVertical size={12} className="absolute text-subtle-foreground" />
                        </div>
                    )}
                    <div className="flex min-h-11 shrink-0 border-b border-highlight/10 bg-[var(--card-bg)]">
                        <button
                            type="button"
                            onClick={() => setIsDesktopMapOpen(false)}
                            className="hidden aspect-square h-full min-h-11 shrink-0 items-center justify-center border-r border-highlight/10 text-subtle-foreground transition-colors hover:bg-highlight/5 hover:text-foreground min-[1700px]:flex"
                            aria-label="Hide objective map"
                            aria-expanded
                            title="Hide objective map"
                        >
                            <ChevronRight size={17} />
                        </button>
                        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
                            <div className="min-w-0 shrink-0">
                                <p className="truncate text-xs">
                                    {detailMarkers.length} mapped location{detailMarkers.length === 1 ? "" : "s"} on {selectedDetailMap.name}
                                </p>
                            </div>
                            {detailMaps.length > 1 && (
                                <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-1" aria-label="Quest objective maps">
                                    {detailMaps.map((map) => (
                                        <button
                                            type="button"
                                            key={map.key}
                                            aria-pressed={map.key === selectedDetailMapKey}
                                            onClick={() => selectDetailMap(map.key)}
                                            className={cn(
                                                "border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                                                map.key === selectedDetailMapKey
                                                    ? "border-brand/45 bg-brand/10 text-brand"
                                                    : "border-highlight/10 bg-highlight/3 text-subtle-foreground hover:border-highlight/25 hover:text-foreground",
                                            )}
                                        >
                                            {map.name} · {map.locationCount}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={closeCompactMap}
                                className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center border border-danger/35 bg-danger/10 text-danger transition-colors hover:border-danger/70 hover:bg-danger/20 hover:text-danger min-[1700px]:hidden"
                                aria-label="Close objective map"
                                title="Close objective map"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>
                    <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--background)]">
                        {panelSelectedMap ? (
                            <LazyMapViewer
                                mapKey={panelSelectedMap.key}
                                markers={panelMarkers}
                                compactAttribution
                                highlightedObjectiveId={!isMapUpdatePending ? hoveredObjectiveId ?? focusedObjectiveId : null}
                                focusedObjectiveId={!isMapUpdatePending ? focusedObjectiveId : null}
                                focusRequestKey={!isMapUpdatePending ? focusRequestKey : null}
                                onObjectiveFloorsChange={handleObjectiveFloorsChange}
                                onMarkerComplete={!isMapUpdatePending && quest.objectives.length > 1 ? (marker) => {
                                    const questId = marker.questId ?? quest.id;
                                    marker.objectiveIds?.forEach((objectiveId) => {
                                        toggleQuestObjectiveCompletion(questId, objectiveId);
                                    });
                                } : undefined}
                                onMarkerSelect={(marker) => {
                                    const objectiveId = marker.objectiveIds?.[0];
                                    if (objectiveId) showObjectiveOnMap(panelSelectedMap.key, objectiveId);
                                }}
                            />
                        ) : (
                            <MapLoadingPlaceholder label="Preparing objective map…" />
                        )}
                        {isMapUpdatePending && (
                            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-shadow/35 backdrop-blur-[1px]">
                                <span className="border border-highlight/10 bg-shadow/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-xl">
                                    Updating map…
                                </span>
                            </div>
                        )}
                    </div>
                </aside>
            )}
            </div>

            {showDebug && <QuestDebugPanel quest={quest} onClose={() => setShowDebug(false)} />}
            <button
                type="button"
                onClick={() => setShowDebug((visible) => !visible)}
                aria-label={showDebug ? "Hide quest debug data" : "Show quest debug data"}
                aria-expanded={showDebug}
                className={cn("absolute left-2 top-2 z-40 flex h-5 w-5 items-center justify-center rounded-full border bg-[var(--card-bg)] shadow-lg transition-colors", showDebug ? "border-brand/50 text-brand" : "border-highlight/12 text-subtle-foreground hover:border-highlight/25 hover:text-foreground")}
            >
                <Bug size={10} />
            </button>
        </div>
    );
}

function QuestDetailsHeader({
    quest,
    status,
    traderImage,
    traderTabLabel,
    locationLabel,
    hasHeaderMetadata,
    essential,
    pinned,
    hidden,
    isCondensed,
    isCompactMapOpen,
    isDesktopMapOpen,
    hasObjectiveMap,
    visualizerLines,
    onToggleCompletion,
    onFail,
    onResetStatus,
    onTogglePinned,
    onToggleHidden,
    onShowMap,
    onShowDesktopMap,
    onOpenVisualizer,
}: {
    quest: FullQuest;
    status: QuestWorkspaceStatusInfo;
    traderImage?: string | null;
    traderTabLabel: string;
    locationLabel: string;
    hasHeaderMetadata: boolean;
    essential: boolean;
    pinned: boolean;
    hidden: boolean;
    isCondensed: boolean;
    isCompactMapOpen: boolean;
    isDesktopMapOpen: boolean;
    hasObjectiveMap: boolean;
    visualizerLines: QuestBranchLine[];
    onToggleCompletion: () => void;
    onFail: () => void;
    onResetStatus: () => void;
    onTogglePinned: () => void;
    onToggleHidden: () => void;
    onShowMap: () => void;
    onShowDesktopMap: () => void;
    onOpenVisualizer: (lineId: string) => void;
}) {
    return (
        <header className={cn(
            "relative z-40 shrink-0 overflow-visible border-b border-highlight/8 bg-[var(--surface-raised)] transition-[padding,min-height] duration-200 max-lg:absolute max-lg:inset-x-0 max-lg:top-0",
            isCondensed ? "min-h-0 px-4 py-2.5 sm:px-6" : "min-h-48 px-5 py-5 sm:px-7 sm:py-6",
            isCompactMapOpen && "max-lg:hidden",
        )}>
            {quest.taskImageLink && (
                <div
                    className={cn("pointer-events-none absolute inset-y-0 right-0 transition-opacity duration-200", isCondensed && "opacity-0")}
                    style={{ maskImage: "linear-gradient(to right, transparent 0%, var(--shadow) 24%, var(--shadow) 100%)" }}
                >
                    <img src={quest.taskImageLink} alt="" className="h-full w-auto max-w-none object-contain object-right opacity-55" />
                </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/88 to-transparent" />
            {hasObjectiveMap && !isDesktopMapOpen && (
                <button
                    type="button"
                    onClick={onShowDesktopMap}
                    className="absolute right-3 top-3 z-10 hidden h-9 w-9 items-center justify-center border border-highlight/15 bg-[var(--surface-raised)]/95 text-muted-foreground shadow-lg transition-colors hover:border-brand/40 hover:bg-[var(--accent)] hover:text-brand min-[1700px]:flex"
                    aria-label="Show objective map"
                    title="Show objective map"
                >
                    <MapIcon size={16} />
                </button>
            )}
            <div className={cn("relative", !isCondensed && "max-w-4xl sm:pr-10")}>
                <div className={cn("flex items-center gap-2.5 overflow-hidden transition-[height,margin,opacity] duration-200", isCondensed ? "h-0 opacity-0" : "mb-3 h-10 opacity-100")}>
                    {traderImage ? <img src={traderImage} alt="" className="h-9 w-9 rounded-full border border-highlight/10 object-cover" /> : null}
                    <div>
                        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-subtle-foreground">
                            {quest.trader.name}
                            <span className={essential ? "text-warning/75" : "text-brand/70"}>{traderTabLabel}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{locationLabel}</p>
                    </div>
                </div>
                <div className={cn(isCondensed && "flex flex-wrap items-center justify-between gap-2")}>
                    <div className="min-w-0">
                        <h1 className={cn("font-semibold tracking-tight text-foreground transition-[font-size] duration-200", isCondensed ? "truncate text-xl" : "text-3xl sm:text-4xl")}>{quest.name}</h1>
                        {hasHeaderMetadata && (
                            <div className={cn("flex flex-wrap items-center gap-x-2 overflow-hidden text-[11px] font-medium uppercase tracking-wider text-subtle-foreground transition-[height,margin,opacity] duration-200", isCondensed ? "h-0 opacity-0" : "mt-2 h-auto opacity-100")}>
                                {quest.requiredPrestige && <span>Prestige {quest.requiredPrestige.prestigeLevel}</span>}
                                {quest.requiredPrestige && (quest.kappaRequired || quest.lightkeeperRequired) && <span aria-hidden="true" className="text-subtle-foreground">·</span>}
                                {quest.kappaRequired && <span className="text-warning/75">Kappa required</span>}
                                {quest.kappaRequired && quest.lightkeeperRequired && <span aria-hidden="true" className="text-subtle-foreground">·</span>}
                                {quest.lightkeeperRequired && <span className="text-info/75">Lightkeeper required</span>}
                            </div>
                        )}
                    </div>
                    <div className={cn("flex flex-wrap gap-1.5", isCondensed ? "mt-0" : "mt-4")}>
                        <span className={cn("inline-flex items-center border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider", isCondensed && "hidden", status.status === "locked" || status.status === "failed" ? "border-danger/25 bg-danger/8 text-danger" : status.status === "completed" ? "border-success/25 bg-success/8 text-success" : "border-info/25 bg-info/8 text-info")}>{status.label}</span>
                        <button type="button" title={status.status === "completed" ? "Return this quest to an incomplete state" : "Mark this quest as completed"} onClick={onToggleCompletion} className={cn(questActionButtonClass, status.status === "completed" ? "border-success/30 bg-[var(--success-surface)] text-success hover:border-danger/50 hover:bg-[var(--danger-surface)] hover:text-danger" : "border-brand/35 bg-[var(--success-surface)] text-brand hover:border-brand/70 hover:bg-[var(--success-surface)]")}><CheckCircle2 size={14} />{status.status === "completed" ? "Mark incomplete" : "Mark complete"}</button>
                        {questCanFail(quest) && !status.terminal && <button type="button" title="Mark this quest as failed" onClick={onFail} className={cn(questActionButtonClass, "border-danger/35 bg-[var(--danger-surface)] text-danger hover:border-danger/65 hover:bg-[var(--danger-surface)] hover:text-danger")}><XCircle size={14} /> Mark failed</button>}
                        {status.terminal === "failed" && <button type="button" title="Clear the failed status" onClick={onResetStatus} className={cn(questActionButtonClass, "border-highlight/15 bg-[var(--surface-raised)] text-foreground hover:border-highlight/30 hover:bg-[var(--surface-raised)] hover:text-foreground")}><RotateCcw size={14} /> Reset status</button>}
                        <button type="button" title={pinned ? "Remove this quest from pinned quests" : "Keep this quest in pinned views"} onClick={onTogglePinned} className={cn(questActionButtonClass, "hidden border-highlight/15 bg-[var(--surface-raised)] text-muted-foreground hover:border-info/40 hover:bg-[var(--info-surface)] hover:text-info lg:inline-flex", pinned && "border-info/35 bg-[var(--info-surface)] text-info hover:bg-[var(--info-surface)]")}><Pin size={14} className={pinned ? "fill-current" : ""} />{pinned ? "Unpin quest" : "Pin quest"}</button>
                        <button type="button" title={hidden ? "Restore this quest to normal filtered views" : "Hide this quest from normal filtered views"} onClick={onToggleHidden} className={cn(questActionButtonClass, "hidden border-highlight/15 bg-[var(--surface-raised)] text-muted-foreground hover:border-special/40 hover:bg-[var(--special-surface)] hover:text-special lg:inline-flex", hidden && "border-special/35 bg-[var(--special-surface)] text-special hover:bg-[var(--special-surface)]")}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />}{hidden ? "Show quest" : "Hide quest"}</button>
                        {hasObjectiveMap && <button type="button" title="Show the objective map" onClick={onShowMap} className={cn(questActionButtonClass, "border-highlight/15 bg-[var(--surface-raised)] text-muted-foreground hover:border-brand/40 hover:bg-[var(--accent)] hover:text-brand min-[1700px]:hidden")}><MapIcon size={14} /> Show map</button>}
                        {visualizerLines.length === 1 && <button type="button" onClick={() => onOpenVisualizer(visualizerLines[0].id)} className={cn(questActionButtonClass, "border-info/25 bg-[var(--info-surface)] text-info hover:border-info/50 hover:bg-[var(--info-surface)]")}><GitBranch size={14} /> View quest line</button>}
                        {visualizerLines.length > 1 && (
                            <details className="group relative">
                                <summary className={cn(questActionButtonClass, "cursor-pointer list-none border-info/25 bg-[var(--info-surface)] text-info hover:border-info/50 hover:bg-[var(--info-surface)] [&::-webkit-details-marker]:hidden")}><GitBranch size={14} /> View quest line</summary>
                                <div className="absolute left-0 top-full z-[100] mt-1 min-w-56 border border-highlight/12 bg-[var(--card-bg)] p-1 shadow-2xl">
                                    {visualizerLines.map((line) => (
                                        <button
                                            key={line.id}
                                            type="button"
                                            onClick={(event) => {
                                                event.currentTarget.closest("details")?.removeAttribute("open");
                                                onOpenVisualizer(line.id);
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-highlight/8 hover:text-foreground"
                                        >
                                            <span className="min-w-0 flex-1 truncate">{line.name}</span>
                                            {line.kind === "special" && <span className="text-[9px] font-semibold uppercase tracking-wider text-warning/70">Special</span>}
                                        </button>
                                    ))}
                                </div>
                            </details>
                        )}
                        {quest.wikiLink && <a href={quest.wikiLink} title="Open this quest on the Tarkov wiki" target="_blank" rel="noopener noreferrer" className={cn(questActionButtonClass, "border-highlight/15 bg-[var(--surface-raised)] text-muted-foreground hover:border-highlight/30 hover:bg-[var(--surface-raised)] hover:text-foreground")}>Open wiki <ExternalLink size={12} /></a>}
                    </div>
                </div>
            </div>
        </header>
    );
}

function QuestRequirementsSection({
    quest,
    quests,
    playerLevel,
    prestigeLevel,
    faction,
    traderLoyaltyLevels,
    fenceReputation,
    completedQuests,
    failedQuests,
    traderTierCompletionGates,
    unknownOtherRequirements,
    onQuestClick,
}: {
    quest: FullQuest;
    quests: readonly FullQuest[];
    playerLevel: number;
    prestigeLevel: number;
    faction: string | null;
    traderLoyaltyLevels: Record<string, number>;
    fenceReputation: number;
    completedQuests: Record<string, boolean>;
    failedQuests: Record<string, boolean>;
    traderTierCompletionGates: QuestDetailsModel["traderTierCompletionGates"];
    unknownOtherRequirements: QuestDetailsModel["unknownOtherRequirements"];
    onQuestClick: (questId: string) => void;
}) {
    return (
        <section className="min-w-[16rem] flex-[1_1_18rem]">
            <SectionLabel>Requirements</SectionLabel>
            <div className="space-y-2.5 text-sm">
                {(quest.minPlayerLevel ?? 0) > 0 && (
                    <RequirementRow satisfied={playerLevel >= (quest.minPlayerLevel ?? 0)} label="Player level">
                        Level {quest.minPlayerLevel}
                    </RequirementRow>
                )}
                {quest.factionName && quest.factionName !== "Any" && (
                    <RequirementRow satisfied={faction ? faction === quest.factionName : null} label="Faction">
                        {quest.factionName}
                    </RequirementRow>
                )}
                {quest.requiredPrestige && (
                    <RequirementRow satisfied={prestigeLevel >= quest.requiredPrestige.prestigeLevel} label="Prestige">
                        Level {quest.requiredPrestige.prestigeLevel}
                    </RequirementRow>
                )}
                {quest.traderRequirements.map((requirement) => {
                    const gateType = getQuestTraderGateType(requirement);
                    const isFence = requirement.trader.normalizedName === "fence" || requirement.trader.name.toLowerCase() === "fence";
                    const currentValue = gateType === "level"
                        ? traderLoyaltyLevels[requirement.trader.id] ?? 1
                        : gateType === "reputation" && isFence
                          ? fenceReputation
                          : null;
                    return (
                        <RequirementRow
                            key={requirement.id}
                            satisfied={currentValue == null ? null : compareRequirementValue(currentValue, requirement.compareMethod, requirement.value)}
                            label="Trader"
                        >
                            {formatQuestTraderGate(requirement)}
                        </RequirementRow>
                    );
                })}
                {traderTierCompletionGates.map((gate) => {
                    const completedCount = countCompletedTraderTierQuests(quests, completedQuests, gate);
                    return (
                        <RequirementRow
                            key={gate.variableId}
                            satisfied={compareTraderTierCompletionCount(completedCount, gate)}
                            label="Tasks completed"
                            title={formatTraderTierCompletionGate(gate)}
                        >
                            {completedCount}/{gate.requiredCount} {gate.trader} LL{gate.tier} tasks
                        </RequirementRow>
                    );
                })}
                {unknownOtherRequirements.map((requirement, index) => (
                    <RequirementRow key={requirement.id ?? `${requirement.type}-${index}`} satisfied={null} label={humanize(requirement.requirementType || requirement.type || "Other")}>
                        {formatOtherRequirementDetails(requirement) || "Required"}
                    </RequirementRow>
                ))}
                {quest.taskRequirements.map((requirement) => (
                    <RequirementRow
                        key={requirement.task.id}
                        satisfied={isTaskRequirementSatisfied(requirement.status, !!completedQuests[requirement.task.id], !!failedQuests[requirement.task.id])}
                        label={formatTaskRequirementStatus(requirement.status)}
                        onClick={() => onQuestClick(requirement.task.id)}
                    >
                        {requirement.task.name}
                    </RequirementRow>
                ))}
            </div>
        </section>
    );
}

function QuestObjectivesSection({
    questId,
    objectiveCount,
    objectivePresentation,
    completedObjectiveIds,
    mapData,
    selectedMapKey,
    focusedObjectiveId,
    onHoverObjective,
    onShowObjectiveOnMap,
    onToggleObjectiveCompletion,
    onItemClick,
}: {
    questId: string;
    objectiveCount: number;
    objectivePresentation: ObjectivePresentation[];
    completedObjectiveIds: ReadonlySet<string>;
    mapData: QuestDetailMapData;
    selectedMapKey: string | null;
    focusedObjectiveId: string | null;
    onHoverObjective: (objectiveId: string | null) => void;
    onShowObjectiveOnMap: (mapKey: string, objectiveId: string) => void;
    onToggleObjectiveCompletion: (questId: string, objectiveId: string) => void;
    onItemClick?: (itemId: string) => void;
}) {
    return (
        <>
            <SectionLabel>Objectives</SectionLabel>
            {objectivePresentation.length > 0 ? (
                <div className="space-y-7">
                    {objectivePresentation.map((presentation) => (
                        <QuestObjectiveDisplay
                            key={presentation.objective.id}
                            questId={questId}
                            objectiveCount={objectiveCount}
                            presentation={presentation}
                            isCompleted={completedObjectiveIds.has(presentation.objective.id)}
                            isFocused={focusedObjectiveId === presentation.objective.id}
                            mapData={mapData}
                            selectedMapKey={selectedMapKey}
                            onHoverObjective={onHoverObjective}
                            onShowObjectiveOnMap={onShowObjectiveOnMap}
                            onToggleObjectiveCompletion={onToggleObjectiveCompletion}
                            onItemClick={onItemClick}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-xs text-subtle-foreground">No objectives provided.</p>
            )}
        </>
    );
}

function QuestObjectiveDisplay({
    questId,
    objectiveCount,
    presentation: { objective, showItems },
    isCompleted,
    isFocused,
    mapData,
    selectedMapKey,
    onHoverObjective,
    onShowObjectiveOnMap,
    onToggleObjectiveCompletion,
    onItemClick,
}: {
    questId: string;
    objectiveCount: number;
    presentation: ObjectivePresentation;
    isCompleted: boolean;
    isFocused: boolean;
    mapData: QuestDetailMapData;
    selectedMapKey: string | null;
    onHoverObjective: (objectiveId: string | null) => void;
    onShowObjectiveOnMap: (mapKey: string, objectiveId: string) => void;
    onToggleObjectiveCompletion: (questId: string, objectiveId: string) => void;
    onItemClick?: (itemId: string) => void;
}) {
    const positionedMaps = getPositionedObjectiveMaps(objective);
    const cueMapKey = positionedMaps.some((map) => map.key === selectedMapKey)
        ? selectedMapKey
        : positionedMaps[0]?.key;
    const markers = cueMapKey
        ? (mapData.markersByMap.get(cueMapKey) ?? []).filter((marker) => marker.objectiveIds?.includes(objective.id))
        : [];
    const markerStyle = mapData.styles.get(objective.id);
    const positionedLocationCount = positionedMaps.reduce((count, map) => count + map.locationCount, 0);
    const multipleLocationLabel = positionedLocationCount > 1
        ? objective.locations?.some((location) => location.position && location.source === "possibleLocation")
            ? "Multiple spawns"
            : "Multiple locations"
        : null;
    const canComplete = objectiveCount > 1 && positionedMaps.length > 0;

    return (
        <div
            onMouseEnter={() => {
                if (!isCompleted && markers.length > 0) onHoverObjective(objective.id);
            }}
            onMouseLeave={() => onHoverObjective(null)}
            className={cn(
                "rounded-md bg-highlight/[0.035] p-3",
                isFocused && "bg-highlight/[0.065]",
            )}
        >
            {positionedMaps.length > 0 && (
                <div className="mb-3 flex w-full flex-wrap items-center gap-x-3 gap-y-2">
                    {markerStyle && (
                        <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-shadow/70"
                            style={{ backgroundColor: markerStyle.color }}
                        >
                            <QuestObjectiveIcon type={objective.type} size={11} className="text-inverse" />
                        </span>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {positionedMaps.map((map) => (
                            <button
                                type="button"
                                key={map.key}
                                onClick={() => onShowObjectiveOnMap(map.key, objective.id)}
                                className="inline-flex items-center gap-1.5 rounded bg-shadow/30 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-shadow/45 hover:text-brand"
                            >
                                <MapIcon size={11} />
                                Show on {map.name}
                                {map.locationCount > 1 && <span className="text-subtle-foreground">×{map.locationCount}</span>}
                            </button>
                        ))}
                    </div>
                    {multipleLocationLabel && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-warning/80">
                            {multipleLocationLabel}
                        </span>
                    )}
                    {canComplete && (
                        <button
                            type="button"
                            aria-pressed={isCompleted}
                            aria-label={`${isCompleted ? "Undo completion of" : "Complete"} objective: ${objective.description}`}
                            onClick={() => onToggleObjectiveCompletion(questId, objective.id)}
                            className={cn(
                                "ml-auto inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold transition-colors",
                                isCompleted
                                    ? "bg-success/15 text-success hover:bg-highlight/10 hover:text-foreground"
                                    : "bg-shadow/30 text-subtle-foreground hover:bg-shadow/45 hover:text-brand",
                            )}
                        >
                            <CheckCircle2 size={12} className="text-success" />
                            {isCompleted ? "Completed" : "Complete"}
                        </button>
                    )}
                </div>
            )}
            <ObjectiveRow
                objective={objective}
                onItemClick={onItemClick}
                itemDisplay="rows"
                showItems={showItems}
            />
        </div>
    );
}

function MapLoadingPlaceholder({ label }: { label: string }) {
    return (
        <div className="flex h-full min-h-72 items-center justify-center bg-[var(--background)] p-8 text-center">
            <div>
                <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-highlight/10 border-t-brand" />
                <p className="mt-3 text-xs font-medium text-subtle-foreground">{label}</p>
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-subtle-foreground">{children}</h2>;
}

const questActionButtonClass = "inline-flex cursor-pointer select-none items-center gap-1.5 border bg-[var(--surface-raised)] px-2.5 py-1.5 text-[11px] font-semibold shadow-[0_2px_0_color-mix(in_oklab,_var(--shadow)_35%,_transparent)] transition-[transform,background-color,border-color,color,box-shadow] hover:-translate-y-px active:translate-y-px active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]";

function RequirementRow({
    children,
    label,
    satisfied,
    onClick,
    title,
}: {
    children: React.ReactNode;
    label: string;
    satisfied: boolean | null;
    onClick?: () => void;
    title?: string;
}) {
    const icon = satisfied === true
        ? <CheckCircle2 size={14} className="mt-[3px] shrink-0 text-success" />
        : satisfied === false
          ? <XCircle size={14} className="mt-[3px] shrink-0 text-danger" />
          : <Circle size={14} className="mt-[3px] shrink-0 text-subtle-foreground" />;
    return (
        <p title={title} className="flex items-start gap-2">
            {icon}
            <span>
                <span className="mr-2 text-subtle-foreground">{label}</span>
                {onClick ? (
                    <button
                        type="button"
                        onClick={onClick}
                        className={cn(
                            "cursor-pointer text-left underline decoration-highlight/30 underline-offset-4 transition-colors hover:text-foreground hover:decoration-current",
                            satisfied === false ? "text-danger/80" : "text-foreground",
                        )}
                    >
                        {children}
                    </button>
                ) : (
                    <span className={satisfied === false ? "text-danger/80" : "text-foreground"}>{children}</span>
                )}
            </span>
        </p>
    );
}

function QuestDebugPanel({ quest, onClose }: { quest: FullQuest; onClose: () => void }) {
    return (
        <aside className="fixed bottom-16 right-5 z-50 flex max-h-[70vh] w-[min(680px,calc(100vw-2.5rem))] flex-col overflow-hidden border border-highlight/15 bg-[var(--card-bg)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-highlight/10 px-4 py-3">
                <div><p className="text-xs font-semibold text-foreground">Quest debug data</p><p className="mt-0.5 text-[10px] text-subtle-foreground">Normalized data received by this page</p></div>
                <button type="button" onClick={onClose} aria-label="Close quest debug data" className="text-subtle-foreground hover:text-foreground"><X size={15} /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
                <DebugJson label="Objectives" value={quest.objectives} />
                <DebugJson label="Full quest" value={quest} />
            </div>
        </aside>
    );
}

function DebugJson({ label, value }: { label: string; value: unknown }) {
    return (
        <details className="mb-3 border border-highlight/8 bg-shadow/25" open={label === "Objectives"}>
            <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</summary>
            <pre className="max-h-80 overflow-auto border-t border-highlight/8 p-3 text-[10px] leading-relaxed text-subtle-foreground">{JSON.stringify(value, null, 2)}</pre>
        </details>
    );
}

function StandingRewards({ label, rewards }: { label: string; rewards: QuestTraderStandingReward[] }) {
    return <section><SectionLabel>{label}</SectionLabel><div className="space-y-1.5 text-sm">{rewards.map((reward, index) => <p key={`${reward.trader.id}-${index}`} className="flex flex-wrap items-baseline gap-x-2"><span className="text-muted-foreground">{reward.trader.name}</span><span className={reward.standing >= 0 ? "font-mono text-success" : "font-mono text-danger"}>{formatStanding(reward.standing)}</span></p>)}</div></section>;
}

function formatStanding(value: number) {
    return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;
}
