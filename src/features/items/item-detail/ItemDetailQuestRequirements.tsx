"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Circle, ExternalLink, Gift, PackageOpen } from "lucide-react";
import type {
    DerivedQuestAnyOfGroup,
    DerivedQuestItemQuest,
    DerivedQuestItemState,
    QuestRewardLink,
} from "@/lib/utils/quest-item-index";
import { getQuestDeepLinkHref } from "@/features/quests/quest-deep-link";
import { hasDisplayQuestLevel } from "@/lib/utils/quest-display";
import type { ItemDetails } from "@/types";
import { ItemDetailItemChip } from "./ItemDetailItemChip";

interface ItemDetailQuestRequirementsProps {
    selectedItemId: string;
    selectedItemImageLink?: string;
    questItemState: DerivedQuestItemState | null;
    questRewards: QuestRewardLink[];
    anyOfGroups: DerivedQuestAnyOfGroup[];
    itemDetailsById: Record<string, ItemDetails>;
    completedQuests: Record<string, boolean>;
}

export function ItemDetailQuestRequirements({
    selectedItemId,
    selectedItemImageLink,
    questItemState,
    questRewards,
    anyOfGroups,
    itemDetailsById,
    completedQuests,
}: ItemDetailQuestRequirementsProps) {
    const requiredQuestCount = (questItemState?.relatedQuestCount ?? 0) + anyOfGroups.length;
    const totalQuests = requiredQuestCount + questRewards.length;
    if (totalQuests === 0) return null;

    const relatedQuests = [...(questItemState?.relatedQuests ?? [])].sort(
        (a, b) => Number(a.status === "completed") - Number(b.status === "completed"),
    );
    const sortedGroups = [...anyOfGroups].sort(
        (a, b) => Number(a.status === "completed") - Number(b.status === "completed"),
    );

    return (
        <div>
            {requiredQuestCount > 0 && (
                <section>
                    <div className="border-b border-border-color bg-black/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Required for quests
                    </div>
                    <div className="divide-y divide-border-color">
                        {relatedQuests.map((quest) => (
                            <QuestRow key={quest.questId} quest={quest} itemImageLink={selectedItemImageLink} />
                        ))}
                        {sortedGroups.map((group) => (
                            <AnyOfGroupRow key={group.groupId} group={group} selectedItemId={selectedItemId} itemDetailsById={itemDetailsById} />
                        ))}
                    </div>
                </section>
            )}
            {questRewards.length > 0 && (
                <section className={requiredQuestCount > 0 ? "border-t border-border-color" : ""}>
                    <div className="border-b border-border-color bg-tarkov-green/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-tarkov-green/80">
                        Quest rewards
                    </div>
                    <div className="divide-y divide-border-color">
                        {questRewards.map((reward) => (
                            <QuestRewardRow key={reward.questId} reward={reward} itemImageLink={selectedItemImageLink} completed={!!completedQuests[reward.questId]} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function QuestRewardRow({ reward, itemImageLink, completed }: { reward: QuestRewardLink; itemImageLink?: string; completed: boolean }) {
    return (
        <div className="bg-black/10 px-3 py-2.5 hover:bg-white/[0.02]">
            <div className="flex min-w-0 items-center gap-2.5">
                <Gift size={15} className="shrink-0 text-tarkov-green" />
                {reward.traderImageLink ? (
                    <img src={reward.traderImage4xLink ?? reward.traderImageLink} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-muted-foreground">{reward.traderName[0]}</span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{reward.questName}</span>
                        {completed && <span className="rounded-md bg-tarkov-green/10 px-1.5 py-0.5 text-[10px] text-tarkov-green">Completed</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {reward.traderName}{hasDisplayQuestLevel(reward.minPlayerLevel) ? ` · Level ${reward.minPlayerLevel}` : ""}
                    </div>
                </div>
                <ItemRequirementCount imageLink={itemImageLink} standardCount={reward.count} firCount={0} />
                <QuestActions questId={reward.questId} wikiLink={reward.questWikiLink} />
            </div>
        </div>
    );
}

function QuestRow({
    quest,
    itemImageLink,
}: {
    quest: DerivedQuestItemQuest;
    itemImageLink?: string;
}) {
    const standardCount = quest.requiredCount - quest.requiredFirCount;
    const isCompleted = quest.status === "completed";

    return (
        <div className="bg-black/10 px-3 py-2.5 hover:bg-white/[0.02]">
            <div className="flex min-w-0 items-center gap-2.5">
                {isCompleted ? (
                    <CheckCircle size={15} className="shrink-0 text-tarkov-green" />
                ) : (
                    <Circle size={15} className="shrink-0 text-gray-600" />
                )}
                {quest.traderImageLink ? (
                    <img
                        src={quest.traderImage4xLink ?? quest.traderImageLink}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-muted-foreground">
                        {quest.traderName[0]}
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`truncate text-sm font-medium ${
                                isCompleted
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                            }`}
                        >
                            {quest.questName}
                        </span>
                        <QuestStatus status={quest.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {quest.traderName}
                        {hasDisplayQuestLevel(quest.minPlayerLevel)
                            ? ` · Level ${quest.minPlayerLevel}`
                            : ""}
                    </div>
                </div>
                <ItemRequirementCount
                    imageLink={itemImageLink}
                    standardCount={standardCount}
                    firCount={quest.requiredFirCount}
                />
                <QuestActions questId={quest.questId} wikiLink={quest.questWikiLink} />
            </div>
        </div>
    );
}

function AnyOfGroupRow({
    group,
    selectedItemId,
    itemDetailsById,
}: {
    group: DerivedQuestAnyOfGroup;
    selectedItemId: string;
    itemDetailsById: Record<string, ItemDetails>;
}) {
    const isCompleted = group.status === "completed";
    const groupItems = group.itemIds
        .map((itemId) => itemDetailsById[itemId])
        .filter((item): item is ItemDetails => !!item);
    const selectedItem = groupItems.find((item) => item.id === selectedItemId);
    const otherItems = groupItems.filter((item) => item.id !== selectedItemId);
    const previewItems = selectedItem
        ? [selectedItem, ...otherItems.slice(0, 5)]
        : groupItems.slice(0, 6);
    const hiddenItemCount = Math.max(group.totalItemCount - previewItems.length, 0);

    return (
        <div className="bg-black/10 px-3 py-2.5 hover:bg-white/[0.02]">
            <div className="flex min-w-0 items-center gap-2.5">
                {isCompleted ? (
                    <CheckCircle size={15} className="shrink-0 text-tarkov-green" />
                ) : (
                    <Circle size={15} className="shrink-0 text-gray-600" />
                )}
                {group.traderImageLink ? (
                    <img
                        src={group.traderImage4xLink ?? group.traderImageLink}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-muted-foreground">
                        {group.traderName[0]}
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`truncate text-sm font-medium ${
                                isCompleted
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                            }`}
                        >
                            {group.questName}
                        </span>
                        <span className="rounded-md bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-200">
                            Item group
                        </span>
                        {group.requiredFirCount > 0 && (
                            <span className="rounded-md bg-orange-400/10 px-1.5 py-0.5 text-[10px] text-orange-300">
                                FiR
                            </span>
                        )}
                        <QuestStatus status={group.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {group.traderName}
                        {hasDisplayQuestLevel(group.minPlayerLevel)
                            ? ` · Level ${group.minPlayerLevel}`
                            : ""}
                    </div>
                </div>
                <ItemRequirementCount
                    imageLink={selectedItem?.iconLink ?? selectedItem?.gridImageLink}
                    standardCount={group.requiredCount}
                    firCount={0}
                />
                <QuestActions questId={group.questId} wikiLink={group.questWikiLink} />
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
                {group.objectiveLabel}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                {previewItems.map((item) => (
                    <ItemDetailItemChip
                        key={item.id}
                        item={item}
                        className={`text-[11px] ${
                            item.id === selectedItemId
                                ? "ring-1 ring-tarkov-green/25"
                                : "opacity-75"
                        }`}
                    />
                ))}
                {hiddenItemCount > 0 && (
                    <span className="px-1.5 text-[11px] text-muted-foreground">
                        +{hiddenItemCount} more
                    </span>
                )}
            </div>
        </div>
    );
}

function QuestStatus({ status }: { status: DerivedQuestItemQuest["status"] }) {
    const styles = {
        available: "bg-blue-400/10 text-blue-200",
        future: "bg-amber-400/10 text-amber-200",
        completed: "bg-tarkov-green/10 text-tarkov-green",
        ignored: "bg-white/5 text-muted-foreground",
    };
    return (
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] capitalize ${styles[status]}`}>
            {status}
        </span>
    );
}

function ItemRequirementCount({
    imageLink,
    standardCount,
    firCount,
}: {
    imageLink?: string;
    standardCount: number;
    firCount: number;
}) {
    return (
        <div className="flex min-w-[4.75rem] shrink-0 items-center justify-end gap-1.5 px-2">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white/5">
                {imageLink ? (
                    <img src={imageLink} alt="" className="h-6 w-6 object-contain" />
                ) : (
                    <PackageOpen size={13} className="text-muted-foreground" />
                )}
            </span>
            {standardCount > 0 && (
                <span className="min-w-6 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                    ×{standardCount}
                </span>
            )}
            {firCount > 0 && (
                <span className="whitespace-nowrap font-mono text-xs font-semibold text-orange-300">
                    FiR ×{firCount}
                </span>
            )}
        </div>
    );
}

function QuestActions({ questId, wikiLink }: { questId: string; wikiLink?: string | null }) {
    return (
        <div className="flex shrink-0 items-center gap-3 text-[11px]">
            <Link
                href={getQuestDeepLinkHref(questId)}
                className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-tarkov-green"
            >
                View <ArrowRight size={12} />
            </Link>
            {wikiLink && (
                <a
                    href={wikiLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-muted-foreground underline decoration-white/25 underline-offset-2 transition-colors hover:text-foreground"
                >
                    Wiki <ExternalLink size={10} />
                </a>
            )}
        </div>
    );
}
