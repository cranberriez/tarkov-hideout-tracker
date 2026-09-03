"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import { useQuestsContext } from "../QuestsContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { QuestCard, type QuestRef } from "../QuestCard";
import { buildQuestMapGroups, getQuestMapGroupsForQuest } from "../quest-map-groups";
import {
    buildQuestUnlockImpactMap,
    sortQuestsForMapView,
    sortQuestsForQuestView,
} from "../quest-sorting";
import {
    deriveQuestOrganization,
    QUEST_SERIES_MANIFEST,
    type QuestCategory,
} from "@/lib/utils/quest-organization";
import {
    QUEST_NAVIGATE_TO_QUEST_EVENT,
} from "../quest-deep-link";
import { cn } from "@/lib/utils";
import { getQuestRelationTiming } from "@/lib/utils/quest-relations";
import type { FullQuest } from "@/types/quests";
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

interface SeriesQuestGroup {
    seriesId: string;
    name: string;
    allQuests: FullQuest[];
    quests: FullQuest[];
}

interface TraderCategoryGroup {
    category: QuestCategory;
    allQuests: FullQuest[];
    quests: FullQuest[];
    seriesGroups: SeriesQuestGroup[];
}

const QUEST_CATEGORY_ORDER: QuestCategory[] = [
    "tier-1",
    "tier-2",
    "tier-3",
    "tier-4",
    "series",
];

const QUEST_CATEGORY_LABELS: Record<QuestCategory, string> = {
    "tier-1": "Trader Tier 1 (LL1)",
    "tier-2": "Trader Tier 2 (LL2)",
    "tier-3": "Trader Tier 3 (LL3)",
    "tier-4": "Trader Tier 4 (LL4)",
    series: "Series Quests",
};

const SERIES_ORDER_BY_ID = new Map(
    QUEST_SERIES_MANIFEST.series.map((series, index) => [series.id, index]),
);

type QuestRow = {
    kind: "quest";
    quest: FullQuest;
};

type VirtualRow = HeaderRow | QuestRow;

// Estimated heights used for initial layout before measurement
const ESTIMATED_HEADER_HEIGHT = 80;
const ESTIMATED_SMALL_QUEST_HEIGHT = 60;
const QUEST_HIGHLIGHT_DURATION_MS = 30_000;

interface QuestNavigationRequest {
    questId: string;
    requestId: number;
}

interface QuestsListProps {
    questNavigationRequest: QuestNavigationRequest | null;
}

export function QuestsList({ questNavigationRequest }: QuestsListProps) {
    const {
        quests,
        filteredQuests,
        questsById,
        leadsToByQuestId,
        completedCount,
        failedCount,
        viewMode,
        sortMode,
        selectedMaps,
        traders,
        showDebug,
        onQuestClick,
    } = useQuestsContext();
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

    const questOrderById = useMemo(
        () => new Map(quests.map((quest, index) => [quest.id, index])),
        [quests],
    );
    const unlockImpactById = useMemo(() => buildQuestUnlockImpactMap(quests), [quests]);
    const questOrganization = useMemo(() => deriveQuestOrganization(quests), [quests]);
    const organizationByQuestId = questOrganization.byQuestId;

    const setGroupCollapsed = useCallback((key: string, collapsed: boolean) => {
        setCollapsedGroups((current) => {
            const next = new Set(current);
            if (collapsed) next.add(key);
            else next.delete(key);
            return next;
        });
    }, []);

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

    const traderCategoryGroups = useMemo(() => {
        if (viewMode !== "byTrader") return new Map<string, Map<QuestCategory, TraderCategoryGroup>>();

        const allByTraderCategory = new Map<string, Map<QuestCategory, FullQuest[]>>();
        const visibleByTraderCategory = new Map<string, Map<QuestCategory, FullQuest[]>>();

        const addQuest = (
            target: Map<string, Map<QuestCategory, FullQuest[]>>,
            quest: FullQuest,
        ) => {
            const category = organizationByQuestId.get(quest.id)?.category ?? "tier-1";
            const byCategory = target.get(quest.trader.id) ?? new Map<QuestCategory, FullQuest[]>();
            const categoryQuests = byCategory.get(category) ?? [];
            categoryQuests.push(quest);
            byCategory.set(category, categoryQuests);
            target.set(quest.trader.id, byCategory);
        };

        for (const quest of quests) addQuest(allByTraderCategory, quest);
        for (const quest of filteredQuests) addQuest(visibleByTraderCategory, quest);

        const result = new Map<string, Map<QuestCategory, TraderCategoryGroup>>();
        for (const [traderId, allByCategory] of allByTraderCategory) {
            const visibleByCategory = visibleByTraderCategory.get(traderId) ?? new Map();
            const categoryGroups = new Map<QuestCategory, TraderCategoryGroup>();

            for (const category of QUEST_CATEGORY_ORDER) {
                const allCategoryQuests = allByCategory.get(category) ?? [];
                const visibleCategoryQuests = visibleByCategory.get(category) ?? [];
                if (allCategoryQuests.length === 0) continue;

                const seriesGroups =
                    category === "series"
                        ? (() => {
                              const allBySeries = new Map<string, FullQuest[]>();
                              const visibleBySeries = new Map<string, FullQuest[]>();

                              for (const quest of allCategoryQuests) {
                                  const seriesId = organizationByQuestId.get(quest.id)?.seriesId;
                                  if (!seriesId) continue;
                                  const seriesQuests = allBySeries.get(seriesId) ?? [];
                                  seriesQuests.push(quest);
                                  allBySeries.set(seriesId, seriesQuests);
                              }
                              for (const quest of visibleCategoryQuests) {
                                  const seriesId = organizationByQuestId.get(quest.id)?.seriesId;
                                  if (!seriesId) continue;
                                  const seriesQuests = visibleBySeries.get(seriesId) ?? [];
                                  seriesQuests.push(quest);
                                  visibleBySeries.set(seriesId, seriesQuests);
                              }

                              return [...allBySeries.entries()]
                                  .map(([seriesId, allQuests]) => {
                                      const visibleQuests = visibleBySeries.get(seriesId) ?? [];
                                      const sortByManifestOrder = (a: FullQuest, b: FullQuest) => {
                                          const aOrder =
                                              organizationByQuestId.get(a.id)?.seriesOrder ??
                                              Number.MAX_SAFE_INTEGER;
                                          const bOrder =
                                              organizationByQuestId.get(b.id)?.seriesOrder ??
                                              Number.MAX_SAFE_INTEGER;
                                          if (aOrder !== bOrder) return aOrder - bOrder;
                                          return (
                                              (questOrderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
                                              (questOrderById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
                                          );
                                      };

                                      return {
                                          seriesId,
                                          name:
                                              organizationByQuestId.get(allQuests[0].id)?.seriesName ??
                                              seriesId,
                                          allQuests: [...allQuests].sort(sortByManifestOrder),
                                          quests: [...visibleQuests].sort(sortByManifestOrder),
                                      } satisfies SeriesQuestGroup;
                                  })
                                  .filter((group) => group.quests.length > 0)
                                  .sort(
                                      (a, b) =>
                                          (SERIES_ORDER_BY_ID.get(a.seriesId) ?? Number.MAX_SAFE_INTEGER) -
                                              (SERIES_ORDER_BY_ID.get(b.seriesId) ?? Number.MAX_SAFE_INTEGER) ||
                                          a.name.localeCompare(b.name),
                                  );
                          })()
                        : [];

                const sortedVisibleQuests =
                    category === "series"
                        ? visibleCategoryQuests
                        : sortQuestsForQuestView(
                              visibleCategoryQuests,
                              sortMode,
                              questOrderById,
                              unlockImpactById,
                          );

                categoryGroups.set(category, {
                    category,
                    allQuests: allCategoryQuests,
                    quests: sortedVisibleQuests,
                    seriesGroups,
                });
            }

            result.set(traderId, categoryGroups);
        }

        return result;
    }, [
        filteredQuests,
        organizationByQuestId,
        quests,
        questOrderById,
        sortMode,
        unlockImpactById,
        viewMode,
    ]);

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
                sortQuestsForMapView(
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

    const mapGroups = useMemo(() => {
        if (viewMode !== "byMap") return [];

        const groups = buildQuestMapGroups(quests, true);
        if (selectedMaps.size === 0) return groups;

        return groups.filter((group) => selectedMaps.has(group.key));
    }, [quests, selectedMaps, viewMode]);

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
                    const categoryGroups = traderCategoryGroups.get(trader.id);
                    for (const category of QUEST_CATEGORY_ORDER) {
                        const categoryGroup = categoryGroups?.get(category);
                        if (!categoryGroup || categoryGroup.quests.length === 0) continue;

                        const categoryGroupKey = `${groupKey}:category:${category}`;
                        result.push({
                            kind: "header",
                            groupKey: categoryGroupKey,
                            domId: `category-${trader.id}-${category}`,
                            title: QUEST_CATEGORY_LABELS[category],
                            allQuests: categoryGroup.allQuests,
                            visibleCount: categoryGroup.quests.length,
                        });

                        if (collapsedGroups.has(categoryGroupKey)) continue;

                        if (category === "series") {
                            for (const seriesGroup of categoryGroup.seriesGroups) {
                                const seriesGroupKey = `${categoryGroupKey}:series:${seriesGroup.seriesId}`;
                                result.push({
                                    kind: "header",
                                    groupKey: seriesGroupKey,
                                    domId: `series-${trader.id}-${seriesGroup.seriesId}`,
                                    title: seriesGroup.name,
                                    allQuests: seriesGroup.allQuests,
                                    visibleCount: seriesGroup.quests.length,
                                });

                                if (!collapsedGroups.has(seriesGroupKey)) {
                                    for (const quest of seriesGroup.quests) {
                                        result.push({ kind: "quest", quest });
                                    }
                                }
                            }
                        } else {
                            for (const quest of categoryGroup.quests) {
                                result.push({ kind: "quest", quest });
                            }
                        }
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
        traderCategoryGroups,
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
            rows[index]?.kind === "header"
                ? ESTIMATED_HEADER_HEIGHT
                : ESTIMATED_SMALL_QUEST_HEIGHT,
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
    const [highlightedQuestId, setHighlightedQuestId] = useState<string | null>(null);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledQuestNavigationRequestIdRef = useRef<number | null>(null);

    const highlightQuest = useCallback((questId: string) => {
        setHighlightedQuestId(questId);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedQuestId((current) => (current === questId ? null : current));
            highlightTimeoutRef.current = null;
        }, QUEST_HIGHLIGHT_DURATION_MS);
    }, []);

    const scrollToVisibleQuest = useCallback(
        (questId: string) => {
            const quest = questsById.get(questId);
            if (!quest) return false;

            const isVisible = filteredQuests.some((filteredQuest) => filteredQuest.id === questId);
            if (!isVisible) return false;

            if (viewMode === "byTrader") {
                const traderGroupKey = `trader:${quest.trader.id}`;
                setGroupCollapsed(traderGroupKey, false);

                const organization = organizationByQuestId.get(questId);
                if (organization) {
                    const categoryGroupKey = `${traderGroupKey}:category:${organization.category}`;
                    setGroupCollapsed(categoryGroupKey, false);
                    if (organization.seriesId) {
                        setGroupCollapsed(
                            `${categoryGroupKey}:series:${organization.seriesId}`,
                            false,
                        );
                    }
                }
            } else if (viewMode === "byMap") {
                setGroupCollapsed(`map:${getQuestMapGroupsForQuest(quest)[0]?.key}`, false);
            }
            highlightQuest(questId);
            setPendingScrollQuestId(questId);
            return true;
        },
        [
            filteredQuests,
            highlightQuest,
            organizationByQuestId,
            questsById,
            setGroupCollapsed,
            viewMode,
        ],
    );

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

    useEffect(() => {
        const handleQuestNavigation = (event: Event) => {
            const questId = (event as CustomEvent<{ questId?: string }>).detail?.questId;
            if (!questId) return;
            scrollToVisibleQuest(questId);
        };

        window.addEventListener(QUEST_NAVIGATE_TO_QUEST_EVENT, handleQuestNavigation);
        return () =>
            window.removeEventListener(QUEST_NAVIGATE_TO_QUEST_EVENT, handleQuestNavigation);
    }, [scrollToVisibleQuest]);

    useEffect(() => {
        if (!questNavigationRequest) return;
        if (handledQuestNavigationRequestIdRef.current === questNavigationRequest.requestId) return;
        handledQuestNavigationRequestIdRef.current = questNavigationRequest.requestId;

        const frame = requestAnimationFrame(() =>
            scrollToVisibleQuest(questNavigationRequest.questId),
        );
        return () => cancelAnimationFrame(frame);
    }, [questNavigationRequest, scrollToVisibleQuest]);

    useEffect(() => {
        return () => {
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        };
    }, []);

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
                    prerequisiteType: getQuestRelationTiming(req.status),
                }))}
                leadsToQuests={(leadsToByQuestId.get(quest.id) ?? []).map((id) => {
                    const target = questsById.get(id);
                    const requirement = target?.taskRequirements.find((entry) => entry.task.id === quest.id);
                    return {
                        ...toRef(id, id),
                        prerequisiteType: getQuestRelationTiming(requirement?.status ?? []),
                    };
                })}
                showDebugButton={showDebug}
                highlighted={highlightedQuestId === quest.id}
                onQuestLinkClick={(targetQuestId, event) => {
                    const target = questsById.get(targetQuestId);
                    if (!target) return;
                    event?.preventDefault();
                    if (!scrollToVisibleQuest(targetQuestId)) {
                        onQuestClick?.(targetQuestId);
                    }
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
