"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import { useQuestsContext } from "../QuestsContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { QuestCard, type QuestRef } from "../QuestCard";
import { buildQuestMapGroups, getQuestMapGroupsForQuest } from "../quest-map-groups";
import {
    buildQuestUnlockImpactMap,
    sortQuestsForQuestView,
} from "../quest-sorting";
import { cn } from "@/lib/utils";
import type { FullQuest } from "@/types";
import { QUEST_SCROLL_TO_TRADER_EVENT } from "./QuestsSidebar";

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
    const completedQuests = useUserStore((state) => state.completedQuests);
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

type HeaderRow = {
    kind: "header";
    groupKey: string;
    domId: string;
    title: string;
    imageLink?: string | null;
    fallbackInitial?: string;
    allQuests: FullQuest[];
    visibleCount: number;
};

type QuestRow = {
    kind: "quest";
    quest: FullQuest;
};

type VirtualRow = HeaderRow | QuestRow;

// Estimated heights used for initial layout before measurement
const ESTIMATED_HEADER_HEIGHT = 80;
const ESTIMATED_QUEST_HEIGHT = 60;

export function QuestsList() {
    const {
        quests,
        filteredQuests,
        questsById,
        leadsToByQuestId,
        completedCount,
        failedCount,
        viewMode,
        sortMode,
        traders,
        showDebug,
    } = useQuestsContext();
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

    const questOrderById = useMemo(
        () => new Map(quests.map((quest, index) => [quest.id, index])),
        [quests],
    );
    const unlockImpactById = useMemo(() => buildQuestUnlockImpactMap(quests), [quests]);

    const setGroupCollapsed = (key: string, collapsed: boolean) => {
        setCollapsedGroups((current) => {
            const next = new Set(current);
            if (collapsed) next.add(key);
            else next.delete(key);
            return next;
        });
    };

    const questsByTraderId = useMemo(() => {
        if (viewMode !== "byTrader") return new Map<string, FullQuest[]>();

        const map = new Map<string, FullQuest[]>();
        for (const quest of filteredQuests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        for (const [traderId, traderQuests] of map) {
            map.set(
                traderId,
                sortQuestsForQuestView(
                    traderQuests,
                    sortMode,
                    questOrderById,
                    unlockImpactById,
                ),
            );
        }
        return map;
    }, [filteredQuests, questOrderById, sortMode, unlockImpactById, viewMode]);

    const allQuestsByTraderId = useMemo(() => {
        if (viewMode !== "byTrader") return new Map<string, FullQuest[]>();

        const map = new Map<string, FullQuest[]>();
        for (const quest of quests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        return map;
    }, [quests, viewMode]);

    const questsByMapKey = useMemo(() => {
        if (viewMode !== "byMap") return new Map<string, FullQuest[]>();

        const map = new Map<string, FullQuest[]>();
        for (const quest of filteredQuests) {
            for (const group of getQuestMapGroupsForQuest(quest)) {
                const arr = map.get(group.key) ?? [];
                arr.push(quest);
                map.set(group.key, arr);
            }
        }
        for (const [mapKey, mapQuests] of map) {
            map.set(
                mapKey,
                sortQuestsForQuestView(
                    mapQuests,
                    sortMode,
                    questOrderById,
                    unlockImpactById,
                ),
            );
        }
        return map;
    }, [filteredQuests, questOrderById, sortMode, unlockImpactById, viewMode]);

    const allQuestsByMapKey = useMemo(() => {
        if (viewMode !== "byMap") return new Map<string, FullQuest[]>();

        const map = new Map<string, FullQuest[]>();
        for (const quest of quests) {
            for (const group of getQuestMapGroupsForQuest(quest)) {
                const arr = map.get(group.key) ?? [];
                arr.push(quest);
                map.set(group.key, arr);
            }
        }
        return map;
    }, [quests, viewMode]);

    const mapGroups = useMemo(
        () => (viewMode === "byMap" ? buildQuestMapGroups(quests, true) : []),
        [quests, viewMode],
    );

    const flatQuests = useMemo(() => {
        if (viewMode !== "flatList") return [];
        return sortQuestsForQuestView(
            filteredQuests,
            sortMode,
            questOrderById,
            unlockImpactById,
        );
    }, [filteredQuests, questOrderById, sortMode, unlockImpactById, viewMode]);

    const rows = useMemo<VirtualRow[]>(() => {
        const result: VirtualRow[] = [];

        if (viewMode === "flatList") {
            for (const quest of flatQuests) {
                result.push({ kind: "quest", quest });
            }
        } else if (viewMode === "byTrader") {
            for (const trader of traders) {
                const traderQuests = questsByTraderId.get(trader.id) ?? [];
                if (traderQuests.length === 0) continue;

                const groupKey = `trader:${trader.id}`;
                result.push({
                    kind: "header",
                    groupKey,
                    domId: `trader-${trader.id}`,
                    title: trader.name,
                    imageLink: trader.image4xLink ?? trader.imageLink ?? null,
                    fallbackInitial: trader.name[0],
                    allQuests: allQuestsByTraderId.get(trader.id) ?? [],
                    visibleCount: traderQuests.length,
                });

                if (!collapsedGroups.has(groupKey)) {
                    for (const quest of traderQuests) {
                        result.push({ kind: "quest", quest });
                    }
                }
            }
        } else if (viewMode === "byMap") {
            for (const mapGroup of mapGroups) {
                const mapQuests = questsByMapKey.get(mapGroup.key) ?? [];
                if (mapQuests.length === 0) continue;

                const groupKey = `map:${mapGroup.key}`;
                result.push({
                    kind: "header",
                    groupKey,
                    domId: `map-${mapGroup.key}`,
                    title: mapGroup.name,
                    allQuests: allQuestsByMapKey.get(mapGroup.key) ?? [],
                    visibleCount: mapQuests.length,
                });

                if (!collapsedGroups.has(groupKey)) {
                    for (const quest of mapQuests) {
                        result.push({ kind: "quest", quest });
                    }
                }
            }
        }

        return result;
    }, [
        viewMode,
        flatQuests,
        traders,
        questsByTraderId,
        allQuestsByTraderId,
        mapGroups,
        questsByMapKey,
        allQuestsByMapKey,
        collapsedGroups,
    ]);

    const listRef = useRef<HTMLDivElement>(null);
    const [scrollMargin, setScrollMargin] = useState(0);

    useLayoutEffect(() => {
        if (listRef.current) setScrollMargin(listRef.current.offsetTop);
    }, []);

    const virtualizer = useWindowVirtualizer({
        count: rows.length,
        estimateSize: (index) =>
            rows[index]?.kind === "header" ? ESTIMATED_HEADER_HEIGHT : ESTIMATED_QUEST_HEIGHT,
        overscan: 8,
        scrollMargin,
    });

    useEffect(() => {
        const handleScrollToTrader = (event: Event) => {
            if (viewMode !== "byTrader") return;

            const traderId = (event as CustomEvent<{ traderId?: string }>).detail?.traderId;
            if (!traderId) return;

            const index = rows.findIndex(
                (row) => row.kind === "header" && row.domId === `trader-${traderId}`,
            );
            if (index === -1) return;

            virtualizer.scrollToIndex(index, { align: "start", behavior: "smooth" });
        };

        window.addEventListener(QUEST_SCROLL_TO_TRADER_EVENT, handleScrollToTrader);
        return () => window.removeEventListener(QUEST_SCROLL_TO_TRADER_EVENT, handleScrollToTrader);
    }, [rows, viewMode, virtualizer]);

    const [pendingScrollQuestId, setPendingScrollQuestId] = useState<string | null>(null);

    // Fires after rows rebuild (e.g. after a collapsed group is expanded for the target quest)
    useEffect(() => {
        if (!pendingScrollQuestId) return;
        const index = rows.findIndex(
            (r) => r.kind === "quest" && r.quest.id === pendingScrollQuestId,
        );
        if (index === -1) return;
        virtualizer.scrollToIndex(index, { align: "start", behavior: "smooth" });
        const frame = requestAnimationFrame(() => setPendingScrollQuestId(null));
        return () => cancelAnimationFrame(frame);
    }, [pendingScrollQuestId, rows, virtualizer]);

    // Handle URL hash on mount — e.g. "view on quests page" links from the items page
    useEffect(() => {
        const hash = window.location.hash;
        const match = hash.match(/^#quest-(.+)$/);
        if (!match) return;
        const questId = match[1];
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        const quest = questsById.get(questId);
        if (!quest) return;
        const frame = requestAnimationFrame(() => {
            if (viewMode === "byTrader") {
                setGroupCollapsed(`trader:${quest.trader.id}`, false);
            } else if (viewMode === "byMap") {
                setGroupCollapsed(`map:${getQuestMapGroupsForQuest(quest)[0]?.key}`, false);
            }
            setPendingScrollQuestId(questId);
        });
        return () => cancelAnimationFrame(frame);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        const normalized = statuses.map((status) => status.toLowerCase());
        if (normalized.includes("complete") && normalized.includes("failed")) return "resolved";
        if (normalized.includes("failed")) return "failed";
        if (normalized.includes("active")) return "active";
        return "complete";
    }

    function getSortMetadata(quest: FullQuest) {
        if (sortMode === "xp") {
            return {
                key: "xp",
                label: `${quest.experience.toLocaleString()} XP`,
                title: "Quest experience reward",
            };
        }

        if (sortMode === "unlockImpact") {
            const unlockCount = unlockImpactById.get(quest.id) ?? 0;
            return {
                key: "unlockImpact",
                label: `Unlocks ${unlockCount}`,
                title: "Total direct and indirect quests unlocked",
            };
        }

        return null;
    }

    function renderCard(quest: FullQuest) {
        return (
            <QuestCard
                key={quest.id}
                quest={quest}
                sortMetadata={getSortMetadata(quest)}
                prerequisiteQuests={quest.taskRequirements.map((req) => ({
                    ...toRef(req.task.id, req.task.name),
                    prerequisiteType: getPrerequisiteType(req.status),
                }))}
                leadsToQuests={(leadsToByQuestId.get(quest.id) ?? []).map((id) => toRef(id, id))}
                showDebugButton={showDebug}
                onQuestLinkClick={(targetQuestId) => {
                    const target = questsById.get(targetQuestId);
                    if (!target) return;
                    if (viewMode === "byTrader") {
                        setGroupCollapsed(`trader:${target.trader.id}`, false);
                    } else if (viewMode === "byMap") {
                        setGroupCollapsed(`map:${getQuestMapGroupsForQuest(target)[0]?.key}`, false);
                    }
                    setPendingScrollQuestId(targetQuestId);
                }}
            />
        );
    }

    return (
        <>
            <div className="flex items-center gap-3 px-1 text-xs text-gray-500">
                <span>{filteredQuests.length} quests</span>
                <span className="text-gray-600">|</span>
                <span>
                    {completedCount}/{quests.length} completed
                </span>
                {failedCount > 0 && (
                    <>
                        <span className="text-gray-600">|</span>
                        <span>{failedCount} failed</span>
                    </>
                )}
            </div>

            {filteredQuests.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-600">
                    No quests match the current filters.
                </div>
            ) : (
                <div ref={listRef}>
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                            const row = rows[virtualItem.index];
                            const translateY =
                                virtualItem.start - virtualizer.options.scrollMargin;

                            if (row.kind === "header") {
                                const collapsed = collapsedGroups.has(row.groupKey);
                                return (
                                    <div
                                        key={virtualItem.key}
                                        data-index={virtualItem.index}
                                        ref={virtualizer.measureElement}
                                        id={row.domId}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            transform: `translateY(${translateY}px)`,
                                            paddingBottom: "4px",
                                        }}
                                        className="border-b border-white/5"
                                    >
                                        <QuestGroupHeader
                                            title={row.title}
                                            imageLink={row.imageLink}
                                            fallbackInitial={row.fallbackInitial}
                                            allQuests={row.allQuests}
                                            visibleCount={row.visibleCount}
                                            collapsed={collapsed}
                                            onToggle={() =>
                                                setGroupCollapsed(row.groupKey, !collapsed)
                                            }
                                        />
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    ref={virtualizer.measureElement}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        transform: `translateY(${translateY}px)`,
                                        paddingBottom: "4px",
                                    }}
                                >
                                    {renderCard(row.quest)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
