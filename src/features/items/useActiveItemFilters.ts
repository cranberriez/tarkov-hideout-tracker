"use client";

import { Search, Wrench, ScrollText, Pin, Coins, Filter } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { ActiveFilter } from "@/components/ui/active-filters";
import { useUserStore } from "../../lib/stores/useUserStore";

const selectItemFilterState = (state: ReturnType<typeof useUserStore.getState>) => ({
	itemSourceFilter: state.itemSourceFilter,
	showFirOnly: state.showFirOnly,
	hideCheap: state.hideCheap,
	cheapPriceThreshold: state.cheapPriceThreshold,
	checklistViewMode: state.checklistViewMode,
	showHidden: state.showHidden,
	hiddenStations: state.hiddenStations,
	stationGoals: state.stationGoals,
	itemIgnoreStationGoals: state.itemIgnoreStationGoals,
	itemQuestVisibilityMode: state.itemQuestVisibilityMode,
	itemQuestCustomLookahead: state.itemQuestCustomLookahead,
	itemQuestCustomLevelLookahead: state.itemQuestCustomLevelLookahead,
	itemShowPinnedQuestOnly: state.itemShowPinnedQuestOnly,
	itemShowFutureFir: state.itemShowFutureFir,
	itemShowIgnored: state.itemShowIgnored,
	ignoredQuests: state.ignoredQuests,
});

export function createItemFilterControls(
	state: ReturnType<typeof selectItemFilterState>,
	actions: ReturnType<typeof useUserStore.getState>,
	search: string,
	setSearch: (value: string) => void,
) {
	const filters: ActiveFilter[] = [];
	if (search.trim())
		filters.push({ id: "search", label: `Search: ${search.trim()}`, icon: Search, onRemove: () => setSearch("") });
	if (state.itemSourceFilter !== "all")
		filters.push({
			id: "source",
			label: state.itemSourceFilter === "hideout" ? "Hideout items" : "Quest items",
			icon: Filter,
			onRemove: () => actions.setItemSourceFilter("all"),
		});
	if (state.showFirOnly) filters.push({ id: "fir", label: "FiR only", onRemove: () => actions.setShowFirOnly(false) });
	if (state.hideCheap)
		filters.push({
			id: "cheap",
			label: `Hide cheap: < ${state.cheapPriceThreshold.toLocaleString()} RUB`,
			icon: Coins,
			onRemove: () => actions.setHideCheap(false),
		});
	if (state.itemSourceFilter !== "quest") {
		if (state.checklistViewMode === "nextLevel")
			filters.push({
				id: "levels",
				label: "Next hideout level",
				icon: Wrench,
				onRemove: () => actions.setChecklistViewMode("all"),
			});
		if (!state.showHidden && Object.values(state.hiddenStations).some(Boolean))
			filters.push({
				id: "hidden",
				label: "Hidden stations excluded",
				icon: Wrench,
				onRemove: () => actions.setShowHidden(true),
			});
		if (!state.itemIgnoreStationGoals && Object.keys(state.stationGoals).length > 0)
			filters.push({
				id: "goals",
				label: "Station goals",
				icon: Wrench,
				onRemove: () => actions.setItemIgnoreStationGoals(true),
			});
	}
	// Pinned quest requirements can appear alongside hideout items.
	if (state.itemShowPinnedQuestOnly)
		filters.push({
			id: "pinned",
			label: "Pinned quests only",
			icon: Pin,
			onRemove: () => actions.setItemShowPinnedQuestOnly(false),
		});
	if (state.itemSourceFilter !== "hideout") {
		if (state.itemQuestVisibilityMode !== "allFuture")
			filters.push({
				id: "quests",
				label:
					state.itemQuestVisibilityMode === "custom"
						? `Quest lookahead: ${state.itemQuestCustomLookahead}, levels: ${state.itemQuestCustomLevelLookahead}`
						: state.itemQuestVisibilityMode === "available"
							? "Available quests"
							: "Next quest layer",
				icon: ScrollText,
				onRemove: () => actions.setItemQuestVisibilityMode("allFuture"),
			});
		if (!state.itemShowFutureFir)
			filters.push({
				id: "futureFir",
				label: "Future FiR excluded",
				icon: ScrollText,
				onRemove: () => actions.setItemShowFutureFir(true),
			});
		if (!state.itemShowIgnored && Object.values(state.ignoredQuests).some(Boolean))
			filters.push({
				id: "ignored",
				label: "Ignored quests excluded",
				icon: ScrollText,
				onRemove: () => actions.setItemShowIgnored(true),
			});
	}
	return {
		filters,
		clearSearchAndFilters: () => {
			setSearch("");
			actions.setItemSourceFilter("all");
			actions.setShowFirOnly(false);
			actions.setHideCheap(false);
			actions.setChecklistViewMode("all");
			actions.setShowHidden(true);
			actions.setItemIgnoreStationGoals(true);
			actions.setItemShowPinnedQuestOnly(false);
			actions.setItemQuestVisibilityMode("allFuture");
			actions.setItemShowFutureFir(true);
			actions.setItemShowIgnored(true);
		},
	};
}

export function useActiveItemFilters(search: string, setSearch: (value: string) => void) {
	const state = useUserStore(useShallow(selectItemFilterState));
	return createItemFilterControls(state, useUserStore.getState(), search, setSearch);
}
