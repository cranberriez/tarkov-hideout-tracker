"use client";

import {
    Check,
    CircleDot,
    Compass,
    Crown,
    Map,
    Search,
    Settings,
    SlidersHorizontal,
    UserRound,
    X,
} from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
    type QuestTraderLoyaltyLevel,
} from "@/lib/utils/quest-trader-gates";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { useQuestWorkspace, type QuestFilterSection } from "./QuestWorkspaceContext";
import {
    getQuestObjectiveCategories,
    OBJECTIVE_CATEGORY_LABELS,
    STATUS_OPTIONS,
} from "./quest-workspace-utils";

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
                    "flex h-14 w-full min-w-0 cursor-pointer items-center gap-2 px-3 text-left transition-colors hover:bg-white/5",
                    open && "bg-white/7 text-white",
                )}
            >
                <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-600">{label}</span>
                    <span className="block truncate text-xs font-medium text-gray-200">{summary}</span>
                </span>
            </button>
        </div>
    );
}

function MenuRow({ selected, onClick, image, label, count, description }: {
    selected: boolean;
    onClick: () => void;
    image?: string | null;
    label: string;
    count?: number;
    description?: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
                "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5",
                selected && "bg-tarkov-green/8",
            )}
        >
            {image ? (
                <img src={image} alt="" className="h-8 w-8 rounded-full object-cover grayscale-[20%]" />
            ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-500"><CircleDot size={14} /></span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-200">{label}</span>
                {description && <span className="block text-[10px] text-gray-600">{description}</span>}
            </span>
            {count !== undefined && <span className="font-mono text-xs text-gray-600">{count}</span>}
            <span className={cn("flex h-4 w-4 items-center justify-center border", selected ? "border-tarkov-green bg-tarkov-green text-black" : "border-white/15")}>
                {selected && <Check size={11} strokeWidth={3} />}
            </span>
        </button>
    );
}

function AnyRow({ active, onClick, count }: { active: boolean; onClick: () => void; count: number }) {
    return <MenuRow selected={active} onClick={onClick} label="Any" count={count} description="Do not limit this filter" />;
}

export function QuestFilterBar() {
    const {
        maps,
        selectedMapKeys,
        selectedStatuses,
        selectedObjectiveCategories,
        groupByTrader,
        groupByLoyaltyLevel,
    } = useQuestWorkspace();
    const selectedMapNames = maps.filter((map) => selectedMapKeys.has(map.key)).map((map) => map.name);
    const statusSummary = STATUS_OPTIONS.filter((option) => selectedStatuses.has(option.id)).map((option) => option.label);

    return (
        <div className="hidden divide-x divide-white/8 border-b border-white/10 bg-[#101113] lg:flex">
            <FilterTrigger section="maps" label="Map" summary={selectedMapNames.length === 0 ? "Any map" : selectedMapNames.length === 1 ? selectedMapNames[0] : `${selectedMapNames.length} selected`} />
            <FilterTrigger section="status" label="Status" summary={statusSummary.length === STATUS_OPTIONS.length ? "All states" : statusSummary.length ? statusSummary.join(", ") : "None"} />
            <FilterTrigger
                section="filters"
                label="Filter / sort"
                summary={groupByTrader && groupByLoyaltyLevel
                    ? "Trader + loyalty level"
                    : selectedObjectiveCategories.size > 0
                      ? `${selectedObjectiveCategories.size} quest types`
                      : "Customise view"}
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
                "relative flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center text-gray-500 transition-colors hover:bg-white/7 hover:text-white focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-tarkov-green",
                active && "bg-white/7 text-tarkov-green",
            )}
        >
            {children}
            {modified && (
                <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_5px_rgba(252,211,77,0.55)]"
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
            className="flex h-12 w-full shrink-0 items-stretch divide-x divide-white/8 border-t border-white/10 bg-[#101113] lg:hidden"
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
            <CompactNavButton
                label="Search quests"
                active={compactSearchOpen}
                onClick={onToggleCompactSearch}
            >
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
        <div className="flex h-11 w-full shrink-0 items-center gap-3 border-t border-white/10 bg-[#101113] px-3 lg:hidden">
            <Search size={16} className="shrink-0 text-gray-500" />
            <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setOpenFilter(null)}
                placeholder="Search quests, traders, objectives…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-700"
            />
            <button
                type="button"
                aria-label="Close quest search"
                onClick={() => {
                    onClose();
                    setSearchQuery("");
                }}
                className="flex h-8 w-8 items-center justify-center text-gray-500 transition-colors hover:text-white"
            >
                <X size={16} />
            </button>
        </div>
    );
}

const LOYALTY_LEVELS: QuestTraderLoyaltyLevel[] = [1, 2, 3, 4];
const FENCE_LOYALTY_LEVELS: QuestTraderLoyaltyLevel[] = [1, 4];
const TRADER_ORDER = [
    "prapor",
    "therapist",
    "fence",
    "skier",
    "peacekeeper",
    "mechanic",
    "ragman",
    "jaeger",
    "ref",
    "btr-driver",
    "lightkeeper",
] as const;

function orderTraders(traders: ReturnType<typeof useQuestWorkspace>["traders"]) {
    return [...traders].sort((left, right) => {
        const leftRank = TRADER_ORDER.indexOf(normalizedTraderKey(left) as typeof TRADER_ORDER[number]);
        const rightRank = TRADER_ORDER.indexOf(normalizedTraderKey(right) as typeof TRADER_ORDER[number]);
        return (leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank) -
            (rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank) ||
            left.name.localeCompare(right.name);
    });
}

export function QuestTraderBar() {
    const {
        traders,
        selectedTraderIds,
        clearTraders,
        showOnlyTrader,
        openFilter,
        setOpenFilter,
    } = useQuestWorkspace();
    const orderedTraders = orderTraders(traders);
    const allSelected = selectedTraderIds.size === 0;

    const buttonClass = (selected: boolean) => cn(
        "relative flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center overflow-hidden border-r border-white/8 bg-[#101113] text-gray-500 transition-colors hover:bg-white/7 hover:text-white focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-tarkov-green lg:h-auto lg:aspect-square",
        selected && "z-[1] bg-tarkov-green/10 text-tarkov-green shadow-[inset_0_-2px_0_#9cae7c]",
    );

    return (
        <div className="hidden w-full shrink-0 border-b border-white/10 bg-[#101113] lg:flex">
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
                                "pointer-events-none absolute inset-0.5 z-[1] ring-1 ring-inset ring-white/15 transition-[box-shadow]",
                                selected && "ring-2 ring-tarkov-green",
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

function LoyaltyLevelMark({ level }: { level: QuestTraderLoyaltyLevel }) {
    return level === 4
        ? <Crown size={14} aria-label="Level 4" />
        : <span className="font-serif text-sm font-bold" aria-label={`Level ${level}`}>{["", "I", "II", "III"][level]}</span>;
}

function normalizedTraderKey(trader: { name: string; normalizedName: string }) {
    return (trader.normalizedName || trader.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
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
    const {
        questTraderLoyaltyLevels,
        questFenceReputation,
        setQuestTraderLoyaltyLevel,
        setQuestFenceReputation,
    } = useUserStore(
        useShallow((state) => ({
            questTraderLoyaltyLevels: state.questTraderLoyaltyLevels,
            questFenceReputation: state.questFenceReputation,
            setQuestTraderLoyaltyLevel: state.setQuestTraderLoyaltyLevel,
            setQuestFenceReputation: state.setQuestFenceReputation,
        })),
    );
    const traderKey = normalizedTraderKey(trader);
    const isFence = traderKey === "fence";
    const hasLoyaltyControl = traderKey !== "btr-driver" && traderKey !== "lightkeeper";
    const loyaltyLevels = isFence ? FENCE_LOYALTY_LEVELS : LOYALTY_LEVELS;
    const currentLoyaltyLevel = questTraderLoyaltyLevels[trader.id] ?? 1;
    const traderImage = trader.image4xLink ?? trader.imageLink;
    const [fenceReputationInput, setFenceReputationInput] = useState(
        String(questFenceReputation),
    );

    return (
        <div className={cn("flex min-h-14 border-b border-white/8", selected && "bg-tarkov-green/8")}>
            <button
                type="button"
                aria-pressed={selected}
                onClick={onSelect}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
            >
                {traderImage ? (
                    <img src={traderImage} alt="" className="h-8 w-8 rounded-full object-cover grayscale-[20%]" />
                ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-500"><CircleDot size={14} /></span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-gray-200">{trader.name}</span>
                <span className="font-mono text-xs text-gray-600">{count}</span>
                <span className={cn("flex h-4 w-4 items-center justify-center border", selected ? "border-tarkov-green bg-tarkov-green text-black" : "border-white/15")}>
                    {selected && <Check size={11} strokeWidth={3} />}
                </span>
            </button>
            {hasLoyaltyControl && (
                <div className="flex shrink-0 items-center gap-1 border-l border-white/8 px-2">
                    {loyaltyLevels.map((level) => (
                        <button
                            key={level}
                            type="button"
                            aria-pressed={currentLoyaltyLevel === level}
                            aria-label={`${trader.name} loyalty level ${level}`}
                            onClick={() => setQuestTraderLoyaltyLevel(trader.id, level)}
                            className={cn(
                                "flex h-8 w-8 cursor-pointer items-center justify-center border transition-colors hover:border-tarkov-green/40 hover:text-white",
                                currentLoyaltyLevel === level
                                    ? "border-tarkov-green/50 bg-tarkov-green/12 text-tarkov-green"
                                    : "border-white/10 bg-black/20 text-gray-500",
                            )}
                        >
                            <LoyaltyLevelMark level={level} />
                        </button>
                    ))}
                    {isFence && (
                        <label className="ml-1 w-16 max-w-16 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-gray-600">
                            Rep
                            <input
                                type="number"
                                step="0.01"
                                aria-label="Fence exact reputation"
                                value={fenceReputationInput}
                                onChange={(event) => {
                                    setFenceReputationInput(event.target.value);
                                    const value = Number(event.target.value);
                                    if (event.target.value !== "" && Number.isFinite(value)) {
                                        setQuestFenceReputation(value);
                                    }
                                }}
                                onBlur={() => {
                                    if (fenceReputationInput !== "") return;
                                    setFenceReputationInput("0");
                                    setQuestFenceReputation(0);
                                }}
                                className="h-8 w-full border border-white/10 bg-black/25 px-2 font-mono text-xs text-gray-200 outline-none transition-colors focus:border-tarkov-green/50"
                            />
                        </label>
                    )}
                </div>
            )}
        </div>
    );
}

export function QuestFilterSelectionPane({ section }: { section: Exclude<QuestFilterSection, null> }) {
    const {
        quests, traders, maps, objectiveCategories, selectedTraderIds,
        filterByTraderRequirements, selectedMapKeys, selectedStatuses,
        lockedFilters,
        selectedObjectiveCategories, toggleTrader, clearTraders,
        setFilterByTraderRequirements, toggleMap, clearMaps, toggleStatus, setLockedFilters, toggleObjectiveCategory,
        clearObjectiveCategories, statusByQuestId, setOpenFilter,
        groupByTrader, groupByLoyaltyLevel, sortMode, showHiddenQuests,
        setGroupByTrader, setGroupByLoyaltyLevel, setSortMode,
        setShowHiddenQuests,
    } = useQuestWorkspace();
    const gameMode = useUserStore((state) => state.gameMode);
    const titles = { traders: "Select traders", maps: "Select maps", status: "Select quest status", filters: "Filter / sort" };
    const orderedTraders = orderTraders(traders);

    return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b0c0e]">
            <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-white/10 bg-[#101113] px-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{titles[section]}</span>
                <button type="button" onClick={() => setOpenFilter(null)} className="flex h-7 cursor-pointer items-center gap-1.5 px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"><X size={13} /> Done</button>
            </div>
            <div>
                {section === "traders" && <>
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
                    {gameMode === "KORD" && (
                        <p className="border-b border-amber-300/10 bg-amber-300/[0.035] px-3 py-2.5 text-[10px] leading-relaxed text-amber-200/55">
                            Lightkeeper is inaccessible in the KORD seasonal profile.
                        </p>
                    )}
                </>}
                {section === "maps" && <><AnyRow active={selectedMapKeys.size === 0} onClick={clearMaps} count={quests.length} />{maps.map((map) => <MenuRow key={map.key} selected={selectedMapKeys.has(map.key)} onClick={() => toggleMap(map.key)} label={map.name} count={quests.filter((quest) => getQuestMapGroupsForQuest(quest).some((group) => group.key === map.key)).length} />)}</>}
                {section === "status" && <>
                    {STATUS_OPTIONS.map((option) => <MenuRow key={option.id} selected={selectedStatuses.has(option.id)} onClick={() => toggleStatus(option.id)} label={option.label} description={option.description} count={quests.filter((quest) => statusByQuestId.get(quest.id)?.status === option.id).length} />)}
                    {selectedStatuses.has("locked") && <>
                        <FilterSectionTitle>Locked reasons</FilterSectionTitle>
                        <ToggleRow
                            checked={lockedFilters.showAll}
                            onChange={(checked) => setLockedFilters({ showAll: checked })}
                            label="Show ALL Locked Tasks"
                            description="Override the reason filters and include every locked quest"
                            emphasized
                        />
                        <fieldset className={cn(
                            "transition-opacity",
                            lockedFilters.showAll && "opacity-35",
                        )} disabled={lockedFilters.showAll}>
                            <ToggleRow
                                checked={lockedFilters.showPlayerLevel}
                                onChange={(checked) => setLockedFilters({ showPlayerLevel: checked })}
                                label="Player level"
                                description="Show quests locked by your PMC level"
                            />
                            {lockedFilters.showPlayerLevel && <UpcomingRuleRow
                                checked={lockedFilters.playerLevelUpcomingOnly}
                                onChange={(checked) => setLockedFilters({ playerLevelUpcomingOnly: checked })}
                                description="Only show quests within this many levels"
                                value={lockedFilters.playerLevelLookahead}
                                min={0}
                                onValueChange={(value) => setLockedFilters({ playerLevelLookahead: value })}
                            />}
                            <ToggleRow
                                checked={lockedFilters.showTaskCount}
                                onChange={(checked) => setLockedFilters({ showTaskCount: checked })}
                                label="Number of completed quests"
                                description="Show quests locked by trader task-count milestones"
                            />
                            {lockedFilters.showTaskCount && <UpcomingRuleRow
                                checked={lockedFilters.taskCountUpcomingOnly}
                                onChange={(checked) => setLockedFilters({ taskCountUpcomingOnly: checked })}
                                description="Only show the next incomplete milestone (for example 1, then 3, then 5)"
                            />}
                            <ToggleRow
                                checked={lockedFilters.showPrerequisite}
                                onChange={(checked) => setLockedFilters({ showPrerequisite: checked })}
                                label="Previous quest incomplete"
                                description="Show quests with unfinished prerequisite quests"
                            />
                            {lockedFilters.showPrerequisite && <UpcomingRuleRow
                                checked={lockedFilters.prerequisiteUpcomingOnly}
                                onChange={(checked) => setLockedFilters({ prerequisiteUpcomingOnly: checked })}
                                description="Only show quests within this many missing prerequisites"
                                value={lockedFilters.prerequisiteLookahead}
                                min={1}
                                onValueChange={(value) => setLockedFilters({ prerequisiteLookahead: value })}
                            />}
                            <ToggleRow
                                checked={lockedFilters.showFaction}
                                onChange={(checked) => setLockedFilters({ showFaction: checked })}
                                label="Incorrect faction"
                                description="Show quests restricted to the other faction"
                            />
                        </fieldset>
                        <div className="mt-2 border-t border-white/8 px-3 py-2 text-[10px] leading-relaxed text-gray-600">A locked quest must pass every applicable reason filter. Other gates, such as loyalty, reputation, prestige, and branches, remain visible.</div>
                    </>}
                </>}
                {section === "filters" && <>
                    <FilterSectionTitle>Visibility</FilterSectionTitle>
                    <ToggleRow
                        checked={showHiddenQuests}
                        onChange={setShowHiddenQuests}
                        label="Show hidden quests"
                        description="Include quests you have chosen to hide"
                    />

                    <FilterSectionTitle>Requirements</FilterSectionTitle>
                    <ToggleRow
                        checked={filterByTraderRequirements}
                        onChange={setFilterByTraderRequirements}
                        label="Filter quests by reputation requirement"
                        description="Use your trader loyalty levels and Fence reputation"
                    />

                    <FilterSectionTitle>Grouping</FilterSectionTitle>
                    <ToggleRow
                        checked={groupByTrader}
                        onChange={setGroupByTrader}
                        label="Group by trader"
                        description="Separate quests by their issuing trader"
                    />
                    <ToggleRow
                        checked={groupByLoyaltyLevel}
                        onChange={setGroupByLoyaltyLevel}
                        label="Group by loyalty level"
                        description="Separate quests by the issuing trader's required LL"
                    />

                    <FilterSectionTitle>Sort</FilterSectionTitle>
                    {SORT_OPTIONS.map((option) => (
                        <MenuRow
                            key={option.id}
                            selected={sortMode === option.id}
                            onClick={() => setSortMode(option.id)}
                            label={option.label}
                            description={option.description}
                        />
                    ))}

                    <FilterSectionTitle>Quest types</FilterSectionTitle>
                    <AnyRow active={selectedObjectiveCategories.size === 0} onClick={clearObjectiveCategories} count={quests.length} />
                    {objectiveCategories.map((category) => <MenuRow key={category} selected={selectedObjectiveCategories.has(category)} onClick={() => toggleObjectiveCategory(category)} label={OBJECTIVE_CATEGORY_LABELS[category]} count={quests.filter((quest) => getQuestObjectiveCategories(quest).has(category)).length} />)}
                </>}
            </div>
        </div>
    );
}

const SORT_OPTIONS = [
    { id: "unlockOrder", label: "Unlock order", description: "Player level, then task-count milestone, while keeping quest chains together" },
    { id: "default", label: "Quest chain", description: "Keep prerequisite quests together" },
    { id: "level", label: "Player level", description: "Lowest required level first" },
    { id: "xp", label: "Experience", description: "Highest XP reward first" },
    { id: "unlockImpact", label: "Unlock impact", description: "Quests that unlock the most follow-ups first" },
] as const;

function FilterSectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div className="border-y border-white/8 bg-white/[0.025] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-600 first:border-t-0">
            {children}
        </div>
    );
}

function ToggleRow({ checked, onChange, label, description, emphasized = false }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description: string;
    emphasized?: boolean;
}) {
    return (
        <label className={cn(
            "flex cursor-pointer items-center justify-between gap-4 px-3 py-2.5 transition-colors hover:bg-white/5",
            emphasized && "border-y border-amber-300/20 bg-amber-300/[0.06] hover:bg-amber-300/[0.09]",
        )}>
            <span className="min-w-0">
                <span className={cn("block text-sm text-gray-200", emphasized && "font-semibold text-amber-200")}>{label}</span>
                <span className="block text-[10px] text-gray-600">{description}</span>
            </span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
            <span className="relative h-5 w-9 shrink-0 rounded-full bg-white/10 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-gray-500 after:transition-transform peer-checked:bg-tarkov-green/25 peer-checked:after:translate-x-4 peer-checked:after:bg-tarkov-green peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-tarkov-green" />
        </label>
    );
}

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
        <div className="flex items-center gap-3 border-b border-white/5 bg-black/15 py-2 pl-7 pr-3">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#9cae7c]"
                />
                <span className="min-w-0">
                    <span className="block text-xs text-gray-300">Show upcoming only</span>
                    <span className="block text-[10px] leading-relaxed text-gray-600">{description}</span>
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
                    className="h-8 w-14 border border-white/10 bg-black/25 px-2 text-center font-mono text-xs text-gray-200 outline-none transition-colors focus:border-tarkov-green/50 disabled:cursor-not-allowed disabled:opacity-35"
                />
            )}
        </div>
    );
}
