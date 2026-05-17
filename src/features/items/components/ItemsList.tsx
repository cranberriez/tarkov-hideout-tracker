"use client";

import { useMemo, useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemRow } from "./ItemRow";
import { ItemAnyOfGroupCard } from "./ItemAnyOfGroupCard";
import { poolItems } from "@/lib/utils/item-pooling";
import type { ItemDetails } from "@/types";
import type {
    DerivedQuestAnyOfGroup,
    DerivedQuestItemState,
    QuestAnyOfGroupEntry,
    QuestItemIndexEntry,
} from "@/lib/utils/quest-item-index";
import {
    compareQuestItemState,
    deriveQuestAnyOfGroups,
    deriveQuestItemStates,
} from "@/lib/utils/quest-item-index";
import { useDataContext } from "@/app/(data)/_dataContext";
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

interface ItemsListProps {
    onClickItem: (item: ItemDetails) => void;
    questItemIndex: QuestItemIndexEntry[];
    questAnyOfGroups: QuestAnyOfGroupEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

type MergedItem = {
    id: string;
    count: number;
    firCount: number;
    isTool: boolean;
    isHideout: boolean;
    isQuest: boolean;
    hideoutCount: number;
    hideoutFirCount: number;
    questCount: number;
    questFirCount: number;
    details?: ItemDetails;
    questState?: DerivedQuestItemState;
};

type DisplayItem = MergedItem & { details: ItemDetails };
type QuestSlice = "all" | "pinned" | "unpinned" | "none";
type DisplayEntry =
    | { type: "item"; key: string; item: DisplayItem }
    | { type: "group"; key: string; group: DerivedQuestAnyOfGroup };

export function ItemsList({
    onClickItem,
    questItemIndex,
    questAnyOfGroups,
    questAvailabilityQuests,
}: ItemsListProps) {
    const { stations, items } = useDataContext();
    const { marketPricesByMode } = usePriceDataContext();
    const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});

    const {
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        hideCheap,
        cheapPriceThreshold,
        itemsSize,
        useCategorization,
        showFirOnly,
        itemSourceFilter,
        gameMode,
        completedRequirements,
        completedQuests,
        ignoredQuests,
        pinnedQuests,
        playerLevel,
        prestigeLevel,
        questTraderLoyaltyLevels,
        questFaction,
        itemShowPinnedQuestOnly,
        itemQuestVisibilityMode,
        itemQuestCustomLookahead,
        itemQuestCustomLevelLookahead,
        itemShowFutureFir,
        itemShowIgnored,
        questShowKappa,
        questShowLightkeeper,
    } = useUserStore();

    const deriveOptions = useMemo(
        () => ({
            completedQuests,
            ignoredQuests,
            pinnedQuests,
            playerLevel,
            prestigeLevel,
            faction: questFaction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            quests: questAvailabilityQuests,
            visibilityMode: itemQuestVisibilityMode,
            customLookahead: itemQuestCustomLookahead,
            customLevelLookahead: itemQuestCustomLevelLookahead,
            showFutureFir: itemShowFutureFir,
            showIgnored: itemShowIgnored,
            showKappa: questShowKappa,
            showLightkeeper: questShowLightkeeper,
        }),
        [
            completedQuests,
            ignoredQuests,
            pinnedQuests,
            playerLevel,
            prestigeLevel,
            questFaction,
            questTraderLoyaltyLevels,
            questAvailabilityQuests,
            itemQuestVisibilityMode,
            itemQuestCustomLookahead,
            itemQuestCustomLevelLookahead,
            itemShowFutureFir,
            itemShowIgnored,
            questShowKappa,
            questShowLightkeeper,
        ],
    );

    const itemsById = useMemo(() => {
        if (!items) return null;
        const map: Record<string, ItemDetails> = {};
        for (const item of items) {
            map[item.id] = item;
        }
        return map;
    }, [items]);

    const activeQuestStates = useMemo(
        () => deriveQuestItemStates(questItemIndex, deriveOptions),
        [deriveOptions, questItemIndex],
    );

    const activeQuestGroups = useMemo(
        () => deriveQuestAnyOfGroups(questAnyOfGroups, deriveOptions),
        [deriveOptions, questAnyOfGroups],
    );

    const groupedQuestDeductionsByItemId = useMemo(() => {
        const deductions = new Map<string, { count: number; firCount: number }>();
        for (const group of activeQuestGroups) {
            for (const item of group.items) {
                const existing = deductions.get(item.id) ?? { count: 0, firCount: 0 };
                deductions.set(item.id, {
                    count: existing.count + group.requiredCount,
                    firCount: existing.firCount + group.requiredFirCount,
                });
            }
        }
        return deductions;
    }, [activeQuestGroups]);

    const questStateByItemId = useMemo(
        () =>
            new Map(
                activeQuestStates.map((state) => {
                    const deduction = groupedQuestDeductionsByItemId.get(state.itemId);
                    const requiredCount = Math.max(0, state.requiredCount - (deduction?.count ?? 0));
                    const requiredFirCount = Math.max(
                        0,
                        state.requiredFirCount - (deduction?.firCount ?? 0),
                    );
                    const pinnedRequiredCount = Math.max(
                        0,
                        state.pinnedRequiredCount - (deduction?.count ?? 0),
                    );
                    const pinnedRequiredFirCount = Math.max(
                        0,
                        state.pinnedRequiredFirCount - (deduction?.firCount ?? 0),
                    );
                    return [
                        state.itemId,
                        {
                            ...state,
                            requiredCount,
                            requiredFirCount,
                            pinnedRequiredCount,
                            pinnedRequiredFirCount,
                        },
                    ] as const;
                }),
            ),
        [activeQuestStates, groupedQuestDeductionsByItemId],
    );

    const allItemDetails = useMemo(() => {
        const details: Record<string, ItemDetails> = { ...(itemsById ?? {}) };
        for (const entry of questItemIndex) {
            if (!details[entry.itemId]) {
                details[entry.itemId] = {
                    id: entry.itemId,
                    name: entry.name,
                    normalizedName: entry.normalizedName,
                    iconLink: entry.iconLink,
                    gridImageLink: entry.gridImageLink,
                };
            }
        }
        for (const group of questAnyOfGroups) {
            for (const item of group.items) {
                if (!details[item.id]) {
                    details[item.id] = {
                        id: item.id,
                        name: item.name,
                        normalizedName: item.normalizedName,
                        iconLink: item.iconLink,
                        gridImageLink: item.gridImageLink,
                    };
                }
            }
        }
        return details;
    }, [itemsById, questAnyOfGroups, questItemIndex]);

    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];
    const getPrice = (normalizedName: string) => priceBucket?.prices[normalizedName];

    const pooledHideoutItems = useMemo(() => {
        if (!stations) return [];
        return poolItems({
            stations,
            stationLevels,
            hiddenStations,
            showHidden,
            viewMode: checklistViewMode,
            completedRequirements,
        });
    }, [
        checklistViewMode,
        completedRequirements,
        hiddenStations,
        showHidden,
        stationLevels,
        stations,
    ]);

    const mergedPool = useMemo(() => {
        const merged = new Map<string, MergedItem>(
            pooledHideoutItems.map((item) => [
                item.id,
                {
                    ...item,
                    hideoutCount: item.count,
                    hideoutFirCount: item.firCount,
                    questCount: 0,
                    questFirCount: 0,
                    questState: questStateByItemId.get(item.id),
                },
            ]),
        );

        for (const questState of questStateByItemId.values()) {
            if (questState.requiredCount <= 0 && questState.requiredFirCount <= 0) continue;
            const existing = merged.get(questState.itemId);
            if (existing) {
                merged.set(questState.itemId, {
                    ...existing,
                    count: existing.count + questState.requiredCount,
                    firCount: existing.firCount + questState.requiredFirCount,
                    questCount: questState.requiredCount,
                    questFirCount: questState.requiredFirCount,
                    isQuest: questState.requiredCount > 0,
                    questState,
                });
            } else {
                merged.set(questState.itemId, {
                    id: questState.itemId,
                    count: questState.requiredCount,
                    firCount: questState.requiredFirCount,
                    isTool: false,
                    isHideout: false,
                    isQuest: questState.requiredCount > 0,
                    hideoutCount: 0,
                    hideoutFirCount: 0,
                    questCount: questState.requiredCount,
                    questFirCount: questState.requiredFirCount,
                    details: allItemDetails[questState.itemId],
                    questState,
                });
            }
        }

        return Array.from(merged.values()).map((item) => ({
            ...item,
            details: allItemDetails[item.id],
            questState: item.questState ?? questStateByItemId.get(item.id),
        }));
    }, [allItemDetails, pooledHideoutItems, questStateByItemId]);

    const compareDisplayItems = (a: DisplayItem, b: DisplayItem) => {
        if (a.questState && b.questState) {
            const byQuest = compareQuestItemState(a.questState, b.questState);
            if (byQuest !== 0) return byQuest;
        } else if (a.questState || b.questState) {
            return a.questState ? -1 : 1;
        }
        return a.details.name.localeCompare(b.details.name);
    };

    const finalizeDisplayItems = (
        itemsToDisplay: Array<MergedItem & { details?: ItemDetails; questState?: DerivedQuestItemState }>,
    ): DisplayItem[] => {
        let finalItems = itemsToDisplay.filter((item): item is DisplayItem => !!item.details);

        if (showFirOnly) {
            finalItems = finalItems.filter((item) => (item.firCount || 0) > 0);
        }

        if (hideCheap) {
            finalItems = finalItems.filter((item) => {
                if ((item.firCount || 0) > 0) return true;
                const norm = item.details.normalizedName;
                if (norm === "roubles" || norm === "dollars" || norm === "euros") return true;
                const marketPrice = getPrice(norm);
                if (!marketPrice) return true;
                const unitPrice = marketPrice.avg24hPrice ?? marketPrice.price ?? undefined;
                if (unitPrice == null) return true;
                return unitPrice >= cheapPriceThreshold;
            });
        }

        finalItems.sort(compareDisplayItems);
        return finalItems;
    };

    const buildVisibleItems = (
        includeHideout: boolean,
        questSlice: QuestSlice,
        requirePinnedQuest = false,
    ) =>
        finalizeDisplayItems(
            mergedPool
                .map((item) => {
                    const pinnedQuestCount = item.questState?.pinnedRequiredCount ?? 0;
                    const pinnedQuestFirCount = item.questState?.pinnedRequiredFirCount ?? 0;
                    const visibleQuestCount =
                        questSlice === "none"
                            ? 0
                            : questSlice === "pinned"
                              ? pinnedQuestCount
                              : questSlice === "unpinned"
                                ? Math.max(item.questCount - pinnedQuestCount, 0)
                                : item.questCount;
                    const visibleQuestFirCount =
                        questSlice === "none"
                            ? 0
                            : questSlice === "pinned"
                              ? pinnedQuestFirCount
                              : questSlice === "unpinned"
                                ? Math.max(item.questFirCount - pinnedQuestFirCount, 0)
                                : item.questFirCount;
                    const hideoutCount = includeHideout ? item.hideoutCount : 0;
                    const hideoutFirCount = includeHideout ? item.hideoutFirCount : 0;
                    const count = hideoutCount + visibleQuestCount;
                    const firCount = hideoutFirCount + visibleQuestFirCount;

                    return {
                        ...item,
                        count,
                        firCount,
                        isHideout: includeHideout && item.isHideout,
                        isQuest: visibleQuestCount > 0,
                    };
                })
                .filter(
                    (item) =>
                        !requirePinnedQuest || (item.questState?.pinnedRequiredCount ?? 0) > 0,
                )
                .filter((item) => item.count > 0),
        );

    const visibleQuestGroups = useMemo(() => {
        let groups = activeQuestGroups;
        if (itemSourceFilter === "hideout") groups = [];
        if (itemShowPinnedQuestOnly) groups = groups.filter((group) => group.isPinnedOverride);
        if (showFirOnly) groups = groups.filter((group) => group.requiredFirCount > 0);
        return groups;
    }, [activeQuestGroups, itemShowPinnedQuestOnly, itemSourceFilter, showFirOnly]);

    const sourceItems =
        itemSourceFilter === "hideout"
            ? buildVisibleItems(true, "pinned", itemShowPinnedQuestOnly)
            : itemSourceFilter === "quest"
              ? buildVisibleItems(
                    false,
                    itemShowPinnedQuestOnly ? "pinned" : "all",
                    itemShowPinnedQuestOnly,
                )
              : buildVisibleItems(
                    true,
                    itemShowPinnedQuestOnly ? "pinned" : "all",
                    itemShowPinnedQuestOnly,
                );

    const gridClassesBySize: Record<string, string> = {
        Icon: "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8",
        Compact: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        Expanded: "grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    };
    const gridClasses = gridClassesBySize[itemsSize] ?? gridClassesBySize.Expanded;

    const renderMixedGrid = (itemsToRender: DisplayItem[], groupsToRender: DerivedQuestAnyOfGroup[]) => {
        const entries: DisplayEntry[] = [
            ...groupsToRender.map((group) => ({ type: "group", key: group.groupId, group }) as const),
            ...itemsToRender.map((item) => ({ type: "item", key: item.id, item }) as const),
        ];

        return (
            <div className={`grid gap-2 ${gridClasses}`}>
                {entries.map((entry) => {
                    if (entry.type === "group") {
                        return (
                            <ItemAnyOfGroupCard
                                key={entry.key}
                                group={entry.group}
                                expanded={!!expandedGroupIds[entry.group.groupId]}
                                size={itemsSize}
                                onToggleExpanded={() =>
                                    setExpandedGroupIds((current) => ({
                                        ...current,
                                        [entry.group.groupId]: !current[entry.group.groupId],
                                    }))
                                }
                                onClickItem={onClickItem}
                            />
                        );
                    }

                    const { id, count, firCount, isHideout, isQuest, details } = entry.item;
                    return (
                        <ItemRow
                            key={id}
                            item={details}
                            count={count}
                            firCount={firCount}
                            size={itemsSize}
                            isHideout={isHideout}
                            isQuest={isQuest}
                            onClick={() => onClickItem(details)}
                        />
                    );
                })}
            </div>
        );
    };

    const renderItems = (itemsToRender: DisplayItem[], groupsToRender: DerivedQuestAnyOfGroup[]) => {
        if (!useCategorization) {
            return renderMixedGrid(itemsToRender, groupsToRender);
        }

        const categoryGroups: Record<string, DisplayItem[]> = {};
        for (const item of itemsToRender) {
            const category = item.details.category?.name ?? "Other";
            if (!categoryGroups[category]) categoryGroups[category] = [];
            categoryGroups[category].push(item);
        }

        const sortedCategories = Object.keys(categoryGroups).sort((a, b) => {
            if (a === "Other") return 1;
            if (b === "Other") return -1;
            return a.localeCompare(b);
        });

        return (
            <div className="space-y-8">
                {groupsToRender.length > 0 && (
                    <div>
                        <h2 className="mb-4 border-b border-white/10 pb-2 text-xl font-bold text-tarkov-green">
                            Quest Groups{" "}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                                ({groupsToRender.length})
                            </span>
                        </h2>
                        {renderMixedGrid([], groupsToRender)}
                    </div>
                )}
                {sortedCategories.map((category) => (
                    <div key={category}>
                        <h2 className="mb-4 border-b border-white/10 pb-2 text-xl font-bold text-tarkov-green">
                            {category}{" "}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                                ({categoryGroups[category].length})
                            </span>
                        </h2>
                        <div className={`grid gap-4 ${gridClasses}`}>
                            {categoryGroups[category].map(
                                ({ id, count, firCount, isHideout, isQuest, details }) => (
                                    <ItemRow
                                        key={id}
                                        item={details}
                                        count={count}
                                        firCount={firCount}
                                        size={itemsSize}
                                        isHideout={isHideout}
                                        isQuest={isQuest}
                                        onClick={() => onClickItem(details)}
                                    />
                                ),
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (!stations || !itemsById) {
        return null;
    }

    if (sourceItems.length === 0 && visibleQuestGroups.length === 0) {
        return (
            <div className="py-20 text-center text-gray-500">
                <div className="mb-2 text-xl">No items needed!</div>
                <div className="text-sm">
                    You might have maxed out your hideout, completed your visible quests, or filtered
                    everything out.
                </div>
            </div>
        );
    }

    return <div className="space-y-8">{renderItems(sourceItems, visibleQuestGroups)}</div>;
}
