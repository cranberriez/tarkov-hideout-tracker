"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AlertTriangle } from "lucide-react";
import type { FullQuest } from "@/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { useQuestsContext } from "./QuestsContext";
import { isQuestAvailableForProfile } from "./quest-sync";
import {
    getFailedQuestRequirementIds,
    getMutuallyExclusiveQuestIds,
    hasGenericFailWarning,
    questCanFail,
} from "@/lib/utils/quest-failures";
import { QuestCompactItemStrip } from "./components/quest-card/QuestCompactItemStrip";
import { QuestCardExpandedContent } from "./components/quest-card/QuestCardExpandedContent";
import { QuestCardHeader } from "./components/quest-card/QuestCardHeader";
import {
    hasRequiredKeys,
    isQuestItemDemandObjective,
} from "./components/quest-card/QuestObjectiveRows";
import type {
    QuestChipData,
    QuestRef,
    QuestSortMetadata,
} from "./components/quest-card/types";

export type { QuestRef } from "./components/quest-card/types";

interface QuestCardProps {
    quest: FullQuest;
    sortMetadata?: QuestSortMetadata | null;
    prerequisiteQuests: QuestRef[];
    leadsToQuests: QuestRef[];
    attachedTop?: boolean;
    className?: string;
    domId?: string;
    forceExpand?: boolean;
    showDebugButton?: boolean;
    highlighted?: boolean;
    onQuestLinkClick?: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function QuestCard({
    quest,
    sortMetadata,
    prerequisiteQuests,
    leadsToQuests,
    attachedTop = false,
    className,
    domId,
    forceExpand = false,
    showDebugButton = false,
    highlighted = false,
    onQuestLinkClick,
}: QuestCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [debugOpen, setDebugOpen] = useState(false);
    const {
        syncProfile,
        questsById,
        failureMap,
        onItemClick,
        requestToggleQuestCompletion,
        requestFailQuest,
        requestResetQuestStatus,
        isQuestDisabled,
    } = useQuestsContext();
    const {
        completedQuests,
        failedQuests,
        ignoredQuests,
        pinnedQuests,
        toggleIgnoredQuest,
        togglePinnedQuest,
    } = useUserStore(
        useShallow((state) => ({
            completedQuests: state.completedQuests,
            failedQuests: state.failedQuests,
            ignoredQuests: state.ignoredQuests,
            pinnedQuests: state.pinnedQuests,
            toggleIgnoredQuest: state.toggleIgnoredQuest,
            togglePinnedQuest: state.togglePinnedQuest,
        })),
    );
    const completed = !!completedQuests[quest.id];
    const failed = !!failedQuests[quest.id];
    const disabled = isQuestDisabled(quest.id);
    const ignored = !!ignoredQuests[quest.id];
    const pinned = !!pinnedQuests[quest.id];
    const completedRequirementCount = quest.taskRequirements.filter((req) => {
        const statuses = req.status.map((status) => status.trim().toLowerCase());
        const prerequisiteCompleted = !!completedQuests[req.task.id];
        const prerequisiteFailed = !!failedQuests[req.task.id];
        return (
            (statuses.includes("complete") && prerequisiteCompleted) ||
            (statuses.includes("failed") && prerequisiteFailed) ||
            (statuses.includes("active") && (prerequisiteCompleted || prerequisiteFailed))
        );
    }).length;
    const available = isQuestAvailableForProfile(quest, syncProfile, questsById);
    const canFail = questCanFail(quest);
    const hasFailWarning = hasGenericFailWarning(quest);
    const mutuallyExclusiveQuestIds = getMutuallyExclusiveQuestIds(quest);
    const questsFailedByCompletingThisQuest = [...new Set(failureMap.get(quest.id) ?? [])];
    const hasMutuallyExclusiveBranch =
        mutuallyExclusiveQuestIds.length > 0 || questsFailedByCompletingThisQuest.length > 0;
    const failedRequirementIds = getFailedQuestRequirementIds(quest);
    const isExpanded = forceExpand || expanded;

    const giveItemObjectives = quest.objectives.filter(isQuestItemDemandObjective);
    const questHasRequiredKeys = quest.objectives.some(hasRequiredKeys);
    const allHandInItems = [
        ...new Map(
            giveItemObjectives.flatMap((o) =>
                o.items.map((item) => [item.id, { ...item, count: o.count, fir: o.foundInRaid }]),
            ),
        ).values(),
    ];
    const mobileStatusChip =
        !completed && (failed || disabled || ignored || !available)
            ? {
                  key: "status",
                  className:
                      failed || disabled
                          ? "text-red-300 bg-red-300/10 border-red-300/20"
                          : ignored
                            ? "text-gray-400 bg-black/50 border-white/10"
                            : "text-red-300 bg-red-300/10 border-red-300/20",
                  label: failed
                      ? "Failed"
                      : disabled
                        ? "Disabled"
                        : ignored
                          ? "Ignored"
                          : "Locked",
              }
            : null;
    const mobileSummaryChips: QuestChipData[] = [
        ...(quest.kappaRequired
            ? [
                  {
                      key: "kappa",
                      className: "text-yellow-500/80 bg-yellow-500/10 border-yellow-500/20",
                      label: "\u03ba",
                  },
              ]
            : []),
        ...(quest.lightkeeperRequired
            ? [
                  {
                      key: "lightkeeper",
                      className: "text-teal-400/80 bg-teal-400/10 border-teal-400/20",
                      label: "LK",
                  },
              ]
            : []),
        ...(hasMutuallyExclusiveBranch
            ? [
                  {
                      key: "mutually-exclusive",
                      className: "text-purple-300 border-purple-500/40",
                      label: (
                          <>
                              <AlertTriangle size={11} className="mr-1" />
                              Branch
                          </>
                      ),
                  },
              ]
            : []),
        ...(mobileStatusChip ? [mobileStatusChip] : []),
    ];
    const mobileMetadataChips: QuestChipData[] = [
        ...(sortMetadata
            ? [
                  {
                      key: `sort-${sortMetadata.key}`,
                      className: "text-tarkov-green/80 bg-tarkov-green/10 border-tarkov-green/20",
                      label: sortMetadata.label,
                  },
              ]
            : []),
        ...(quest.taskRequirements.length > 0
            ? [
                  {
                      key: "requirements",
                      className: "text-gray-400 bg-black/40 border-white/10",
                      label: `${completedRequirementCount}/${quest.taskRequirements.length} prereqs`,
                  },
              ]
            : []),
        ...(quest.minPlayerLevel != null
            ? [
                  {
                      key: "level",
                      className: "text-gray-400 bg-black/40 border-white/10",
                      label: `Level ${quest.minPlayerLevel}`,
                  },
              ]
            : []),
        ...(quest.map
            ? [
                  {
                      key: "map",
                      className: "text-gray-400 bg-black/40 border-white/10",
                      label: quest.map.name,
                  },
              ]
            : []),
        ...(quest.factionName === "USEC" || quest.factionName === "BEAR"
            ? [
                  {
                      key: "faction",
                      className:
                          quest.factionName === "USEC"
                              ? "text-blue-400/80 bg-blue-400/10 border-blue-400/20"
                              : "text-red-400/80 bg-red-400/10 border-red-400/20",
                      label: quest.factionName,
                  },
              ]
            : []),
        ...quest.traderRequirements.map((req) => ({
            key: `trader-${req.id}`,
            className: "text-cyan-400/80 bg-cyan-400/10 border-cyan-400/20",
            label: `${req.trader.name} LL${req.value}`,
        })),
        ...(quest.requiredPrestige
            ? [
                  {
                      key: "prestige",
                      className: "text-purple-400/80 bg-purple-400/10 border-purple-400/20",
                      label: `P${quest.requiredPrestige.prestigeLevel}`,
                  },
              ]
            : []),
    ];

    return (
        <div
            id={domId ?? `quest-${quest.id}`}
            className={cn(
                "overflow-hidden border transition-colors",
                attachedTop ? "rounded-b-md rounded-t-none" : "rounded-md",
                highlighted
                    ? "border-tarkov-green shadow-[0_0_0_1px_rgba(157,255,0,0.18)]"
                    : completed
                      ? "border-white/5 bg-black/10"
                      : failed
                        ? "border-red-500/20 bg-red-500/10"
                        : disabled
                          ? "border-red-500/15 bg-red-500/5"
                          : ignored
                            ? "border-white/8 bg-black/20"
                            : pinned
                              ? "border-sky-500/20 bg-[linear-gradient(90deg,rgba(56,189,248,0.16)_0%,rgba(56,189,248,0.08)_30%,rgba(17,17,17,0.95)_72%)] hover:border-sky-400/30"
                              : "border-white/10 hover:border-white/15",
                completed
                    ? "bg-black/10"
                    : failed
                      ? "bg-red-500/10"
                      : disabled
                        ? "bg-black/20"
                        : ignored
                          ? "bg-black/20"
                          : pinned
                            ? "bg-[linear-gradient(90deg,rgba(56,189,248,0.16)_0%,rgba(56,189,248,0.08)_30%,rgba(17,17,17,0.95)_72%)]"
                            : "bg-[#111111]",
                className,
            )}
        >
            <QuestCardHeader
                quest={quest}
                sortMetadata={sortMetadata}
                completed={completed}
                failed={failed}
                disabled={disabled}
                ignored={ignored}
                pinned={pinned}
                available={available}
                canFail={canFail}
                forceExpand={forceExpand}
                expanded={isExpanded}
                debugOpen={debugOpen}
                showDebugButton={showDebugButton}
                completedRequirementCount={completedRequirementCount}
                hasFailWarning={hasFailWarning}
                hasMutuallyExclusiveBranch={hasMutuallyExclusiveBranch}
                questHasRequiredKeys={questHasRequiredKeys}
                onToggleExpanded={() => setExpanded((v) => !v)}
                onToggleDebug={() => setDebugOpen((v) => !v)}
                onToggleComplete={() => requestToggleQuestCompletion(quest.id)}
                onFailQuest={() => requestFailQuest(quest.id)}
                onResetQuestStatus={() => requestResetQuestStatus(quest.id)}
                onTogglePinned={() => togglePinnedQuest(quest.id)}
                onToggleIgnored={() => toggleIgnoredQuest(quest.id)}
            />

            {!isExpanded && !completed && allHandInItems.length > 0 && (
                <QuestCompactItemStrip
                    items={allHandInItems}
                    onItemClick={onItemClick ?? undefined}
                />
            )}

            {isExpanded && (
                <QuestCardExpandedContent
                    quest={quest}
                    mobileSummaryChips={mobileSummaryChips}
                    mobileMetadataChips={mobileMetadataChips}
                    pinned={pinned}
                    ignored={ignored}
                    disabled={disabled}
                    hasFailWarning={hasFailWarning}
                    failedRequirementIds={failedRequirementIds}
                    questsFailedByCompletingThisQuest={questsFailedByCompletingThisQuest}
                    completedRequirementCount={completedRequirementCount}
                    prerequisiteQuests={prerequisiteQuests}
                    leadsToQuests={leadsToQuests}
                    questsById={questsById}
                    onItemClick={onItemClick ?? undefined}
                    onQuestLinkClick={onQuestLinkClick}
                    onTogglePinned={() => togglePinnedQuest(quest.id)}
                    onToggleIgnored={() => toggleIgnoredQuest(quest.id)}
                />
            )}

            {/* Debug JSON panel */}
            {debugOpen && (
                <div className="border-t border-yellow-500/20 bg-black/60">
                    <pre className="text-[11px] font-mono text-gray-400 leading-relaxed overflow-x-auto max-h-96 p-3 overflow-y-auto">
                        {JSON.stringify(quest, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
