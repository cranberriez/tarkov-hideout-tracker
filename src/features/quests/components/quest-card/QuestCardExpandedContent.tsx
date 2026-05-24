"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import type { FullQuest } from "@/types";
import { ObjectiveRow } from "./QuestObjectiveRows";
import { QuestRelationChip } from "./QuestRelationChip";
import { QuestActionButton } from "./QuestCardHeader";
import { questDetailChipBaseClass } from "./styles";
import type { QuestChipData, QuestRef } from "./types";

interface QuestCardExpandedContentProps {
    quest: FullQuest;
    mobileSummaryChips: QuestChipData[];
    mobileMetadataChips: QuestChipData[];
    pinned: boolean;
    ignored: boolean;
    disabled: boolean;
    hasFailWarning: boolean;
    failedRequirementIds: string[];
    questsFailedByCompletingThisQuest: string[];
    completedRequirementCount: number;
    prerequisiteQuests: QuestRef[];
    leadsToQuests: QuestRef[];
    questsById: Map<string, FullQuest>;
    onItemClick?: (itemId: string) => void;
    onQuestLinkClick?: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
    onTogglePinned: () => void;
    onToggleIgnored: () => void;
}

export function QuestCardExpandedContent({
    quest,
    mobileSummaryChips,
    mobileMetadataChips,
    pinned,
    ignored,
    disabled,
    hasFailWarning,
    failedRequirementIds,
    questsFailedByCompletingThisQuest,
    completedRequirementCount,
    prerequisiteQuests,
    leadsToQuests,
    questsById,
    onItemClick,
    onQuestLinkClick,
    onTogglePinned,
    onToggleIgnored,
}: QuestCardExpandedContentProps) {
    return (
        <div className="px-3 py-3 space-y-3">
            <div className="flex items-start justify-between gap-3 sm:hidden">
                <div className="flex flex-wrap gap-1.5">
                    {mobileSummaryChips.map((chip) => (
                        <span
                            key={chip.key}
                            className={`${questDetailChipBaseClass} ${chip.className}`}
                        >
                            {chip.label}
                        </span>
                    ))}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <QuestActionButton
                        type="pin"
                        active={pinned}
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinned();
                        }}
                    />
                    <QuestActionButton
                        type="ignore"
                        active={ignored}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleIgnored();
                        }}
                    />
                </div>
            </div>

            {mobileMetadataChips.length > 0 && (
                <div className="space-y-1.5 sm:hidden">
                    <span className="text-[10px] uppercase text-gray-600 font-bold">
                        Details
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {mobileMetadataChips.map((chip) => (
                            <span
                                key={`details-${chip.key}`}
                                className={`${questDetailChipBaseClass} ${chip.className}`}
                            >
                                {chip.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {(hasFailWarning ||
                questsFailedByCompletingThisQuest.length > 0 ||
                failedRequirementIds.length > 0 ||
                disabled) && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {disabled && (
                        <span
                            className={`${questDetailChipBaseClass} text-red-300 bg-red-500/10 border-red-500/20`}
                        >
                            Disabled by completed branch
                        </span>
                    )}
                    {hasFailWarning && (
                        <span
                            className={`${questDetailChipBaseClass} text-amber-300 bg-amber-500/10 border-amber-500/20`}
                        >
                            <AlertTriangle size={13} />
                            Can fail -{" "}
                            {quest.failConditions?.[0]?.description
                                ? quest.failConditions?.[0]?.description
                                : "check wiki"}
                        </span>
                    )}
                    {questsFailedByCompletingThisQuest.length > 0 && (
                        <div className="flex min-h-7 flex-wrap items-center gap-1.5 rounded bg-purple-500/10 px-2.5 py-1 text-xs leading-snug text-purple-200">
                            <AlertTriangle size={13} className="shrink-0" />
                            <span className="font-medium">
                                Completing this quest would fail:
                            </span>
                            {questsFailedByCompletingThisQuest.map((questId) => {
                                const failedQuest = questsById.get(questId);

                                return (
                                    <a
                                        key={`completing-fails-${questId}`}
                                        href={`#quest-${questId}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onQuestLinkClick?.(questId, e);
                                        }}
                                        className="rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-100 transition-colors border border-purple-500/20 hover:bg-purple-500/20 hover:text-white"
                                    >
                                        {failedQuest?.name ?? questId}
                                    </a>
                                );
                            })}
                        </div>
                    )}
                    {failedRequirementIds.map((questId) => (
                        <span
                            key={`failed-req-${questId}`}
                            className={`${questDetailChipBaseClass} text-red-200 bg-red-500/10 border-red-500/20`}
                        >
                            Requires {questsById.get(questId)?.name ?? questId} failed
                        </span>
                    ))}
                </div>
            )}

            <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                    Objectives
                </span>
                <div className="space-y-1.5">
                    {quest.objectives.map((obj) => (
                        <ObjectiveRow
                            key={obj.id}
                            objective={obj}
                            onItemClick={onItemClick}
                        />
                    ))}
                </div>
            </div>

            {(quest.minPlayerLevel != null || quest.taskRequirements.length > 0) && (
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                        Requirements
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {quest.minPlayerLevel != null && (
                            <span
                                className={`${questDetailChipBaseClass} text-gray-400 bg-black/40 border-white/10`}
                            >
                                Requires Level {quest.minPlayerLevel}
                            </span>
                        )}
                        {quest.taskRequirements.length > 0 && (
                            <span
                                className={`${questDetailChipBaseClass} text-gray-400 bg-black/40 border-white/10`}
                            >
                                {completedRequirementCount}/{quest.taskRequirements.length}{" "}
                                prerequisite quests completed
                            </span>
                        )}
                    </div>
                </div>
            )}

            {prerequisiteQuests.length > 0 && (
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                        Requires
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {prerequisiteQuests.map((ref) => (
                            <QuestRelationChip
                                key={ref.id}
                                questRef={ref}
                                onQuestLinkClick={onQuestLinkClick}
                            />
                        ))}
                    </div>
                </div>
            )}

            {leadsToQuests.length > 0 && (
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                        Unlocks
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {leadsToQuests.map((ref) => (
                            <QuestRelationChip
                                key={ref.id}
                                questRef={ref}
                                onQuestLinkClick={onQuestLinkClick}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-xs text-gray-600">
                    {quest.experience.toLocaleString()} XP
                </span>
                <div className="flex items-center gap-3">
                    {quest.map && (
                        <span className="text-xs text-gray-500">{quest.map.name}</span>
                    )}
                    {quest.wikiLink && (
                        <a
                            href={quest.wikiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-tarkov-green transition-colors"
                        >
                            Wiki <ExternalLink size={11} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

