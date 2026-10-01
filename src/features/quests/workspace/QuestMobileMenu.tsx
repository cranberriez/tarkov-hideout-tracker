"use client";

import {
	ChevronUp,
	CircleDot,
	Columns3,
	Compass,
	GitBranch,
	History,
	List,
	Map,
	Menu,
	SlidersHorizontal,
	UserRound,
	type LucideIcon,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useQuestWorkspace, type QuestFilterSection } from "./QuestWorkspaceContext";

type FilterSection = Exclude<QuestFilterSection, null>;
type MenuView = "log" | "history" | "board" | "visualizer" | "planner";

const VIEWS: { view: MenuView; label: string; icon: LucideIcon }[] = [
	{ view: "log", label: "Quest log", icon: List },
	{ view: "history", label: "History", icon: History },
	{ view: "board", label: "Trader board", icon: Columns3 },
	{ view: "visualizer", label: "Visualizer", icon: GitBranch },
	{ view: "planner", label: "Raid planner", icon: Compass },
];

const FILTERS: { section: FilterSection; label: string; icon: LucideIcon }[] = [
	{ section: "traders", label: "Traders", icon: UserRound },
	{ section: "maps", label: "Maps", icon: Map },
	{ section: "status", label: "Status", icon: CircleDot },
	{ section: "filters", label: "Filters and sort", icon: SlidersHorizontal },
];

/**
 * Mobile replacement for the desktop action bar and filter header: one floating pill that opens the
 * workspace views and filters. Log upload needs the desktop game's log folder, so it stays desktop-only.
 */
export function QuestMobileMenu() {
	const workspace = useQuestWorkspace();
	const { mode, listMode, openFilter, selectedQuestId, setMode, setListMode, setOpenFilter, setSelectedQuestId } =
		workspace;
	const modifiedFilters: Record<FilterSection, boolean> = {
		traders: workspace.selectedTraderIds.size > 0,
		maps: workspace.selectedMapKeys.size > 0,
		status: workspace.selectedStatuses.size !== 1 || !workspace.selectedStatuses.has("active"),
		filters:
			!workspace.filterByTraderRequirements ||
			workspace.showHiddenQuests ||
			!workspace.groupByTrader ||
			!workspace.groupByLoyaltyLevel ||
			workspace.sortMode !== "unlockOrder" ||
			workspace.selectedObjectiveCategories.size > 0,
	};
	const anyFilterModified = Object.values(modifiedFilters).some(Boolean);
	const currentFilter = mode === "details" ? FILTERS.find((filter) => filter.section === openFilter) : undefined;
	const currentViewId: MenuView = mode === "details" ? (listMode === "history" ? "history" : "log") : mode;
	const currentView = VIEWS.find((view) => view.view === currentViewId) ?? VIEWS[0];
	const currentLabel = (currentFilter ?? currentView).label;

	// On mobile the list pane only shows on the index route in Details mode.
	const showListPane = (nextListMode: "quests" | "history", filter: QuestFilterSection) => {
		setMode("details");
		setListMode(nextListMode);
		setOpenFilter(filter);
		if (selectedQuestId) setSelectedQuestId(null);
	};
	const selectView = (view: MenuView) => {
		if (view === "log") showListPane("quests", null);
		else if (view === "history") showListPane("history", null);
		else if (view === "visualizer") workspace.showQuestVisualizerIndex();
		else setMode(view);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={`Quest menu, showing ${currentLabel}${anyFilterModified ? ", filters changed" : ""}`}
					className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-40 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-highlight/15 bg-[var(--card-bg)]/95 px-4 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-md lg:hidden"
				>
					<Menu size={15} className="text-brand" />
					Menu
					{anyFilterModified && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />}
					<ChevronUp size={14} className="text-subtle-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="top"
				align="center"
				sideOffset={8}
				collisionPadding={12}
				className="w-[min(20rem,calc(100vw-1.5rem))] p-1.5 lg:hidden"
			>
				<MenuLabel>View</MenuLabel>
				{VIEWS.map((view) => (
					<MenuItem
						key={view.view}
						icon={view.icon}
						label={view.label}
						current={view === currentView && !currentFilter}
						onSelect={() => selectView(view.view)}
					/>
				))}
				<DropdownMenuSeparator />
				<MenuLabel>Filter</MenuLabel>
				{FILTERS.map((filter) => (
					<MenuItem
						key={filter.section}
						icon={filter.icon}
						label={filter.label}
						current={filter === currentFilter}
						modified={modifiedFilters[filter.section]}
						onSelect={() => showListPane("quests", filter.section)}
					/>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function MenuLabel({ children }: { children: string }) {
	return (
		<DropdownMenuLabel className="px-2 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
			{children}
		</DropdownMenuLabel>
	);
}

function MenuItem({
	icon: Icon,
	label,
	current = false,
	modified = false,
	onSelect,
}: {
	icon: LucideIcon;
	label: string;
	current?: boolean;
	modified?: boolean;
	onSelect: () => void;
}) {
	return (
		<DropdownMenuItem
			onSelect={onSelect}
			aria-current={current || undefined}
			className={cn("gap-3 py-2.5 text-sm", current && "bg-highlight/7 text-brand")}
		>
			<Icon className={current ? "text-brand" : undefined} />
			<span className="flex-1">{label}</span>
			{modified && (
				<>
					<span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
					<span className="sr-only">changed</span>
				</>
			)}
		</DropdownMenuItem>
	);
}

/** End-of-scroll clearance so the floating menu never covers the last row of a mobile pane. */
export function QuestMobileMenuSpacer() {
	return <div aria-hidden="true" className="h-20 shrink-0 lg:hidden" />;
}
