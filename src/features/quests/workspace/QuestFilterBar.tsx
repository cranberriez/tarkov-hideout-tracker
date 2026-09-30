"use client";

import { Check, CircleDot, Compass, Map, Search, Settings, SlidersHorizontal, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterGroupTitle, FilterOptionRow, FilterSwitchRow } from "@/components/ui/filter-bar";
import { useUserStore } from "@/lib/stores/useUserStore";
import { GAME_MODE_CONFIG } from "@/lib/game-mode";
import { hasLoyaltyControl, orderTraders, TraderLoyaltyControl } from "@/components/entities/trader-loyalty";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { useQuestWorkspace, type QuestFilterSection } from "./QuestWorkspaceContext";
import { getQuestObjectiveCategories, OBJECTIVE_CATEGORY_LABELS, STATUS_OPTIONS } from "./quest-workspace-utils";

function FilterTrigger({
	section,
	label,
	summary,
}: {
	section: Exclude<QuestFilterSection, null>;
	label: string;
	summary: React.ReactNode;
}) {
	const { openFilter, setOpenFilter } = useQuestWorkspace();
	const open = openFilter === section;
	return (
		<div className="min-w-0 flex-1">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpenFilter(open ? null : section)}
				className={cn(
					"flex h-14 w-full min-w-0 cursor-pointer items-center gap-2 px-3 text-left transition-colors hover:bg-highlight/5",
					open && "bg-highlight/7 text-foreground",
				)}
			>
				<span className="min-w-0 flex-1">
					<span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
						{label}
					</span>
					<span className="block truncate text-xs font-medium text-foreground">{summary}</span>
				</span>
			</button>
		</div>
	);
}

function AnyRow({ active, onClick, count }: { active: boolean; onClick: () => void; count: number }) {
	return (
		<FilterOptionRow
			selected={active}
			onClick={onClick}
			label="Any"
			count={count}
			description="Do not limit this filter"
		/>
	);
}

export function QuestFilterBar() {
	const { maps, selectedMapKeys, selectedStatuses, selectedObjectiveCategories, groupByTrader, groupByLoyaltyLevel } =
		useQuestWorkspace();
	const selectedMapNames = maps.filter((map) => selectedMapKeys.has(map.key)).map((map) => map.name);
	const statusSummary = STATUS_OPTIONS.filter((option) => selectedStatuses.has(option.id)).map(
		(option) => option.label,
	);

	return (
		<div className="hidden divide-x divide-highlight/8 border-b border-highlight/10 bg-[var(--card-bg)] lg:flex">
			<FilterTrigger
				section="maps"
				label="Map"
				summary={
					selectedMapNames.length === 0
						? "Any map"
						: selectedMapNames.length === 1
							? selectedMapNames[0]
							: `${selectedMapNames.length} selected`
				}
			/>
			<FilterTrigger
				section="status"
				label="Status"
				summary={
					statusSummary.length === STATUS_OPTIONS.length
						? "All states"
						: statusSummary.length
							? statusSummary.join(", ")
							: "None"
				}
			/>
			<FilterTrigger
				section="filters"
				label="Filter / sort"
				summary={
					groupByTrader && groupByLoyaltyLevel
						? "Trader + loyalty level"
						: selectedObjectiveCategories.size > 0
							? `${selectedObjectiveCategories.size} quest types`
							: "Customise view"
				}
			/>
		</div>
	);
}

function CompactNavButton({
	label,
	active = false,
	modified = false,
	onClick,
	children,
}: {
	label: string;
	active?: boolean;
	modified?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={active}
			title={label}
			onClick={onClick}
			className={cn(
				"relative flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center text-subtle-foreground transition-colors hover:bg-highlight/7 hover:text-foreground focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
				active && "bg-highlight/7 text-brand",
			)}
		>
			{children}
			{modified && (
				<span
					aria-hidden="true"
					className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-warning shadow-[0_0_5px_color-mix(in_oklab,_var(--warning)_55%,_transparent)]"
				/>
			)}
		</button>
	);
}

export function QuestMobileToolbar({
	compactSearchOpen,
	onToggleCompactSearch,
}: {
	compactSearchOpen: boolean;
	onToggleCompactSearch: () => void;
}) {
	const {
		selectedTraderIds,
		selectedMapKeys,
		selectedStatuses,
		selectedObjectiveCategories,
		filterByTraderRequirements,
		showHiddenQuests,
		groupByTrader,
		groupByLoyaltyLevel,
		sortMode,
		openFilter,
		setOpenFilter,
		setMode,
	} = useQuestWorkspace();
	const traderModified = selectedTraderIds.size > 0;
	const mapModified = selectedMapKeys.size > 0;
	const statusModified = selectedStatuses.size !== 1 || !selectedStatuses.has("active");
	const filtersModified =
		!filterByTraderRequirements ||
		showHiddenQuests ||
		!groupByTrader ||
		!groupByLoyaltyLevel ||
		sortMode !== "unlockOrder" ||
		selectedObjectiveCategories.size > 0;
	const openSection = (section: Exclude<QuestFilterSection, null>) => {
		if (compactSearchOpen) onToggleCompactSearch();
		setOpenFilter(openFilter === section ? null : section);
	};

	return (
		<nav
			aria-label="Quest tools"
			className="flex h-12 w-full shrink-0 items-stretch divide-x divide-highlight/8 border-t border-highlight/10 bg-[var(--card-bg)] lg:hidden"
		>
			<CompactNavButton
				label="Trader filters and loyalty levels"
				active={openFilter === "traders"}
				modified={traderModified}
				onClick={() => openSection("traders")}
			>
				<UserRound className="h-[42%] w-[42%]" aria-hidden="true" />
			</CompactNavButton>
			<CompactNavButton
				label="Map filters"
				active={openFilter === "maps"}
				modified={mapModified}
				onClick={() => openSection("maps")}
			>
				<Map className="h-[42%] w-[42%]" aria-hidden="true" />
			</CompactNavButton>
			<CompactNavButton
				label="Quest status filters"
				active={openFilter === "status"}
				modified={statusModified}
				onClick={() => openSection("status")}
			>
				<CircleDot className="h-[42%] w-[42%]" aria-hidden="true" />
			</CompactNavButton>
			<CompactNavButton
				label="Quest filters and sorting"
				active={openFilter === "filters"}
				modified={filtersModified}
				onClick={() => openSection("filters")}
			>
				<SlidersHorizontal className="h-[42%] w-[42%]" aria-hidden="true" />
			</CompactNavButton>
			<CompactNavButton label="Search quests" active={compactSearchOpen} onClick={onToggleCompactSearch}>
				<Search className="h-[42%] w-[42%]" aria-hidden="true" />
			</CompactNavButton>
			<CompactNavButton label="Open raid planner" onClick={() => setMode("planner")}>
				<Compass className="h-[42%] w-[42%]" aria-hidden="true" />
			</CompactNavButton>
		</nav>
	);
}

export function QuestCompactSearchBar({ onClose }: { onClose: () => void }) {
	const { searchQuery, setSearchQuery, setOpenFilter } = useQuestWorkspace();

	return (
		<div className="flex h-11 w-full shrink-0 items-center gap-3 border-t border-highlight/10 bg-[var(--card-bg)] px-3 lg:hidden">
			<Search size={16} className="shrink-0 text-subtle-foreground" />
			<input
				autoFocus
				value={searchQuery}
				onChange={(event) => setSearchQuery(event.target.value)}
				onFocus={() => setOpenFilter(null)}
				placeholder="Search quests, traders, objectives…"
				className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
			/>
			<button
				type="button"
				aria-label="Close quest search"
				onClick={() => {
					onClose();
					setSearchQuery("");
				}}
				className="flex h-8 w-8 items-center justify-center text-subtle-foreground transition-colors hover:text-foreground"
			>
				<X size={16} />
			</button>
		</div>
	);
}

export function QuestTraderBar() {
	const { traders, selectedTraderIds, clearTraders, showOnlyTrader, openFilter, setOpenFilter } = useQuestWorkspace();
	const orderedTraders = orderTraders(traders);
	const allSelected = selectedTraderIds.size === 0;

	const buttonClass = (selected: boolean) =>
		cn(
			"relative flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center overflow-hidden border-r border-highlight/8 bg-[var(--card-bg)] text-subtle-foreground transition-colors hover:bg-highlight/7 hover:text-foreground focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand lg:h-auto lg:aspect-square",
			selected && "z-[1] bg-brand/10 text-brand shadow-[inset_0_-2px_0_var(--brand)]",
		);

	return (
		<div className="hidden w-full shrink-0 border-b border-highlight/8 bg-[var(--card-bg)] lg:flex">
			<button
				type="button"
				aria-label="Show quests from all traders"
				aria-pressed={allSelected}
				title="All traders"
				onClick={() => {
					clearTraders();
					setOpenFilter(null);
				}}
				className={buttonClass(allSelected)}
			>
				<span className="text-[10px] font-semibold uppercase tracking-[0.08em]">All</span>
			</button>
			{orderedTraders.map((trader) => {
				const selected = selectedTraderIds.has(trader.id);
				const traderImage = trader.image4xLink ?? trader.imageLink;
				return (
					<button
						key={trader.id}
						type="button"
						aria-label={`Show ${trader.name} quests`}
						aria-pressed={selected}
						title={trader.name}
						onClick={() => showOnlyTrader(trader.id)}
						className={buttonClass(selected)}
					>
						{traderImage ? (
							<img
								src={traderImage}
								alt=""
								className={cn(
									"h-full w-full object-cover grayscale-[20%] transition-[filter,opacity]",
									selected ? "opacity-100 grayscale-0" : "opacity-65 hover:opacity-100",
								)}
							/>
						) : (
							<CircleDot className="h-[38%] w-[38%]" aria-hidden="true" />
						)}
						<span
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute inset-0.5 z-1 ring-1 ring-inset ring-transparent transition-shadow",
								selected && "ring-2 ring-brand",
							)}
						/>
					</button>
				);
			})}
			<button
				type="button"
				aria-label="Adjust trader filters and loyalty levels"
				aria-expanded={openFilter === "traders"}
				title="Trader settings"
				onClick={() => setOpenFilter(openFilter === "traders" ? null : "traders")}
				className={buttonClass(openFilter === "traders")}
			>
				<Settings className="h-[42%] w-[42%]" aria-hidden="true" />
			</button>
		</div>
	);
}

function TraderSelectionRow({
	trader,
	selected,
	count,
	onSelect,
}: {
	trader: ReturnType<typeof useQuestWorkspace>["traders"][number];
	selected: boolean;
	count: number;
	onSelect: () => void;
}) {
	const traderImage = trader.image4xLink ?? trader.imageLink;

	return (
		<div className={cn("flex min-h-14 border-b border-highlight/8", selected && "bg-brand/8")}>
			<button
				type="button"
				aria-pressed={selected}
				onClick={onSelect}
				className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-highlight/5"
			>
				{traderImage ? (
					<img src={traderImage} alt="" className="h-8 w-8 rounded-full object-cover grayscale-[20%]" />
				) : (
					<span className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight/5 text-subtle-foreground">
						<CircleDot size={14} />
					</span>
				)}
				<span className="min-w-0 flex-1 truncate text-sm text-foreground">{trader.name}</span>
				<span className="font-mono text-xs text-subtle-foreground">{count}</span>
				<span
					className={cn(
						"flex h-4 w-4 items-center justify-center border",
						selected ? "border-brand bg-brand text-inverse" : "border-highlight/15",
					)}
				>
					{selected && <Check size={11} strokeWidth={3} />}
				</span>
			</button>
			{hasLoyaltyControl(trader) && (
				<TraderLoyaltyControl trader={trader} className="border-l border-highlight/8 px-2" />
			)}
		</div>
	);
}

export function QuestFilterSelectionPane({ section }: { section: Exclude<QuestFilterSection, null> }) {
	const {
		quests,
		traders,
		maps,
		objectiveCategories,
		selectedTraderIds,
		filterByTraderRequirements,
		selectedMapKeys,
		selectedStatuses,
		lockedFilters,
		selectedObjectiveCategories,
		toggleTrader,
		clearTraders,
		setFilterByTraderRequirements,
		toggleMap,
		clearMaps,
		toggleStatus,
		setLockedFilters,
		toggleObjectiveCategory,
		clearObjectiveCategories,
		statusByQuestId,
		setOpenFilter,
		groupByTrader,
		groupByLoyaltyLevel,
		sortMode,
		showHiddenQuests,
		setGroupByTrader,
		setGroupByLoyaltyLevel,
		setSortMode,
		setShowHiddenQuests,
	} = useQuestWorkspace();
	const gameMode = useUserStore((state) => state.gameMode);
	const titles = {
		traders: "Select traders",
		maps: "Select maps",
		status: "Select quest status",
		filters: "Filter / sort",
	};
	const orderedTraders = orderTraders(traders);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)]">
			<div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-highlight/10 bg-[var(--card-bg)] px-3">
				<span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
					{titles[section]}
				</span>
				<button
					type="button"
					onClick={() => setOpenFilter(null)}
					className="flex h-7 cursor-pointer items-center gap-1.5 px-2 text-xs text-subtle-foreground transition-colors hover:bg-highlight/5 hover:text-foreground"
				>
					<X size={13} /> Done
				</button>
			</div>
			<div>
				{section === "traders" && (
					<>
						<AnyRow active={selectedTraderIds.size === 0} onClick={clearTraders} count={quests.length} />
						{orderedTraders.map((trader) => (
							<TraderSelectionRow
								key={trader.id}
								trader={trader}
								selected={selectedTraderIds.has(trader.id)}
								onSelect={() => toggleTrader(trader.id)}
								count={quests.filter((quest) => quest.trader.id === trader.id).length}
							/>
						))}
						{!GAME_MODE_CONFIG[gameMode].hasLightkeeper && (
							<p className="border-b border-warning/10 bg-warning/[0.035] px-3 py-2.5 text-[10px] leading-relaxed text-warning/55">
								Lightkeeper is inaccessible in the {GAME_MODE_CONFIG[gameMode].label} profile.
							</p>
						)}
					</>
				)}
				{section === "maps" && (
					<>
						<AnyRow active={selectedMapKeys.size === 0} onClick={clearMaps} count={quests.length} />
						{maps.map((map) => (
							<FilterOptionRow
								key={map.key}
								selected={selectedMapKeys.has(map.key)}
								onClick={() => toggleMap(map.key)}
								label={map.name}
								count={
									quests.filter((quest) => getQuestMapGroupsForQuest(quest).some((group) => group.key === map.key))
										.length
								}
							/>
						))}
					</>
				)}
				{section === "status" && (
					<>
						{STATUS_OPTIONS.map((option) => (
							<FilterOptionRow
								key={option.id}
								selected={selectedStatuses.has(option.id)}
								onClick={() => toggleStatus(option.id)}
								label={option.label}
								description={option.description}
								count={quests.filter((quest) => statusByQuestId.get(quest.id)?.status === option.id).length}
							/>
						))}
						{selectedStatuses.has("locked") && (
							<>
								<FilterGroupTitle>Locked reasons</FilterGroupTitle>
								<FilterSwitchRow
									checked={lockedFilters.showAll}
									onCheckedChange={(checked) => setLockedFilters({ showAll: checked })}
									label="Show ALL Locked Tasks"
									description="Override the reason filters and include every locked quest"
									emphasized
								/>
								<fieldset
									className={cn("transition-opacity", lockedFilters.showAll && "opacity-35")}
									disabled={lockedFilters.showAll}
								>
									<FilterSwitchRow
										checked={lockedFilters.showPlayerLevel}
										onCheckedChange={(checked) => setLockedFilters({ showPlayerLevel: checked })}
										label="Player level"
										description="Show quests locked by your PMC level"
									/>
									{lockedFilters.showPlayerLevel && (
										<UpcomingRuleRow
											checked={lockedFilters.playerLevelUpcomingOnly}
											onChange={(checked) => setLockedFilters({ playerLevelUpcomingOnly: checked })}
											description="Only show quests within this many levels"
											value={lockedFilters.playerLevelLookahead}
											min={0}
											onValueChange={(value) => setLockedFilters({ playerLevelLookahead: value })}
										/>
									)}
									<FilterSwitchRow
										checked={lockedFilters.showTaskCount}
										onCheckedChange={(checked) => setLockedFilters({ showTaskCount: checked })}
										label="Number of completed quests"
										description="Show quests locked by trader task-count milestones"
									/>
									{lockedFilters.showTaskCount && (
										<UpcomingRuleRow
											checked={lockedFilters.taskCountUpcomingOnly}
											onChange={(checked) => setLockedFilters({ taskCountUpcomingOnly: checked })}
											description="Only show the next incomplete milestone (for example 1, then 3, then 5)"
										/>
									)}
									<FilterSwitchRow
										checked={lockedFilters.showPrerequisite}
										onCheckedChange={(checked) => setLockedFilters({ showPrerequisite: checked })}
										label="Previous quest incomplete"
										description="Show quests with unfinished prerequisite quests"
									/>
									{lockedFilters.showPrerequisite && (
										<UpcomingRuleRow
											checked={lockedFilters.prerequisiteUpcomingOnly}
											onChange={(checked) => setLockedFilters({ prerequisiteUpcomingOnly: checked })}
											description="Only show quests within this many missing prerequisites"
											value={lockedFilters.prerequisiteLookahead}
											min={1}
											onValueChange={(value) => setLockedFilters({ prerequisiteLookahead: value })}
										/>
									)}
									<FilterSwitchRow
										checked={lockedFilters.showFaction}
										onCheckedChange={(checked) => setLockedFilters({ showFaction: checked })}
										label="Incorrect faction"
										description="Show quests restricted to the other faction"
									/>
								</fieldset>
								<div className="mt-2 border-t border-highlight/8 px-3 py-2 text-[10px] leading-relaxed text-subtle-foreground">
									A locked quest must pass every applicable reason filter. Other gates, such as loyalty, reputation,
									prestige, and branches, remain visible.
								</div>
							</>
						)}
					</>
				)}
				{section === "filters" && (
					<>
						<FilterGroupTitle>Visibility</FilterGroupTitle>
						<FilterSwitchRow
							checked={showHiddenQuests}
							onCheckedChange={setShowHiddenQuests}
							label="Show hidden quests"
							description="Include quests you have chosen to hide"
						/>

						<FilterGroupTitle>Requirements</FilterGroupTitle>
						<FilterSwitchRow
							checked={filterByTraderRequirements}
							onCheckedChange={setFilterByTraderRequirements}
							label="Filter quests by reputation requirement"
							description="Use your trader loyalty levels and Fence reputation"
						/>

						<FilterGroupTitle>Grouping</FilterGroupTitle>
						<FilterSwitchRow
							checked={groupByTrader}
							onCheckedChange={setGroupByTrader}
							label="Group by trader"
							description="Separate quests by their issuing trader"
						/>
						<FilterSwitchRow
							checked={groupByLoyaltyLevel}
							onCheckedChange={setGroupByLoyaltyLevel}
							label="Group by loyalty level"
							description="Separate quests by the issuing trader's required LL"
						/>

						<FilterGroupTitle>Sort</FilterGroupTitle>
						{SORT_OPTIONS.map((option) => (
							<FilterOptionRow
								key={option.id}
								selected={sortMode === option.id}
								onClick={() => setSortMode(option.id)}
								label={option.label}
								description={option.description}
							/>
						))}

						<FilterGroupTitle>Quest types</FilterGroupTitle>
						<AnyRow
							active={selectedObjectiveCategories.size === 0}
							onClick={clearObjectiveCategories}
							count={quests.length}
						/>
						{objectiveCategories.map((category) => (
							<FilterOptionRow
								key={category}
								selected={selectedObjectiveCategories.has(category)}
								onClick={() => toggleObjectiveCategory(category)}
								label={OBJECTIVE_CATEGORY_LABELS[category]}
								count={quests.filter((quest) => getQuestObjectiveCategories(quest).has(category)).length}
							/>
						))}
					</>
				)}
			</div>
		</div>
	);
}

const SORT_OPTIONS = [
	{
		id: "unlockOrder",
		label: "Unlock order",
		description: "Player level, then task-count milestone, while keeping quest chains together",
	},
	{ id: "default", label: "Quest chain", description: "Keep prerequisite quests together" },
	{ id: "level", label: "Player level", description: "Lowest required level first" },
	{ id: "xp", label: "Experience", description: "Highest XP reward first" },
	{ id: "unlockImpact", label: "Unlock impact", description: "Quests that unlock the most follow-ups first" },
] as const;

function UpcomingRuleRow({
	checked,
	onChange,
	description,
	value,
	min = 0,
	onValueChange,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	description: string;
	value?: number;
	min?: number;
	onValueChange?: (value: number) => void;
}) {
	return (
		<div className="flex items-center gap-3 border-b border-highlight/5 bg-shadow/15 py-2 pl-7 pr-3">
			<label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
				<input
					type="checkbox"
					checked={checked}
					onChange={(event) => onChange(event.target.checked)}
					className="h-3.5 w-3.5 accent-[var(--brand)]"
				/>
				<span className="min-w-0">
					<span className="block text-xs text-foreground">Show upcoming only</span>
					<span className="block text-[10px] leading-relaxed text-subtle-foreground">{description}</span>
				</span>
			</label>
			{value !== undefined && onValueChange && (
				<input
					type="number"
					min={min}
					step={1}
					aria-label="Upcoming range"
					value={value}
					disabled={!checked}
					onChange={(event) => {
						const next = Number(event.target.value);
						if (Number.isFinite(next)) onValueChange(Math.max(min, Math.floor(next)));
					}}
					className="h-8 w-14 border border-highlight/10 bg-shadow/25 px-2 text-center font-mono text-xs text-foreground outline-none transition-colors focus:border-brand/50 disabled:cursor-not-allowed disabled:opacity-35"
				/>
			)}
		</div>
	);
}
