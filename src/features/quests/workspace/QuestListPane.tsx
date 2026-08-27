"use client";

import {
    CheckCircle2,
    Circle,
    Crosshair,
    DoorOpen,
    Hammer,
    KeyRound,
    Lock,
    MapPin,
    Package,
    PackageCheck,
    Pin,
    RotateCcw,
    Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useQuestsContext } from "../QuestsContext";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import {
    getQuestObjectiveCategories,
    getQuestObjectiveSummary,
    OBJECTIVE_CATEGORY_SHORT_LABELS,
    type QuestObjectiveCategory,
} from "./quest-workspace-utils";

export function QuestListPane() {
    const {
        filteredQuests,
        selectedQuestId,
        setSelectedQuestId,
        highlightedQuestId,
    } = useQuestWorkspace();

    return (
        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth bg-[#0b0c0e]">
            <div className="flex h-8 items-center justify-between border-b border-white/8 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                <span>Quest log</span>
                <span>{filteredQuests.length} quests</span>
            </div>
            {filteredQuests.map((quest) => (
                <QuestListItem
                    key={quest.id}
                    questId={quest.id}
                    selected={selectedQuestId === quest.id}
                    highlighted={highlightedQuestId === quest.id}
                    onSelect={() => setSelectedQuestId(quest.id)}
                />
            ))}
            {filteredQuests.length === 0 && (
                <div className="border-b border-dashed border-white/10 px-5 py-14 text-center text-sm text-gray-600">
                    No quests match these filters.
                </div>
            )}
        </div>
    );
}

function QuestListItem({
    questId,
    selected,
    highlighted,
    onSelect,
}: {
    questId: string;
    selected: boolean;
    highlighted: boolean;
    onSelect: () => void;
}) {
    const { questsById, statusByQuestId, markerByQuestId, mode } = useQuestWorkspace();
    const quest = questsById.get(questId)!;
    const status = statusByQuestId.get(questId)!;
    const marker = markerByQuestId.get(questId);
    const pinned = useUserStore((state) => !!state.pinnedQuests[questId]);
    const haveItems = useUserStore((state) => !!state.questsWithItems[questId]);
    const togglePinnedQuest = useUserStore((state) => state.togglePinnedQuest);
    const toggleQuestHaveItems = useUserStore((state) => state.toggleQuestHaveItems);
    const { requestToggleQuestCompletion } = useQuestsContext();
    const completed = status.status === "completed";
    const hasItemObjectives = quest.objectives.some(
        (objective) => objective.type === "giveItem" || objective.type === "plantItem",
    );
    const categories = [...getQuestObjectiveCategories(quest)].slice(0, 2);
    const traderImage = quest.trader.image4xLink ?? quest.trader.imageLink;

    return (
        <article
            id={`quest-workspace-${quest.id}`}
            tabIndex={0}
            role="button"
            aria-pressed={selected}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect();
                }
            }}
            className={cn(
                "group relative grid min-h-24 cursor-pointer grid-cols-[108px_minmax(0,1fr)] overflow-hidden border-b border-white/8 bg-[#111214] text-left outline-none transition-colors focus-visible:bg-white/6",
                selected && "bg-white/6 shadow-[inset_3px_0_0_var(--accent-green)]",
                highlighted && "bg-white/10",
            )}
        >
            <div className="relative min-h-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#292b30,#111214_70%)]">
                {quest.taskImageLink ? (
                    <img
                        src={quest.taskImageLink}
                        alt=""
                        className={cn(
                            "absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.025]",
                            completed && "opacity-50",
                        )}
                    />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/8">
                        {quest.name.slice(0, 1)}
                    </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#111214]/80" />
                {mode === "planner" && marker && (
                    <span
                        className="absolute left-2 top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full border border-black/50 bg-black/80 px-1.5 font-mono text-[11px] font-bold"
                        style={{ color: marker.color }}
                    >
                        {marker.label}
                    </span>
                )}
            </div>

            <div className="min-w-0 px-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2">
                    <h3
                        className={cn(
                            "min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-gray-100",
                            completed && "text-gray-500",
                        )}
                    >
                        {quest.name}
                    </h3>
                    <div
                        className="flex shrink-0 items-center gap-0.5"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            title={completed ? "Mark incomplete" : "Mark complete"}
                            onClick={() => requestToggleQuestCompletion(quest.id)}
                            className={cn(
                                "group/complete relative flex h-7 w-7 items-center justify-center rounded transition-colors",
                                completed
                                    ? "bg-tarkov-green/12 text-tarkov-green hover:bg-red-400/12 hover:text-red-300"
                                    : "text-gray-600 hover:bg-tarkov-green/10 hover:text-tarkov-green",
                            )}
                        >
                            {completed ? (
                                <>
                                    <CheckCircle2 size={15} className="group-hover/complete:hidden" />
                                    <RotateCcw size={15} className="hidden group-hover/complete:block" />
                                </>
                            ) : (
                                <Circle size={15} />
                            )}
                        </button>
                        <button
                            type="button"
                            title={pinned ? "Unpin quest" : "Pin quest"}
                            onClick={() => togglePinnedQuest(quest.id)}
                            className={cn(
                                "flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-sky-400/8 hover:text-sky-300",
                                pinned && "bg-sky-400/8 text-sky-300",
                            )}
                        >
                            <Pin size={14} className={pinned ? "fill-current" : ""} />
                        </button>
                        {hasItemObjectives && (
                            <button
                                type="button"
                                title={haveItems ? "Items not ready" : "Items ready"}
                                onClick={() => toggleQuestHaveItems(quest.id)}
                                className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-amber-300/8 hover:text-amber-300",
                                    haveItems && "bg-amber-300/8 text-amber-300",
                                )}
                            >
                                <PackageCheck size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[9px] text-gray-600">
                    <span className="flex min-w-0 items-center gap-1">
                        {traderImage && (
                            <img src={traderImage} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                        )}
                        <span className="truncate">{quest.trader.name}</span>
                    </span>
                    {status.status === "locked" && (
                        <span className="flex shrink-0 items-center gap-1 uppercase text-red-300/70">
                            <Lock size={10} /> {status.label}
                        </span>
                    )}
                    {(quest.minPlayerLevel ?? 0) > 0 && <span className="shrink-0">Lv {quest.minPlayerLevel}</span>}
                    {quest.objectives.some((objective) => objective.requiredKeys?.length) && (
                        <KeyRound size={10} className="shrink-0 text-amber-300/70" />
                    )}
                </div>

                <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-gray-500">
                    {getQuestObjectiveSummary(quest)}
                </p>

                <div className="mt-1 flex min-w-0 items-center gap-2 text-[9px] text-gray-600">
                    {quest.map && (
                        <span className="flex shrink-0 items-center gap-1">
                            <MapPin size={10} /> {quest.map.name}
                        </span>
                    )}
                    {categories.map((category) => (
                        <ObjectiveTypeTag key={category} category={category} />
                    ))}
                </div>
            </div>
        </article>
    );
}

const TYPE_ICONS = {
    "hand-in": Package,
    find: Search,
    plant: MapPin,
    eliminate: Crosshair,
    extract: DoorOpen,
    location: MapPin,
    build: Hammer,
    use: Package,
    other: Circle,
} satisfies Record<QuestObjectiveCategory, typeof Circle>;

function ObjectiveTypeTag({ category }: { category: QuestObjectiveCategory }) {
    const Icon = TYPE_ICONS[category];
    return (
        <span className="flex shrink-0 items-center gap-1">
            <Icon size={10} /> {OBJECTIVE_CATEGORY_SHORT_LABELS[category]}
        </span>
    );
}
