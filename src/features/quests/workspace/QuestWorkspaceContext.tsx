"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { QUESTS_HREF, questHref as buildQuestHref } from "../quest-routes";
import { useShallow } from "zustand/react/shallow";
import type { FullQuest } from "@/types/quests";
import type { QuestDataIndex } from "../quest-data-index";
import { useUserStore, type QuestSortMode, type QuestWorkspaceLockedFilterSettings } from "@/lib/stores/useUserStore";
import {
	getAvailableObjectiveCategories,
	getQuestMapKeys,
	type QuestObjectiveCategory,
	type QuestWorkspaceStatus,
	type QuestWorkspaceStatusInfo,
} from "./quest-workspace-utils";
import { createQuestMarkerStyles, type QuestMarkerStyle } from "./raid-planner-markers";
import { buildQuestBranchLines, type QuestBranchLine } from "./quest-branch-graph";
import { selectWorkspaceQuests } from "./quest-workspace-selector";

export type QuestWorkspaceMode = "details" | "visualizer" | "planner";
export type QuestListMode = "quests" | "history";
export type QuestFilterSection = "traders" | "maps" | "status" | "filters" | null;

interface QuestWorkspaceContextValue {
	quests: FullQuest[];
	questDataIndex: QuestDataIndex;
	questsById: Map<string, FullQuest>;
	filteredQuests: FullQuest[];
	traders: FullQuest["trader"][];
	maps: QuestDataIndex["maps"];
	objectiveCategories: QuestObjectiveCategory[];
	statusByQuestId: Map<string, QuestWorkspaceStatusInfo>;
	markerByQuestId: Map<string, QuestMarkerStyle>;
	branchLines: QuestBranchLine[];
	branchLineByQuestId: Map<string, QuestBranchLine>;
	branchLinesByQuestId: Map<string, QuestBranchLine[]>;
	selectedQuestId: string | null;
	selectedQuest: FullQuest | null;
	selectedTraderIds: Set<string>;
	filterByTraderRequirements: boolean;
	selectedMapKeys: Set<string>;
	selectedStatuses: Set<QuestWorkspaceStatus>;
	lockedFilters: QuestWorkspaceLockedFilterSettings;
	upcomingLockedQuestIds: Set<string>;
	selectedObjectiveCategories: Set<QuestObjectiveCategory>;
	showHiddenQuests: boolean;
	groupByTrader: boolean;
	groupByLoyaltyLevel: boolean;
	sortMode: QuestSortMode;
	openFilter: QuestFilterSection;
	searchQuery: string;
	mode: QuestWorkspaceMode;
	listMode: QuestListMode;
	plannerMapKey: string | null;
	highlightedQuestId: string | null;
	visualizerLineId: string | null;
	visualizerFocusQuestId: string | null;
	/** Navigates to the quest route (or the index for `null`); the route is the selection source. */
	setSelectedQuestId: (questId: string | null) => void;
	questHref: (questId: string) => string;
	indexHref: string;
	/** Marks a workspace-initiated link so the route change keeps the current planner/visualizer mode. */
	markInternalSelection: (questId: string | null) => void;
	/** True once for a selection started inside the workspace; false for Back/Forward and external links. */
	consumeInternalSelection: (questId: string | null) => boolean;
	toggleTrader: (traderId: string) => void;
	showOnlyTrader: (traderId: string) => void;
	clearTraders: () => void;
	setFilterByTraderRequirements: (enabled: boolean) => void;
	toggleMap: (mapKey: string) => void;
	clearMaps: () => void;
	toggleStatus: (status: QuestWorkspaceStatus) => void;
	setLockedFilters: (filters: Partial<QuestWorkspaceLockedFilterSettings>) => void;
	toggleObjectiveCategory: (category: QuestObjectiveCategory) => void;
	clearObjectiveCategories: () => void;
	setShowHiddenQuests: (enabled: boolean) => void;
	setGroupByTrader: (enabled: boolean) => void;
	setGroupByLoyaltyLevel: (enabled: boolean) => void;
	setSortMode: (mode: QuestSortMode) => void;
	setOpenFilter: (section: QuestFilterSection) => void;
	setSearchQuery: (query: string) => void;
	setMode: (mode: QuestWorkspaceMode) => void;
	setListMode: (mode: QuestListMode) => void;
	retainQuestAfterCompletion: (questId: string) => void;
	selectPlannerMap: (mapKey: string) => void;
	clearPlannerMap: () => void;
	setHighlightedQuestId: (questId: string | null) => void;
	openQuestVisualizer: (lineId: string, focusQuestId?: string | null) => void;
	showQuestVisualizerIndex: () => void;
}

const QuestWorkspaceContext = createContext<QuestWorkspaceContextValue | null>(null);

function toggleSetValue<T>(current: Set<T>, value: T) {
	const next = new Set(current);
	if (next.has(value)) next.delete(value);
	else next.add(value);
	return next;
}

export function QuestWorkspaceProvider({
	quests,
	questDataIndex,
	devQuery = null,
	children,
}: {
	quests: FullQuest[];
	questDataIndex: QuestDataIndex;
	devQuery?: string | null;
	children: ReactNode;
}) {
	const router = useRouter();
	const params = useParams<{ questId?: string }>();
	const selectedQuestId = params?.questId ? decodeRouteParam(params.questId) : null;
	const internalSelection = useRef<{ questId: string | null } | null>(null);
	const [openFilter, setOpenFilter] = useState<QuestFilterSection>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [mode, setMode] = useState<QuestWorkspaceMode>("details");
	const [listMode, setListMode] = useState<QuestListMode>("quests");
	const [groupByTrader, setGroupByTrader] = useState(true);
	const [groupByLoyaltyLevel, setGroupByLoyaltyLevel] = useState(true);
	const [retainedCompletedQuestIds, setRetainedCompletedQuestIds] = useState<Set<string>>(() => new Set());
	const [plannerMapKey, setPlannerMapKey] = useState<string | null>(null);
	const [highlightedQuestId, setHighlightedQuestId] = useState<string | null>(null);
	const [visualizerLineId, setVisualizerLineId] = useState<string | null>(null);
	const [visualizerFocusQuestId, setVisualizerFocusQuestId] = useState<string | null>(null);
	const store = useUserStore(
		useShallow((state) => ({
			playerLevel: state.playerLevel,
			prestigeLevel: state.prestigeLevel,
			faction: state.questFaction,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
			fenceReputation: state.questFenceReputation,
			completedQuests: state.completedQuests,
			failedQuests: state.failedQuests,
			hiddenQuests: state.ignoredQuests,
			showHiddenQuests: state.questShowIgnored,
			selectedTraderIds: state.questWorkspaceSelectedTraders,
			filterByTraderRequirements: state.questWorkspaceFilterByTraderRequirements,
			selectedMapKeys: state.questWorkspaceSelectedMaps,
			selectedStatuses: state.questWorkspaceSelectedStatuses,
			lockedFilters: state.questWorkspaceLockedFilters,
			selectedObjectiveCategories: state.questWorkspaceSelectedObjectiveCategories,
			sortMode: state.questSortMode,
			setSelectedTraderIds: state.setQuestWorkspaceSelectedTraders,
			setFilterByTraderRequirements: state.setQuestWorkspaceFilterByTraderRequirements,
			setSelectedMapKeys: state.setQuestWorkspaceSelectedMaps,
			setSelectedStatuses: state.setQuestWorkspaceSelectedStatuses,
			setLockedFilters: state.setQuestWorkspaceLockedFilters,
			setSelectedObjectiveCategories: state.setQuestWorkspaceSelectedObjectiveCategories,
			setShowHiddenQuests: state.setQuestShowIgnored,
			setSortMode: state.setQuestSortMode,
		})),
	);
	const profile = useMemo(
		() => ({
			playerLevel: store.playerLevel,
			prestigeLevel: store.prestigeLevel,
			faction: store.faction,
			traderLoyaltyLevels: store.traderLoyaltyLevels,
			fenceReputation: store.fenceReputation,
			completedQuests: store.completedQuests,
			failedQuests: store.failedQuests,
		}),
		[
			store.playerLevel,
			store.prestigeLevel,
			store.faction,
			store.traderLoyaltyLevels,
			store.fenceReputation,
			store.completedQuests,
			store.failedQuests,
		],
	);
	const selectedTraderIds = useMemo(() => new Set(store.selectedTraderIds), [store.selectedTraderIds]);
	const externalSelectedMapKeys = useMemo(() => new Set(store.selectedMapKeys), [store.selectedMapKeys]);
	const selectedMapKeys = useMemo(
		() => (mode === "planner" && plannerMapKey ? new Set([plannerMapKey]) : externalSelectedMapKeys),
		[externalSelectedMapKeys, mode, plannerMapKey],
	);
	const selectedStatuses = useMemo(() => new Set(store.selectedStatuses), [store.selectedStatuses]);
	const selectedObjectiveCategories = useMemo(
		() => new Set(store.selectedObjectiveCategories),
		[store.selectedObjectiveCategories],
	);
	const filterByTraderRequirements = store.filterByTraderRequirements;
	const previousCompletedQuests = useRef(profile.completedQuests);

	const { questsById, maps } = questDataIndex;
	const traders = questDataIndex.traders;
	const objectiveCategories = useMemo(() => getAvailableObjectiveCategories(quests), [quests]);
	const branchLines = useMemo(() => buildQuestBranchLines(quests), [quests]);
	const branchLineByQuestId = useMemo(() => {
		const result = new Map<string, QuestBranchLine>();
		for (const line of branchLines) {
			for (const node of line.nodes) {
				if (!result.has(node.quest.id)) result.set(node.quest.id, line);
			}
		}
		return result;
	}, [branchLines]);
	const branchLinesByQuestId = useMemo(() => {
		const result = new Map<string, QuestBranchLine[]>();
		for (const line of branchLines) {
			for (const node of line.nodes) {
				result.set(node.quest.id, [...(result.get(node.quest.id) ?? []), line]);
			}
		}
		return result;
	}, [branchLines]);
	const onlyActiveSelected = selectedStatuses.size === 1 && selectedStatuses.has("active");
	const selection = useMemo(
		() =>
			selectWorkspaceQuests(quests, questsById, profile, {
				selectedTraderIds,
				filterByTraderRequirements,
				selectedMapKeys,
				selectedStatuses,
				lockedFilters: store.lockedFilters,
				selectedObjectiveCategories,
				hiddenQuests: store.hiddenQuests,
				showHiddenQuests: store.showHiddenQuests,
				retainedCompletedQuestIds,
				searchQuery,
			}),
		[
			filterByTraderRequirements,
			profile,
			quests,
			questsById,
			retainedCompletedQuestIds,
			searchQuery,
			selectedMapKeys,
			selectedObjectiveCategories,
			selectedStatuses,
			selectedTraderIds,
			store.hiddenQuests,
			store.lockedFilters,
			store.showHiddenQuests,
		],
	);
	const { statusByQuestId, upcomingLockedQuestIds } = selection;
	const filteredQuests = useMemo(
		() => selection.filteredQuestIds.flatMap((questId) => questsById.get(questId) ?? []),
		[questsById, selection.filteredQuestIds],
	);
	const markerByQuestId = useMemo(
		() =>
			createQuestMarkerStyles(
				plannerMapKey
					? quests.filter(
							(quest) =>
								statusByQuestId.get(quest.id)?.status === "active" && getQuestMapKeys(quest).has(plannerMapKey),
						)
					: [],
			),
		[plannerMapKey, quests, statusByQuestId],
	);

	useEffect(() => {
		const previous = previousCompletedQuests.current;
		previousCompletedQuests.current = profile.completedQuests;
		if (!onlyActiveSelected) return;

		const newlyCompleted = quests
			.filter((quest) => !previous[quest.id] && profile.completedQuests[quest.id])
			.map((quest) => quest.id);
		if (newlyCompleted.length === 0) return;

		setRetainedCompletedQuestIds((current) => new Set([...current, ...newlyCompleted]));
	}, [onlyActiveSelected, profile.completedQuests, quests]);

	const clearRetainedCompletedQuests = () => setRetainedCompletedQuestIds(new Set());
	const retainQuestAfterCompletion = (questId: string) => {
		if (!onlyActiveSelected) return;
		setRetainedCompletedQuestIds((current) => new Set(current).add(questId));
	};

	const questHref = useCallback((questId: string) => buildQuestHref(questId, devQuery), [devQuery]);
	const indexHref = devQuery ? `${QUESTS_HREF}?q=${encodeURIComponent(devQuery)}` : QUESTS_HREF;
	const markInternalSelection = useCallback((questId: string | null) => {
		internalSelection.current = { questId };
	}, []);
	const consumeInternalSelection = useCallback((questId: string | null) => {
		const pending = internalSelection.current;
		internalSelection.current = null;
		return pending !== null && pending.questId === questId;
	}, []);
	const setSelectedQuestId = (questId: string | null) => {
		if (questId === selectedQuestId) return;
		markInternalSelection(questId);
		const href = questId ? questHref(questId) : indexHref;
		// Planner marker focus should not fill browser history; detail selection should.
		if (mode === "planner") router.replace(href, { scroll: false });
		else router.push(href, { scroll: false });
	};

	const selectPlannerMap = (mapKey: string) => {
		setPlannerMapKey(mapKey);
		setMode("planner");
	};

	const openQuestVisualizer = (lineId: string, focusQuestId: string | null = null) => {
		setVisualizerLineId(lineId);
		setVisualizerFocusQuestId(focusQuestId);
		setMode("visualizer");
	};

	const showQuestVisualizerIndex = () => {
		setVisualizerLineId(null);
		setVisualizerFocusQuestId(null);
		setMode("visualizer");
	};

	return (
		<QuestWorkspaceContext.Provider
			value={{
				quests,
				questDataIndex,
				questsById,
				filteredQuests,
				traders,
				maps,
				objectiveCategories,
				statusByQuestId,
				markerByQuestId,
				branchLines,
				branchLineByQuestId,
				branchLinesByQuestId,
				selectedQuestId,
				selectedQuest: selectedQuestId ? (questsById.get(selectedQuestId) ?? null) : null,
				selectedTraderIds,
				filterByTraderRequirements,
				selectedMapKeys,
				selectedStatuses,
				lockedFilters: store.lockedFilters,
				upcomingLockedQuestIds,
				selectedObjectiveCategories,
				showHiddenQuests: store.showHiddenQuests,
				groupByTrader,
				groupByLoyaltyLevel,
				sortMode: store.sortMode,
				openFilter,
				searchQuery,
				mode,
				listMode,
				plannerMapKey,
				highlightedQuestId,
				visualizerLineId,
				visualizerFocusQuestId,
				setSelectedQuestId,
				questHref,
				indexHref,
				markInternalSelection,
				consumeInternalSelection,
				toggleTrader: (id) => {
					clearRetainedCompletedQuests();
					store.setSelectedTraderIds([...toggleSetValue(selectedTraderIds, id)]);
				},
				showOnlyTrader: (id) => {
					clearRetainedCompletedQuests();
					store.setSelectedTraderIds([id]);
					setOpenFilter(null);
				},
				clearTraders: () => {
					clearRetainedCompletedQuests();
					store.setSelectedTraderIds([]);
				},
				setFilterByTraderRequirements: (enabled) => {
					clearRetainedCompletedQuests();
					store.setFilterByTraderRequirements(enabled);
				},
				toggleMap: (key) => {
					clearRetainedCompletedQuests();
					if (mode === "planner") {
						setPlannerMapKey(plannerMapKey === key ? null : key);
						return;
					}
					store.setSelectedMapKeys([...toggleSetValue(externalSelectedMapKeys, key)]);
				},
				clearMaps: () => {
					clearRetainedCompletedQuests();
					if (mode === "planner") {
						setPlannerMapKey(null);
						return;
					}
					store.setSelectedMapKeys([]);
				},
				toggleStatus: (status) => {
					clearRetainedCompletedQuests();
					store.setSelectedStatuses([...toggleSetValue(selectedStatuses, status)]);
				},
				setLockedFilters: store.setLockedFilters,
				toggleObjectiveCategory: (category) => {
					clearRetainedCompletedQuests();
					store.setSelectedObjectiveCategories([...toggleSetValue(selectedObjectiveCategories, category)]);
				},
				clearObjectiveCategories: () => {
					clearRetainedCompletedQuests();
					store.setSelectedObjectiveCategories([]);
				},
				setShowHiddenQuests: (enabled) => {
					clearRetainedCompletedQuests();
					store.setShowHiddenQuests(enabled);
				},
				setGroupByTrader,
				setGroupByLoyaltyLevel,
				setSortMode: store.setSortMode,
				setOpenFilter,
				setSearchQuery: (query) => {
					clearRetainedCompletedQuests();
					setSearchQuery(query);
				},
				setMode,
				setListMode,
				retainQuestAfterCompletion,
				selectPlannerMap,
				clearPlannerMap: () => {
					setPlannerMapKey(null);
				},
				setHighlightedQuestId,
				openQuestVisualizer,
				showQuestVisualizerIndex,
			}}
		>
			{children}
		</QuestWorkspaceContext.Provider>
	);
}

export function useQuestWorkspace() {
	const context = useContext(QuestWorkspaceContext);
	if (!context) throw new Error("useQuestWorkspace must be used within QuestWorkspaceProvider");
	return context;
}
