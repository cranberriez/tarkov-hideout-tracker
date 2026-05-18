"use client";

import { useMemo, type ReactNode } from "react";
import { compareQuestTradersByOrder } from "@/lib/cfg/questTraderOrder";
import type { FullQuest } from "@/types";

interface QuestListByTraderProps {
    questIds: string[];
    questsById: ReadonlyMap<string, FullQuest>;
    highlightQuestIds?: ReadonlySet<string>;
    itemPrefix?: (quest: FullQuest) => ReactNode;
    emptyMessage?: string;
}

interface TraderGroup {
    trader: FullQuest["trader"];
    quests: FullQuest[];
}

export function QuestListByTrader({
    questIds,
    questsById,
    highlightQuestIds,
    itemPrefix,
    emptyMessage = "No quests.",
}: QuestListByTraderProps) {
    const groups = useMemo<TraderGroup[]>(() => {
        const byTrader = new Map<string, TraderGroup>();
        const seen = new Set<string>();

        for (const questId of questIds) {
            if (seen.has(questId)) continue;
            seen.add(questId);
            const quest = questsById.get(questId);
            if (!quest) continue;

            const existing = byTrader.get(quest.trader.id);
            if (existing) {
                existing.quests.push(quest);
            } else {
                byTrader.set(quest.trader.id, { trader: quest.trader, quests: [quest] });
            }
        }

        for (const group of byTrader.values()) {
            group.quests.sort((a, b) => a.name.localeCompare(b.name));
        }

        return Array.from(byTrader.values()).sort((a, b) =>
            compareQuestTradersByOrder(a.trader.name, b.trader.name),
        );
    }, [questIds, questsById]);

    if (groups.length === 0) {
        return <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>;
    }

    return (
        <div className="divide-y divide-white/5">
            {groups.map((group) => (
                <div key={group.trader.id} className="px-3 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {group.trader.imageLink && (
                            <img
                                src={group.trader.imageLink}
                                alt=""
                                className="h-5 w-5 rounded-full border border-white/10"
                            />
                        )}
                        <span>{group.trader.name}</span>
                        <span className="ml-auto text-[11px] tabular-nums text-gray-500">
                            {group.quests.length}
                        </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                        {group.quests.map((quest) => {
                            const highlighted = highlightQuestIds?.has(quest.id) ?? false;
                            return (
                                <li
                                    key={quest.id}
                                    className={
                                        highlighted
                                            ? "rounded-sm border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-sm text-amber-100"
                                            : "rounded-sm border border-white/10 bg-black/20 px-2 py-1 text-sm text-gray-200"
                                    }
                                >
                                    <span className="flex items-center gap-2">
                                        {itemPrefix?.(quest)}
                                        <span>{quest.name}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}
