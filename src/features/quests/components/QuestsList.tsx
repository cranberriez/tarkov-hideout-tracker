"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuestsContext } from "../QuestsContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { QuestCard, type QuestRef } from "../QuestCard";
import { buildQuestMapGroups, getQuestMapGroup } from "../quest-map-groups";
import { cn } from "@/lib/utils";
import type { FullQuest } from "@/types";

interface QuestGroupHeaderProps {
    title: string;
    imageLink?: string | null;
    fallbackInitial?: string;
    allQuests: FullQuest[];
    visibleCount: number;
    collapsed: boolean;
    onToggle: () => void;
}

function QuestGroupHeader({
    title,
    imageLink,
    fallbackInitial,
    allQuests,
    visibleCount,
    collapsed,
    onToggle,
}: QuestGroupHeaderProps) {
    const { completedQuests } = useUserStore();
    const total = allQuests.length;
    const completed = allQuests.filter((q) => completedQuests[q.id]).length;
    const pct = total > 0 ? (completed / total) * 100 : 0;
    const showAvatar = imageLink !== undefined || fallbackInitial !== undefined;

    return (
        <button
            type="button"
            onClick={onToggle}
            className="group mt-2 flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-colors hover:bg-white/1"
        >
            {showAvatar &&
                (imageLink ? (
                    <img
                        src={imageLink}
                        alt={title}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-gray-400">
                        {fallbackInitial}
                    </div>
                ))}
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold uppercase tracking-wide text-white">
                        {title}
                    </span>
                    <span className="text-xs text-gray-500">
                        {completed}/{total}
                    </span>
                </div>
                <div className="mt-1 h-0.5 w-28 overflow-hidden rounded-full bg-white/5">
                    <div
                        className="h-full rounded-full bg-tarkov-green/50 transition-all"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
            <span className="hidden shrink-0 text-xs text-gray-600 sm:inline">
                {visibleCount} showing
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-transparent transition-colors group-hover:bg-white/6">
                <ChevronDown
                    size={13}
                    className={cn(
                        "shrink-0 text-gray-600 transition-[transform,color] group-hover:text-gray-400",
                        collapsed && "-rotate-90",
                    )}
                />
            </div>
        </button>
    );
}

function compareQuestsByRootOrder(
    a: FullQuest,
    b: FullQuest,
    questOrderById: Map<string, number>,
) {
    const levelDiff = (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0);
    if (levelDiff !== 0) return levelDiff;

    return (
        (questOrderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (questOrderById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
}

function sortQuestsByChains(
    quests: FullQuest[],
    questOrderById: Map<string, number>,
) {
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const groupQuestIds = new Set(quests.map((quest) => quest.id));
    const childrenByQuestId = new Map<string, FullQuest[]>();
    const roots: FullQuest[] = [];

    for (const quest of quests) {
        const sameGroupPrereqs = quest.taskRequirements.filter((requirement) =>
            groupQuestIds.has(requirement.task.id),
        );

        if (sameGroupPrereqs.length === 0) {
            roots.push(quest);
            continue;
        }

        const primaryPrereq = sameGroupPrereqs.reduce((best, requirement) =>
            (questOrderById.get(requirement.task.id) ?? 0) >
            (questOrderById.get(best.task.id) ?? 0)
                ? requirement
                : best,
        );
        const parentQuest = questsById.get(primaryPrereq.task.id);

        if (!parentQuest) {
            roots.push(quest);
            continue;
        }

        const children = childrenByQuestId.get(parentQuest.id) ?? [];
        children.push(quest);
        childrenByQuestId.set(parentQuest.id, children);
    }

    for (const children of childrenByQuestId.values()) {
        children.sort((a, b) => compareQuestsByRootOrder(a, b, questOrderById));
    }

    roots.sort((a, b) => compareQuestsByRootOrder(a, b, questOrderById));

    const sorted: FullQuest[] = [];
    const visitedQuestIds = new Set<string>();

    const appendQuestAndChildren = (quest: FullQuest) => {
        if (visitedQuestIds.has(quest.id)) return;

        visitedQuestIds.add(quest.id);
        sorted.push(quest);

        for (const child of childrenByQuestId.get(quest.id) ?? []) {
            appendQuestAndChildren(child);
        }
    };

    for (const root of roots) {
        appendQuestAndChildren(root);
    }

    for (const quest of [...quests].sort((a, b) => compareQuestsByRootOrder(a, b, questOrderById))) {
        appendQuestAndChildren(quest);
    }

    return sorted;
}

export function QuestsList() {
    const {
        quests,
        filteredQuests,
        questsById,
        leadsToByQuestId,
        completedCount,
        viewMode,
        traders,
        showDebug,
    } = useQuestsContext();
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

    const questOrderById = useMemo(
        () => new Map(quests.map((quest, index) => [quest.id, index])),
        [quests],
    );

    const setGroupCollapsed = (key: string, collapsed: boolean) => {
        setCollapsedGroups((current) => {
            const next = new Set(current);
            if (collapsed) next.add(key);
            else next.delete(key);
            return next;
        });
    };

    const questsByTraderId = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of filteredQuests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        for (const [traderId, traderQuests] of map) {
            map.set(traderId, sortQuestsByChains(traderQuests, questOrderById));
        }
        return map;
    }, [filteredQuests, questOrderById]);

    const allQuestsByTraderId = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of quests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        return map;
    }, [quests]);

    const questsByMapKey = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of filteredQuests) {
            const groupKey = getQuestMapGroup(quest.map ?? null).key;
            const arr = map.get(groupKey) ?? [];
            arr.push(quest);
            map.set(groupKey, arr);
        }
        for (const [mapKey, mapQuests] of map) {
            map.set(mapKey, sortQuestsByChains(mapQuests, questOrderById));
        }
        return map;
    }, [filteredQuests, questOrderById]);

    const allQuestsByMapKey = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of quests) {
            const groupKey = getQuestMapGroup(quest.map ?? null).key;
            const arr = map.get(groupKey) ?? [];
            arr.push(quest);
            map.set(groupKey, arr);
        }
        return map;
    }, [quests]);

    const mapGroups = useMemo(() => buildQuestMapGroups(quests, true), [quests]);

    function toRef(id: string, fallbackName: string): QuestRef {
        const q = questsById.get(id);
        return {
            id,
            name: q?.name ?? fallbackName,
            trader: q
                ? {
                      imageLink: q.trader.imageLink ?? null,
                      image4xLink: q.trader.image4xLink ?? null,
                      name: q.trader.name,
                  }
                : { imageLink: null, image4xLink: null, name: "?" },
        };
    }

    function getPrerequisiteType(statuses: string[]): QuestRef["prerequisiteType"] {
        if (statuses.some((status) => status.toLowerCase() === "active")) return "active";
        return "complete";
    }

    function renderCard(quest: FullQuest) {
        return (
            <QuestCard
                key={quest.id}
                quest={quest}
                prerequisiteQuests={quest.taskRequirements.map((req) => ({
                    ...toRef(req.task.id, req.task.name),
                    prerequisiteType: getPrerequisiteType(req.status),
                }))}
                leadsToQuests={(leadsToByQuestId.get(quest.id) ?? []).map((id) => toRef(id, id))}
                showDebugButton={showDebug}
            />
        );
    }

    const empty = (
        <div className="flex items-center justify-center py-16 text-sm text-gray-600">
            No quests match the current filters.
        </div>
    );

    return (
        <>
            <div className="flex items-center gap-3 px-1 text-xs text-gray-500">
                <span>{filteredQuests.length} quests</span>
                <span className="text-gray-600">|</span>
                <span>
                    {completedCount}/{quests.length} completed
                </span>
            </div>

            {viewMode === "byTrader" ? (
                <div>
                    {traders.map((trader) => {
                        const traderQuests = questsByTraderId.get(trader.id) ?? [];
                        if (traderQuests.length === 0) return null;

                        const groupKey = `trader:${trader.id}`;
                        const collapsed = collapsedGroups.has(groupKey);

                        return (
                            <div
                                key={trader.id}
                                id={`trader-${trader.id}`}
                                className="border-b border-white/5 pb-2 last:border-b-0"
                            >
                                <QuestGroupHeader
                                    title={trader.name}
                                    imageLink={trader.image4xLink ?? trader.imageLink ?? null}
                                    fallbackInitial={trader.name[0]}
                                    allQuests={allQuestsByTraderId.get(trader.id) ?? []}
                                    visibleCount={traderQuests.length}
                                    collapsed={collapsed}
                                    onToggle={() => setGroupCollapsed(groupKey, !collapsed)}
                                />
                                {!collapsed && (
                                    <div className="mt-1 mb-2 space-y-1">
                                        {traderQuests.map(renderCard)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filteredQuests.length === 0 && empty}
                </div>
            ) : (
                <div>
                    {mapGroups.map((mapGroup) => {
                        const mapQuests = questsByMapKey.get(mapGroup.key) ?? [];
                        if (mapQuests.length === 0) return null;

                        const groupKey = `map:${mapGroup.key}`;
                        const collapsed = collapsedGroups.has(groupKey);

                        return (
                            <div
                                key={mapGroup.key}
                                id={`map-${mapGroup.key}`}
                                className="border-b border-white/5 pb-2 last:border-b-0"
                            >
                                <QuestGroupHeader
                                    title={mapGroup.name}
                                    allQuests={allQuestsByMapKey.get(mapGroup.key) ?? []}
                                    visibleCount={mapQuests.length}
                                    collapsed={collapsed}
                                    onToggle={() => setGroupCollapsed(groupKey, !collapsed)}
                                />
                                {!collapsed && (
                                    <div className="mt-1 mb-2 space-y-1">
                                        {mapQuests.map(renderCard)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filteredQuests.length === 0 && empty}
                </div>
            )}
        </>
    );
}
