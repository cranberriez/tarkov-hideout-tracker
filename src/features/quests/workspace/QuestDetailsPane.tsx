"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { Bug } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { getQuestTraderTabLoyaltyLevel } from "@/lib/quests/quest-trader-completion-gates";
import { buildMultipleChoiceQuestGroups } from "@/lib/quests/quest-failures";
import type { FullQuest } from "@/types/quests";
import { useQuestActions } from "../QuestActionsContext";
import { buildQuestDetailsModel } from "./quest-details-model";
import { useQuestDetailsController } from "./useQuestDetailsController";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import { QuestDebugPanel } from "./details/QuestDebugPanel";
import { QuestDetailsHeader } from "./details/QuestDetailsHeader";
import { QuestObjectiveMap } from "./details/QuestObjectiveMap";
import { QuestObjectives } from "./details/QuestObjectives";
import { QuestFailureConditions, QuestMultipleChoiceBanner, QuestUnlocks } from "./details/QuestRelations";
import { QuestRequirements } from "./details/QuestRequirements";
import { hasQuestRewards, QuestRewards } from "./details/QuestRewards";

/** Workspace adapter: store/action wiring around the reusable quest detail sections. */
export function QuestDetailsPane({ quest }: { quest: FullQuest }) {
    const {
        quests,
        statusByQuestId,
        questsById,
        maps,
        branchLinesByQuestId,
        retainQuestAfterCompletion,
        openQuestVisualizer,
    } = useQuestWorkspace();
    const { itemById, leadsToByQuestId, requestToggleQuestCompletion, requestFailQuest, requestResetQuestStatus } = useQuestActions();
    const pinned = useUserStore((state) => !!state.pinnedQuests[quest.id]);
    const hidden = useUserStore((state) => !!state.ignoredQuests[quest.id]);
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
            Object.entries(completedQuestObjectives[quest.id] ?? {})
                .filter(([, completed]) => completed)
                .map(([objectiveId]) => objectiveId),
        ),
        [completedQuestObjectives, quest],
    );
    const multipleChoiceGroups = useMemo(
        () => buildMultipleChoiceQuestGroups(quests),
        [quests],
    );
    const questDetailsModel = useMemo(() => buildQuestDetailsModel({
        quest,
        questsById,
        leadsToQuestIds: leadsToByQuestId.get(quest.id) ?? [],
        maps,
        branchLines: branchLinesByQuestId.get(quest.id) ?? [],
        multipleChoiceQuestIds: multipleChoiceGroups.get(quest.id) ?? [],
        completedObjectiveIds,
    }), [branchLinesByQuestId, completedObjectiveIds, leadsToByQuestId, maps, multipleChoiceGroups, quest, questsById]);
    const controller = useQuestDetailsController(quest.id, questDetailsModel.mapData);

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
    } = questDetailsModel;
    const {
        showDebug, setShowDebug, isDesktopMapOpen, setIsDesktopMapOpen,
        isHeaderCondensed, isCompactMapOpen, mapWidthPercent, isResizingMap,
        setHoveredObjectiveId, detailScrollRef, detailSplitRef,
        selectedDetailMapKey, selectedDetailMap, focusedObjectiveId, showObjectiveOnMap,
        openCompactMap, handleDetailScroll,
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
            {multipleChoiceQuests.length > 1 && <QuestMultipleChoiceBanner quest={quest} multipleChoiceQuests={multipleChoiceQuests} />}
            <div className="max-w-6xl px-6 py-10 sm:px-9">
                <section>
                    {(hasRequirements || leadsTo.length > 0 || hasFailureDetails) && <div className="mb-12 flex flex-wrap gap-x-10 gap-y-8">
                        {hasRequirements && (
                            <QuestRequirements
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
                                questsById={questsById}
                            />
                        )}
                        {leadsTo.length > 0 && <QuestUnlocks leadsTo={leadsTo} />}
                        {hasFailureDetails && <QuestFailureConditions quest={quest} questsById={questsById} />}
                    </div>}
                    <QuestObjectives
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
                    />

                    {hasQuestRewards(quest) && <QuestRewards quest={quest} itemById={itemById} />}
                </section>
            </div>
            </div>

            <QuestObjectiveMap quest={quest} controller={controller} onToggleObjectiveCompletion={toggleQuestObjectiveCompletion} />
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
