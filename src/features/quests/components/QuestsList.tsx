"use client";

import { useMemo } from "react";
import { useQuestsContext } from "../QuestsContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { QuestCard, type QuestRef } from "../QuestCard";
import type { FullQuest } from "@/types";

function TraderGroupHeader({
    trader,
    allQuests,
    visibleCount,
}: {
    trader: FullQuest["trader"];
    allQuests: FullQuest[];
    visibleCount: number;
}) {
    const { completedQuests } = useUserStore();
    const total = allQuests.length;
    const completed = allQuests.filter((q) => completedQuests[q.id]).length;
    const pct = total > 0 ? (completed / total) * 100 : 0;

    return (
        <div className="flex items-center gap-3 pt-5 pb-2.5 border-b border-white/5">
            {trader.image4xLink ?? trader.imageLink ? (
                <img
                    src={trader.image4xLink ?? trader.imageLink ?? ""}
                    alt={trader.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                />
            ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400 shrink-0">
                    {trader.name[0]}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-white tracking-wide uppercase">
                        {trader.name}
                    </span>
                    <span className="text-xs text-gray-500">
                        {completed}/{total}
                    </span>
                </div>
                <div className="mt-1 h-0.5 rounded-full bg-white/5 overflow-hidden w-28">
                    <div
                        className="h-full bg-tarkov-green/50 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
            <span className="text-xs text-gray-600 shrink-0">{visibleCount} showing</span>
        </div>
    );
}

export function QuestsList() {
    const { quests, filteredQuests, questsById, leadsToByQuestId, completedCount, viewMode, traders } =
        useQuestsContext();

    const questsByTraderId = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of filteredQuests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        return map;
    }, [filteredQuests]);

    const allQuestsByTraderId = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of quests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        return map;
    }, [quests]);

    function toRef(id: string, fallbackName: string): QuestRef {
        const q = questsById.get(id);
        return {
            id,
            name: q?.name ?? fallbackName,
            trader: q
                ? { imageLink: q.trader.imageLink ?? null, image4xLink: q.trader.image4xLink ?? null, name: q.trader.name }
                : { imageLink: null, image4xLink: null, name: "?" },
        };
    }

    function renderCard(quest: FullQuest) {
        return (
            <QuestCard
                key={quest.id}
                quest={quest}
                prerequisiteQuests={quest.taskRequirements.map((req) => toRef(req.task.id, req.task.name))}
                leadsToQuests={(leadsToByQuestId.get(quest.id) ?? []).map((id) => toRef(id, id))}
            />
        );
    }

    const empty = (
        <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
            No quests match the current filters.
        </div>
    );

    return (
        <>
            <div className="flex items-center gap-3 px-1 text-xs text-gray-500">
                <span>{filteredQuests.length} quests</span>
                <span className="text-gray-600">·</span>
                <span>
                    {completedCount}/{quests.length} completed
                </span>
            </div>

            {viewMode === "byTrader" ? (
                <div>
                    {traders.map((trader) => {
                        const traderQuests = questsByTraderId.get(trader.id) ?? [];
                        if (traderQuests.length === 0) return null;
                        return (
                            <div key={trader.id}>
                                <TraderGroupHeader
                                    trader={trader}
                                    allQuests={allQuestsByTraderId.get(trader.id) ?? []}
                                    visibleCount={traderQuests.length}
                                />
                                <div className="space-y-1 mt-1 mb-2">
                                    {traderQuests.map(renderCard)}
                                </div>
                            </div>
                        );
                    })}
                    {filteredQuests.length === 0 && empty}
                </div>
            ) : (
                <div className="space-y-1">
                    {filteredQuests.map(renderCard)}
                    {filteredQuests.length === 0 && empty}
                </div>
            )}
        </>
    );
}
