"use client";

import { ItemReference } from "@/components/entities/item-reference";
import { SectionLabel } from "@/components/ui/detail-section";
import type { ItemSummary } from "@/types/items";
import type { FullQuest, QuestTraderStandingReward } from "@/types/quests";

export function hasQuestRewards(quest: FullQuest) {
    return quest.experience > 0 || (quest.finishItemRewards?.length ?? 0) > 0 || (quest.finishTraderStandingRewards?.length ?? 0) > 0;
}

/** Informational rewards; reward items never become checklist demand. */
export function QuestRewards({ quest, itemById }: { quest: FullQuest; itemById: Readonly<Record<string, ItemSummary>> }) {
    return (
        <div className="mt-12">
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
                return (
                    <ItemReference
                        key={`${reward.itemId}-${index}`}
                        variant="row"
                        item={item ?? { id: reward.itemId, name: "Unknown item" }}
                        linked={!!item}
                        quantityLabel={`×${reward.count.toLocaleString()}`}
                    />
                );
            })}
            </div>}
        </div>
        </div>
    );
}

export function StandingRewards({ label, rewards }: { label: string; rewards: QuestTraderStandingReward[] }) {
    return <section><SectionLabel>{label}</SectionLabel><div className="space-y-1.5 text-sm">{rewards.map((reward, index) => <p key={`${reward.trader.id}-${index}`} className="flex flex-wrap items-baseline gap-x-2"><span className="text-muted-foreground">{reward.trader.name}</span><span className={reward.standing >= 0 ? "font-mono text-success" : "font-mono text-danger"}>{formatStanding(reward.standing)}</span></p>)}</div></section>;
}

function formatStanding(value: number) {
    return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;
}
