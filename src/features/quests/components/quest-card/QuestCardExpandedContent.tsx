"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import type { FullQuest, QuestTraderStandingReward } from "@/types/quests";
import { ObjectiveRow } from "./QuestObjectiveRows";
import { QuestRelationChip } from "./QuestRelationChip";
import { QuestActionButton } from "./QuestCardHeader";
import { questDetailChipBaseClass } from "./styles";
import { hasDisplayQuestLevel } from "@/lib/utils/quest-display";
import { getQuestFailWarningText } from "@/lib/utils/quest-failures";
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
    const finishTraderStandingRewards = quest.finishTraderStandingRewards ?? [];
    const failureTraderStandingRewards = quest.failureTraderStandingRewards ?? [];
    const failWarningText = getQuestFailWarningText(quest);

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
                    <span className="text-[10px] uppercase text-subtle-foreground font-bold">
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
                            className={`${questDetailChipBaseClass} text-danger bg-danger/10 border-danger/20`}
                        >
                            Disabled by completed branch
                        </span>
                    )}
                    {hasFailWarning && (
                        <span
                            className={`${questDetailChipBaseClass} text-warning bg-warning/10 border-warning/20`}
                        >
                            <AlertTriangle size={13} />
                            Can fail - {failWarningText ?? "check wiki"}
                        </span>
                    )}
                    {questsFailedByCompletingThisQuest.length > 0 && (
                        <div className="flex min-h-7 flex-wrap items-center gap-1.5 rounded bg-special/10 px-2.5 py-1 text-xs leading-snug text-special">
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
                                        className="rounded bg-special/10 px-1.5 py-0.5 text-special transition-colors border border-special/20 hover:bg-special/20 hover:text-foreground"
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
                            className={`${questDetailChipBaseClass} text-danger bg-danger/10 border-danger/20`}
                        >
                            Requires {questsById.get(questId)?.name ?? questId} failed
                        </span>
                    ))}
                </div>
            )}

            {(finishTraderStandingRewards.length > 0 ||
                failureTraderStandingRewards.length > 0) && (
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-subtle-foreground font-bold">
                        Trader Reputation
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {finishTraderStandingRewards.map((reward) => (
                            <TraderStandingRewardChip
                                key={`finish-${reward.trader.id}-${reward.standing}`}
                                reward={reward}
                                outcome="Completion"
                            />
                        ))}
                        {failureTraderStandingRewards.map((reward) => (
                            <TraderStandingRewardChip
                                key={`failure-${reward.trader.id}-${reward.standing}`}
                                reward={reward}
                                outcome="Failure"
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-subtle-foreground font-bold">
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

            {(hasDisplayQuestLevel(quest.minPlayerLevel) || quest.taskRequirements.length > 0) && (
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-subtle-foreground font-bold">
                        Requirements
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {hasDisplayQuestLevel(quest.minPlayerLevel) && (
                            <span
                                className={`${questDetailChipBaseClass} text-muted-foreground bg-shadow/40 border-highlight/10`}
                            >
                                Requires Level {quest.minPlayerLevel}
                            </span>
                        )}
                        {quest.taskRequirements.length > 0 && (
                            <span
                                className={`${questDetailChipBaseClass} text-muted-foreground bg-shadow/40 border-highlight/10`}
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
                    <span className="text-[10px] uppercase tracking-wider text-subtle-foreground font-bold">
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
                    <span className="text-[10px] uppercase tracking-wider text-subtle-foreground font-bold">
                        Unlocks
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {leadsToQuests.map((ref) => (
                            <QuestRelationChip
                                key={ref.id}
                                questRef={ref}
                                direction="unlock"
                                onQuestLinkClick={onQuestLinkClick}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-highlight/5">
                <span className="text-xs text-subtle-foreground">
                    {quest.experience.toLocaleString()} XP
                </span>
                <div className="flex items-center gap-3">
                    {quest.map && (
                        <span className="text-xs text-subtle-foreground">{quest.map.name}</span>
                    )}
                    {quest.wikiLink && (
                        <a
                            href={quest.wikiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-subtle-foreground hover:text-brand transition-colors"
                        >
                            Wiki <ExternalLink size={11} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function TraderStandingRewardChip({
    reward,
    outcome,
}: {
    reward: QuestTraderStandingReward;
    outcome: "Completion" | "Failure";
}) {
    const isNegative = reward.standing < 0;
    const imageLink = reward.trader.image4xLink ?? reward.trader.imageLink;

    return (
        <span
            className={`${questDetailChipBaseClass} ${
                isNegative
                    ? "text-danger bg-danger/10 border-danger/20"
                    : "text-success bg-success/10 border-success/20"
            }`}
            title={`${outcome}: ${reward.trader.name} reputation ${formatStanding(reward.standing)}`}
        >
            {imageLink ? (
                <img
                    src={imageLink}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full object-cover"
                />
            ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-highlight/10 text-[9px]">
                    {reward.trader.name[0]}
                </span>
            )}
            <span className="font-medium">{reward.trader.name}</span>
            <span>{formatStanding(reward.standing)}</span>
            {outcome === "Failure" && (
                <span className="rounded bg-shadow/30 px-1 py-0.5 text-[10px] uppercase leading-none text-danger/80">
                    Failure
                </span>
            )}
        </span>
    );
}

function formatStanding(value: number) {
    const formatted = Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
    });

    return `${value < 0 ? "-" : "+"}${formatted}`;
}
