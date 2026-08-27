"use client";

import { Check, CircleDot, Crown, SlidersHorizontal, X } from "lucide-react";
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
                    "flex h-14 w-full min-w-0 cursor-pointer items-center gap-2 border-r border-white/8 px-3 text-left transition-colors hover:bg-white/5",
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

function TraderFaces() {
    const { traders, selectedTraderIds } = useQuestWorkspace();
    const visible = (selectedTraderIds.size ? traders.filter((trader) => selectedTraderIds.has(trader.id)) : traders).slice(0, 4);
    return (
        <span className="flex items-center pl-1">
            {visible.map((trader, index) => (
                (trader.image4xLink ?? trader.imageLink) ? (
                    <img key={trader.id} src={trader.image4xLink ?? trader.imageLink ?? ""} alt="" className="h-5 w-5 rounded-full border border-[#17181a] object-cover" style={{ marginLeft: index ? -6 : 0, zIndex: visible.length - index }} />
                ) : null
            ))}
            {selectedTraderIds.size === 0 && <span className="ml-1.5 text-[10px] text-gray-500">ANY</span>}
        </span>
    );
}

export function QuestFilterBar() {
    const {
        maps,
        selectedMapKeys,
        selectedStatuses,
        selectedObjectiveCategories,
    } = useQuestWorkspace();
    const selectedMapNames = maps.filter((map) => selectedMapKeys.has(map.key)).map((map) => map.name);
    const statusSummary = STATUS_OPTIONS.filter((option) => selectedStatuses.has(option.id)).map((option) => option.label);

    return (
        <div className="flex border-b border-white/10 bg-[#101113]">
            <FilterTrigger section="traders" label="Traders" summary={<TraderFaces />} />
            <FilterTrigger section="maps" label="Map" summary={selectedMapNames.length === 0 ? "Any map" : selectedMapNames.length === 1 ? selectedMapNames[0] : `${selectedMapNames.length} selected`} />
            <FilterTrigger section="status" label="Status" summary={statusSummary.length === 3 ? "All states" : statusSummary.length ? statusSummary.join(", ") : "None"} />
            <FilterTrigger section="types" label="Quest type" summary={selectedObjectiveCategories.size === 0 ? "Any type" : selectedObjectiveCategories.size === 1 ? OBJECTIVE_CATEGORY_LABELS[[...selectedObjectiveCategories][0]] : `${selectedObjectiveCategories.size} selected`} />
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
        selectedObjectiveCategories, toggleTrader, clearTraders,
        setFilterByTraderRequirements, toggleMap, clearMaps, toggleStatus, toggleObjectiveCategory,
        clearObjectiveCategories, statusByQuestId, setOpenFilter,
    } = useQuestWorkspace();
    const titles = { traders: "Select traders", maps: "Select maps", status: "Select quest status", types: "Select quest types" };
    const orderedTraders = [...traders].sort((left, right) => {
        const leftRank = TRADER_ORDER.indexOf(normalizedTraderKey(left) as typeof TRADER_ORDER[number]);
        const rightRank = TRADER_ORDER.indexOf(normalizedTraderKey(right) as typeof TRADER_ORDER[number]);
        return (leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank) -
            (rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank) ||
            left.name.localeCompare(right.name);
    });

    return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b0c0e]">
            <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-white/10 bg-[#101113] px-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{titles[section]}</span>
                <button type="button" onClick={() => setOpenFilter(null)} className="flex h-7 cursor-pointer items-center gap-1.5 px-2 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"><X size={13} /> Done</button>
            </div>
            <div className="p-2">
                {section === "traders" && <>
                    <AnyRow active={selectedTraderIds.size === 0} onClick={clearTraders} count={quests.length} />
                    <div className="border-b border-white/8 bg-white/[0.02] px-3 py-3">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600"><SlidersHorizontal size={13} /> Additional options</div>
                        <label className="flex cursor-pointer items-center justify-between gap-4 py-1 text-xs text-gray-300">
                            <span>Filter quests by reputation requirement</span>
                            <input
                                type="checkbox"
                                checked={filterByTraderRequirements}
                                onChange={(event) => setFilterByTraderRequirements(event.target.checked)}
                                className="peer sr-only"
                            />
                            <span className="relative h-5 w-9 shrink-0 rounded-full bg-white/10 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-gray-500 after:transition-transform peer-checked:bg-tarkov-green/25 peer-checked:after:translate-x-4 peer-checked:after:bg-tarkov-green peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-tarkov-green" />
                        </label>
                    </div>
                    {orderedTraders.map((trader) => (
                        <TraderSelectionRow
                            key={trader.id}
                            trader={trader}
                            selected={selectedTraderIds.has(trader.id)}
                            onSelect={() => toggleTrader(trader.id)}
                            count={quests.filter((quest) => quest.trader.id === trader.id).length}
                        />
                    ))}
                </>}
                {section === "maps" && <><AnyRow active={selectedMapKeys.size === 0} onClick={clearMaps} count={quests.length} />{maps.map((map) => <MenuRow key={map.key} selected={selectedMapKeys.has(map.key)} onClick={() => toggleMap(map.key)} label={map.name} count={quests.filter((quest) => getQuestMapGroupsForQuest(quest).some((group) => group.key === map.key)).length} />)}</>}
                {section === "status" && <>{STATUS_OPTIONS.map((option) => <MenuRow key={option.id} selected={selectedStatuses.has(option.id)} onClick={() => toggleStatus(option.id)} label={option.label} description={option.description} count={quests.filter((quest) => { const status = statusByQuestId.get(quest.id); return status?.status === option.id && (option.id === "completed" || !status.terminal); }).length} />)}<div className="mt-2 border-t border-white/8 px-3 py-2 text-[10px] leading-relaxed text-gray-600">Locked reasons include quest, level, loyalty, prestige, faction, and branch gates. Pinning is independent from quest status.</div></>}
                {section === "types" && <><AnyRow active={selectedObjectiveCategories.size === 0} onClick={clearObjectiveCategories} count={quests.length} />{objectiveCategories.map((category) => <MenuRow key={category} selected={selectedObjectiveCategories.has(category)} onClick={() => toggleObjectiveCategory(category)} label={OBJECTIVE_CATEGORY_LABELS[category]} count={quests.filter((quest) => getQuestObjectiveCategories(quest).has(category)).length} />)}</>}
            </div>
        </div>
    );
}
