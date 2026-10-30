"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import { SearchParamListener } from "@/components/core/SearchParamListener";
import { useModeRoute } from "@/lib/useModeRoute";
import { decodeRouteParam } from "@/lib/utils/route-param";
import {
	QUEST_VIEW_PARAM,
	QUEST_VIEWS,
	questsHref,
	questHref as buildQuestHref,
	selectedQuestIdFromPath,
	type QuestView,
} from "../quest-routes";
import { useShallow } from "zustand/react/shallow";
import type { QuestWorkspaceQuest } from "@/types/quests";
import type { QuestDataIndex } from "../quest-data-index";
import { useUserStore, type QuestSortMode, type QuestWorkspaceLockedFilterSettings } from "@/lib/stores/useUserStore";
import {
	getAvailableObjectiveCategories,
	type QuestObjectiveCategory,
	type QuestWorkspaceStatus,
	type QuestWorkspaceStatusInfo,
} from "./quest-workspace-utils";
import { buildQuestBranchLines, type QuestBranchLine } from "./quest-branch-graph";
import { selectWorkspaceQuests } from "./quest-workspace-selector";
import { STORY_CHAPTERS, STORY_DECISIONS } from "@/lib/data/story";
import type { StoryEndingId } from "@/types/story";
import { useStoryProgress } from "@/features/story/useStoryProgress";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import {
	buildStoryQuestRequirements,
	buildStoryQuestFailures,
	questRequiresSelectedEnding,
} from "@/features/story/story-quest-requirements";

export const storyQuestRequirements = buildStoryQuestRequirements(STORY_CHAPTERS);
export const storyQuestFailures = buildStoryQuestFailures(STORY_CHAPTERS);

export type QuestWorkspaceMode = "details" | QuestView;
export type QuestListMode = "quests" | "history";
export type QuestFilterSection = "traders" | "maps" | "status" | "filters" | null;

interface QuestWorkspaceContextValue {
	quests: QuestWorkspaceQuest[];
	targetEnding: StoryEndingId | null;
	endingQuestIds: ReadonlySet<string>;
	questDataIndex: QuestDataIndex;
	questsById: Map<string, QuestWorkspaceQuest>;
	filteredQuests: QuestWorkspaceQuest[];
	traders: QuestWorkspaceQuest["trader"][];
	maps: QuestDataIndex["maps"];
	objectiveCategories: QuestObjectiveCategory[];
	statusByQuestId: Map<string, QuestWorkspaceStatusInfo>;
	branchLines: QuestBranchLine[];
	branchLineByQuestId: Map<string, QuestBranchLine>;
	branchLinesByQuestId: Map<string, QuestBranchLine[]>;
	selectedQuestId: string | null;
	/** The quest the routed page segment rendered on the server; may differ after in-place selection. */
	routedQuestId: string | null;
	selectedTraderIds: Set<string>;
	filterByTraderRequirements: boolean;
	selectedMapKeys: Set<string>;
	selectedStatuses: Set<QuestWorkspaceStatus>;
	lockedFilters: QuestWorkspaceLockedFilterSettings;
	upcomingLockedQuestIds: Set<string>;
	selectedObjectiveCategories: Set<QuestObjectiveCategory>;
	showHiddenQuests: boolean;
	showPinnedOnly: boolean;
	pinnedQuests: Record<string, boolean>;
	groupByTrader: boolean;
	groupByLoyaltyLevel: boolean;
	sortMode: QuestSortMode;
	openFilter: QuestFilterSection;
	searchQuery: string;
	mode: QuestWorkspaceMode;
	listMode: QuestListMode;
	highlightedQuestId: string | null;
	visualizerLineId: string | null;
	visualizerFocusQuestId: string | null;
	/** Navigates to the quest route (or the index for `null`); the route is the selection source. */
	setSelectedQuestId: (questId: string | null) => void;
	questHref: (questId: string) => string;
	indexHref: string;
	/** Marks a workspace-initiated link so the route change keeps the current visualizer mode. */
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
	setShowPinnedOnly: (enabled: boolean) => void;
	setGroupByTrader: (enabled: boolean) => void;
	setGroupByLoyaltyLevel: (enabled: boolean) => void;
	setSortMode: (mode: QuestSortMode) => void;
	setOpenFilter: (section: QuestFilterSection) => void;
	setSearchQuery: (query: string) => void;
	setMode: (mode: QuestWorkspaceMode) => void;
	setListMode: (mode: QuestListMode) => void;
	retainQuestAfterCompletion: (questId: string) => void;
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
	quests: QuestWorkspaceQuest[];
	questDataIndex: QuestDataIndex;
	devQuery?: string | null;
	children: ReactNode;
}) {
	const gameMode = useUserStore((state) => state.gameMode);
	const hydrated = useUserStoreHydrated();
	const [storyProgress] = useStoryProgress(gameMode);
	const targetEnding = hydrated ? storyProgress.targetEnding : null;
	const endingQuestIds = useMemo(
		() =>
			new Set(
				targetEnding
					? [...storyQuestRequirements]
							.filter(([, requirements]) => questRequiresSelectedEnding(requirements, storyProgress, STORY_DECISIONS))
							.map(([questId]) => questId)
					: [],
			),
		[targetEnding, storyProgress],
	);
	const [viewParam, setViewParam] = useState<string | null>(null);
	const { mode: routeMode } = useModeRoute();
	// The URL selects the quest; in-workspace selection only pushes history, so the routed
	// page segment (`routedQuestId`) can lag behind it. See QuestWorkspace's detail outlet.
	const selectedQuestId = selectedQuestIdFromPath(usePathname());
	const params = useParams<{ questId?: string }>();
	const routedQuestId = params?.questId ? decodeRouteParam(params.questId) : null;
	const internalSelection = useRef<{ questId: string | null } | null>(null);
	const [openFilter, setOpenFilter] = useState<QuestFilterSection>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [mode, setMode] = useState<QuestWorkspaceMode>("details");
	const [listMode, setListMode] = useState<QuestListMode>("quests");
	const [groupByTrader, setGroupByTrader] = useState(true);
	const [groupByLoyaltyLevel, setGroupByLoyaltyLevel] = useState(true);
	const [retainedCompletedQuestIds, setRetainedCompletedQuestIds] = useState<Set<string>>(() => new Set());
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
			pinnedQuests: state.pinnedQuests,
			showPinnedOnly: state.questShowPinnedOnly,
			setShowPinnedOnly: state.setQuestShowPinnedOnly,
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
	const selectedMapKeys = useMemo(() => new Set(store.selectedMapKeys), [store.selectedMapKeys]);
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
				pinnedQuests: store.pinnedQuests,
				showPinnedOnly: store.showPinnedOnly,
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
			store.pinnedQuests,
			store.showPinnedOnly,
		],
	);
	const { statusByQuestId, upcomingLockedQuestIds } = selection;
	const filteredQuests = useMemo(
		() => selection.filteredQuestIds.flatMap((questId) => questsById.get(questId) ?? []),
		[questsById, selection.filteredQuestIds],
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

	const questHref = useCallback(
		(questId: string) => buildQuestHref(routeMode, questId, devQuery),
		[routeMode, devQuery],
	);
	const indexHref = devQuery
		? `${questsHref(routeMode)}?q=${encodeURIComponent(devQuery)}`
		: questsHref(routeMode);
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
		// Native history (synced by Next) selects without a server render; the outlet loads details.
		window.history.pushState(null, "", questId ? questHref(questId) : indexHref);
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

	// Nav links open a panel via `?view=`; mode stays session state, so the parameter is applied once and removed.
	// Direct quest visits must render the selected details on the server, even
	// when a browser-only board/visualizer view is requested in the URL.
	const requestedView = hydrated ? viewParam : null;
	const [appliedView, setAppliedView] = useState<string | null>(null);
	if (requestedView !== appliedView) {
		setAppliedView(requestedView);
		const view = QUEST_VIEWS.find((candidate) => candidate === requestedView);
		if (view === "visualizer") {
			setVisualizerLineId(null);
			setVisualizerFocusQuestId(null);
		}
		if (view) setMode(view);
	}
	useEffect(() => {
		if (requestedView === null) return;
		// Native replaceState avoids a server round trip that could land after a later navigation. Next patches it
		// to sync the router in its root effect, which runs after this one on a full page load, so defer a task.
		const timeout = window.setTimeout(() => {
			const url = new URL(window.location.href);
			url.searchParams.delete(QUEST_VIEW_PARAM);
			window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
		});
		return () => window.clearTimeout(timeout);
	}, [requestedView]);

	return (
		<QuestWorkspaceContext.Provider
			value={{
				targetEnding,
				endingQuestIds,
				quests,
				questDataIndex,
				questsById,
				filteredQuests,
				traders,
				maps,
				objectiveCategories,
				statusByQuestId,
				branchLines,
				branchLineByQuestId,
				branchLinesByQuestId,
				selectedQuestId,
				routedQuestId,
				selectedTraderIds,
				filterByTraderRequirements,
				selectedMapKeys,
				selectedStatuses,
				lockedFilters: store.lockedFilters,
				upcomingLockedQuestIds,
				selectedObjectiveCategories,
				showHiddenQuests: store.showHiddenQuests,
				pinnedQuests: store.pinnedQuests,
				showPinnedOnly: store.showPinnedOnly,
				groupByTrader,
				groupByLoyaltyLevel,
				sortMode: store.sortMode,
				openFilter,
				searchQuery,
				mode,
				listMode,
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
					store.setSelectedMapKeys([...toggleSetValue(selectedMapKeys, key)]);
				},
				clearMaps: () => {
					clearRetainedCompletedQuests();
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
				setShowPinnedOnly: (enabled) => {
					store.setShowPinnedOnly(enabled);
					setListMode("quests");
					setOpenFilter(null);
				},
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
				setHighlightedQuestId,
				openQuestVisualizer,
				showQuestVisualizerIndex,
			}}
		>
			{/* `?view=` is read in its own boundary so quest routes keep their prerendered content. */}
			<Suspense fallback={null}>
				<SearchParamListener name={QUEST_VIEW_PARAM} onChange={setViewParam} />
			</Suspense>
			{children}
		</QuestWorkspaceContext.Provider>
	);
}

export function useQuestWorkspace() {
	const context = useContext(QuestWorkspaceContext);
	if (!context) throw new Error("useQuestWorkspace must be used within QuestWorkspaceProvider");
	return context;
}
