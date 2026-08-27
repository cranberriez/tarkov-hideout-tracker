"use client";

import { Check, ChevronDown, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { useQuestWorkspace, type QuestFilterSection } from "./QuestWorkspaceContext";
import { OBJECTIVE_CATEGORY_LABELS, STATUS_OPTIONS } from "./quest-workspace-utils";

function FilterTrigger({
    section,
    label,
    summary,
    children,
}: {
    section: Exclude<QuestFilterSection, null>;
    label: string;
    summary: React.ReactNode;
    children: React.ReactNode;
}) {
    const { openFilter, setOpenFilter } = useQuestWorkspace();
    const open = openFilter === section;
    return (
        <div className="relative min-w-0 flex-1">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenFilter(open ? null : section)}
                className={cn(
                    "flex h-14 w-full min-w-0 items-center gap-2 border-r border-white/8 px-3 text-left transition-colors hover:bg-white/5",
                    open && "bg-white/7 text-white",
                )}
            >
                <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-600">{label}</span>
                    <span className="block truncate text-xs font-medium text-gray-200">{summary}</span>
                </span>
                <ChevronDown size={13} className={cn("shrink-0 text-gray-600 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="absolute left-0 top-full z-30 mt-px max-h-[min(62vh,520px)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto border border-white/10 bg-[#111214] p-2 shadow-2xl">
                    {children}
                </div>
            )}
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
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5",
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
        quests,
        traders,
        maps,
        objectiveCategories,
        selectedTraderIds,
        selectedMapKeys,
        selectedStatuses,
        selectedObjectiveCategories,
        toggleTrader,
        clearTraders,
        toggleMap,
        clearMaps,
        toggleStatus,
        toggleObjectiveCategory,
        clearObjectiveCategories,
        statusByQuestId,
    } = useQuestWorkspace();
    const selectedMapNames = maps.filter((map) => selectedMapKeys.has(map.key)).map((map) => map.name);
    const statusSummary = STATUS_OPTIONS.filter((option) => selectedStatuses.has(option.id)).map((option) => option.label);

    return (
        <div className="flex border-b border-white/10 bg-[#101113]">
            <FilterTrigger section="traders" label="Traders" summary={<TraderFaces />}>
                <AnyRow active={selectedTraderIds.size === 0} onClick={clearTraders} count={quests.length} />
                {traders.map((trader) => (
                    <MenuRow
                        key={trader.id}
                        selected={selectedTraderIds.has(trader.id)}
                        onClick={() => toggleTrader(trader.id)}
                        image={trader.image4xLink ?? trader.imageLink}
                        label={trader.name}
                        count={quests.filter((quest) => quest.trader.id === trader.id).length}
                    />
                ))}
            </FilterTrigger>
            <FilterTrigger section="maps" label="Map" summary={selectedMapNames.length === 0 ? "Any map" : selectedMapNames.length === 1 ? selectedMapNames[0] : `${selectedMapNames.length} selected`}>
                <AnyRow active={selectedMapKeys.size === 0} onClick={clearMaps} count={quests.length} />
                {maps.map((map) => (
                    <MenuRow
                        key={map.key}
                        selected={selectedMapKeys.has(map.key)}
                        onClick={() => toggleMap(map.key)}
                        label={map.name}
                        count={quests.filter((quest) => getQuestMapGroupsForQuest(quest).some((group) => group.key === map.key)).length}
                    />
                ))}
            </FilterTrigger>
            <FilterTrigger section="status" label="Status" summary={statusSummary.length === 3 ? "All states" : statusSummary.length ? statusSummary.join(", ") : "None"}>
                {STATUS_OPTIONS.map((option) => (
                    <MenuRow
                        key={option.id}
                        selected={selectedStatuses.has(option.id)}
                        onClick={() => toggleStatus(option.id)}
                        label={option.label}
                        description={option.description}
                        count={quests.filter((quest) => {
                            const status = statusByQuestId.get(quest.id);
                            return status?.status === option.id &&
                                (option.id === "completed" || !status.terminal);
                        }).length}
                    />
                ))}
                <div className="mt-2 border-t border-white/8 px-3 py-2 text-[10px] leading-relaxed text-gray-600">
                    Locked reasons include quest, level, loyalty, prestige, faction, and branch gates. Pinning is independent from quest status.
                </div>
            </FilterTrigger>
            <FilterTrigger section="types" label="Quest type" summary={selectedObjectiveCategories.size === 0 ? "Any type" : selectedObjectiveCategories.size === 1 ? OBJECTIVE_CATEGORY_LABELS[[...selectedObjectiveCategories][0]] : `${selectedObjectiveCategories.size} selected`}>
                <AnyRow active={selectedObjectiveCategories.size === 0} onClick={clearObjectiveCategories} count={quests.length} />
                {objectiveCategories.map((category) => (
                    <MenuRow
                        key={category}
                        selected={selectedObjectiveCategories.has(category)}
                        onClick={() => toggleObjectiveCategory(category)}
                        label={OBJECTIVE_CATEGORY_LABELS[category]}
                        count={quests.filter((quest) => quest.objectives.some((objective) => {
                            const type = objective.type;
                            if (category === "hand-in") return type === "giveItem";
                            if (category === "find") return ["findItem", "findQuestItem", "pickupQuestItem"].includes(type);
                            if (category === "plant") return type === "plantItem";
                            if (category === "eliminate") return type === "shoot";
                            if (category === "extract") return type === "extract";
                            if (category === "location") return ["visit", "mark", "locate"].includes(type);
                            if (category === "build") return type === "buildItem";
                            if (category === "use") return type === "useItem";
                            return !["giveItem", "findItem", "findQuestItem", "pickupQuestItem", "plantItem", "shoot", "extract", "visit", "mark", "locate", "buildItem", "useItem"].includes(type);
                        })).length}
                    />
                ))}
            </FilterTrigger>
        </div>
    );
}
