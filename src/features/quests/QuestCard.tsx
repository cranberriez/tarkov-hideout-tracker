"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AlertTriangle } from "lucide-react";
import type { FullQuest } from "@/types/quests";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { formatQuestTraderGate } from "@/lib/utils/quest-trader-gates";
import { hasDisplayQuestLevel } from "@/lib/utils/quest-display";
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
        itemById,
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
                o.itemIds.flatMap((itemId) => {
                    const item = itemById[itemId];
                    return item ? [[item.id, { ...item, count: o.count, fir: o.foundInRaid }] as const] : [];
                }),
            ),
        ).values(),
    ];
    const mobileStatusChip =
        !completed && (failed || disabled || ignored || !available)
            ? {
                  key: "status",
                  className:
                      failed || disabled
                          ? "text-danger bg-danger/10 border-danger/20"
                          : ignored
                            ? "text-muted-foreground bg-shadow/50 border-highlight/10"
                            : "text-danger bg-danger/10 border-danger/20",
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
                      className: "text-warning/80 bg-warning/10 border-warning/20",
                      label: "\u03ba",
                  },
              ]
            : []),
        ...(quest.lightkeeperRequired
            ? [
                  {
                      key: "lightkeeper",
                      className: "text-info/80 bg-info/10 border-info/20",
                      label: "LK",
                  },
              ]
            : []),
        ...(hasMutuallyExclusiveBranch
            ? [
                  {
                      key: "mutually-exclusive",
                      className: "text-special border-special/40",
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
                      className: "text-brand/80 bg-brand/10 border-brand/20",
                      label: sortMetadata.label,
                  },
              ]
            : []),
        ...(quest.taskRequirements.length > 0
            ? [
                  {
                      key: "requirements",
                      className: "text-muted-foreground bg-shadow/40 border-highlight/10",
                      label: `${completedRequirementCount}/${quest.taskRequirements.length} prereqs`,
                  },
              ]
            : []),
        ...(hasDisplayQuestLevel(quest.minPlayerLevel)
            ? [
                  {
                      key: "level",
                      className: "text-muted-foreground bg-shadow/40 border-highlight/10",
                      label: `Level ${quest.minPlayerLevel}`,
                  },
              ]
            : []),
        ...(quest.map
            ? [
                  {
                      key: "map",
                      className: "text-muted-foreground bg-shadow/40 border-highlight/10",
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
                              ? "text-info/80 bg-info/10 border-info/20"
                              : "text-danger/80 bg-danger/10 border-danger/20",
                      label: quest.factionName,
                  },
              ]
            : []),
        ...quest.traderRequirements.map((req) => ({
            key: `trader-${req.id}`,
            className: "text-info/80 bg-info/10 border-info/20",
            label: formatQuestTraderGate(req),
        })),
        ...(quest.requiredPrestige
            ? [
                  {
                      key: "prestige",
                      className: "text-special/80 bg-special/10 border-special/20",
                      label: `P${quest.requiredPrestige.prestigeLevel}`,
                  },
              ]
            : []),
    ];

    const cardHeader = (
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
    );
    const expandedContent = isExpanded ? (
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
    ) : null;

    return (
        <div
            id={domId ?? `quest-${quest.id}`}
            className={cn(
                "overflow-hidden border transition-colors",
                attachedTop ? "rounded-b-md rounded-t-none" : "rounded-md",
                quest.removed
                    ? "border-danger/70 bg-danger/5 shadow-[0_0_0_1px_color-mix(in_oklab,_var(--danger)_12%,_transparent)]"
                    : highlighted
                      ? "border-brand shadow-[0_0_0_1px_color-mix(in_oklab,_var(--brand)_18%,_transparent)]"
                    : completed
                      ? "border-highlight/5 bg-shadow/10"
                      : failed
                        ? "border-danger/20 bg-danger/10"
                        : disabled
                          ? "border-danger/15 bg-danger/5"
                          : ignored
                            ? "border-highlight/8 bg-shadow/20"
                            : pinned
                              ? "border-info/20 bg-[linear-gradient(90deg,color-mix(in_oklab,_var(--info)_16%,_transparent)_0%,color-mix(in_oklab,_var(--info)_8%,_transparent)_30%,color-mix(in_oklab,_var(--shadow)_95%,_transparent)_72%)] hover:border-info/30"
                              : "border-highlight/10 hover:border-highlight/15",
                quest.removed
                    ? "bg-danger/5"
                    : completed
                      ? "bg-shadow/10"
                    : failed
                      ? "bg-danger/10"
                      : disabled
                        ? "bg-shadow/20"
                        : ignored
                          ? "bg-shadow/20"
                          : pinned
                            ? "bg-[linear-gradient(90deg,color-mix(in_oklab,_var(--info)_16%,_transparent)_0%,color-mix(in_oklab,_var(--info)_8%,_transparent)_30%,color-mix(in_oklab,_var(--shadow)_95%,_transparent)_72%)]"
                            : "bg-[var(--card-bg)]",
                className,
            )}
        >
            {cardHeader}
            {!isExpanded && !completed && allHandInItems.length > 0 && (
                <QuestCompactItemStrip
                    items={allHandInItems}
                    onItemClick={onItemClick ?? undefined}
                />
            )}
            {expandedContent}

            {/* Debug JSON panel */}
            {debugOpen && (
                <div className="border-t border-warning/20 bg-shadow/60">
                    <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed overflow-x-auto max-h-96 p-3 overflow-y-auto">
                        {JSON.stringify(quest, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
