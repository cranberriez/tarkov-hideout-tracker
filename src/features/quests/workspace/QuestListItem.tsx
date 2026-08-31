import {
    CheckCircle2,
    Circle,
    Crown,
    Eye,
    EyeOff,
    GitBranch,
    KeyRound,
    Lock,
    MapPin,
    Pin,
    RotateCcw,
    XCircle,
} from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { getQuestTraderTabLoyaltyLevel } from "@/lib/utils/quest-trader-completion-gates";
import { isEssentialQuest } from "@/lib/utils/quest-series";
import { useQuestsContext } from "../QuestsContext";
import { getQuestObjectiveCategories } from "./quest-workspace-utils";
import { QuestObjectiveTypeTag } from "./QuestObjectiveTypeTag";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestListItem({
    questId,
    selected,
    highlighted,
    onSelect,
    includeElementId = true,
}: {
    questId: string;
    selected: boolean;
    highlighted: boolean;
    onSelect: () => void;
    includeElementId?: boolean;
}) {
    const {
        questsById,
        statusByQuestId,
        upcomingLockedQuestIds,
        markerByQuestId,
        branchLineByQuestId,
        mode,
        retainQuestAfterCompletion,
    } = useQuestWorkspace();
    const quest = questsById.get(questId)!;
    const status = statusByQuestId.get(questId)!;
    const marker = markerByQuestId.get(questId);
    const branchLine = branchLineByQuestId.get(questId);
    const pinned = useUserStore((state) => !!state.pinnedQuests[questId]);
    const hidden = useUserStore((state) => !!state.ignoredQuests[questId]);
    const togglePinnedQuest = useUserStore((state) => state.togglePinnedQuest);
    const toggleIgnoredQuest = useUserStore((state) => state.toggleIgnoredQuest);
    const { requestToggleQuestCompletion } = useQuestsContext();
    const completed = status.status === "completed";
    const failed = status.status === "failed";
    const resolved = completed || failed;
    const categories = [...getQuestObjectiveCategories(quest)].slice(0, 2);
    const traderImage = quest.trader.image4xLink ?? quest.trader.imageLink;
    const traderLoyaltyLevel = getQuestTraderTabLoyaltyLevel(quest);
    const essential = isEssentialQuest(quest.id);
    const upcoming = upcomingLockedQuestIds.has(quest.id);

    return (
        <article
            id={includeElementId ? `quest-workspace-${quest.id}` : undefined}
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
                "group relative grid min-h-20 cursor-pointer grid-cols-[108px_minmax(0,1fr)] overflow-hidden text-left outline-none transition-colors focus-visible:bg-white/6",
                quest.removed
                    ? "border border-red-500/70 bg-red-500/5"
                    : "border-b border-white/8 bg-[#111214]",
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
                            resolved && "opacity-50",
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
                    <h3 className={cn(
                        "min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-gray-100",
                        resolved && "text-gray-500",
                    )}>
                        {quest.name}
                    </h3>
                    {branchLine && (
                        <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center text-tarkov-green/70"
                            aria-label={`Part of ${branchLine.name}`}
                            title={`Part of ${branchLine.name}`}
                        >
                            <GitBranch size={14} />
                        </span>
                    )}
                    <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            title={hidden ? "Show quest" : "Hide quest"}
                            aria-label={hidden ? "Show quest" : "Hide quest"}
                            onClick={() => toggleIgnoredQuest(quest.id)}
                            className={cn(
                                "hidden h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-violet-300/8 hover:text-violet-300 lg:flex",
                                hidden && "bg-violet-300/8 text-violet-300",
                            )}
                        >
                            {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                            type="button"
                            title={pinned ? "Unpin quest" : "Pin quest"}
                            onClick={() => togglePinnedQuest(quest.id)}
                            className={cn(
                                "-mb-px hidden h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-sky-400/8 hover:text-sky-300 lg:flex",
                                pinned && "bg-sky-400/8 text-sky-300",
                            )}
                        >
                            <Pin size={14} className={pinned ? "fill-current" : ""} />
                        </button>
                        <button
                            type="button"
                            title={completed ? "Mark incomplete" : "Mark complete"}
                            onClick={() => {
                                if (!completed) retainQuestAfterCompletion(quest.id);
                                requestToggleQuestCompletion(quest.id);
                            }}
                            className={cn(
                                "group/complete relative flex h-7 w-7 items-center justify-center rounded transition-colors",
                                completed
                                    ? "bg-tarkov-green/12 text-tarkov-green hover:bg-red-400/12 hover:text-red-300"
                                    : failed
                                      ? "bg-red-400/10 text-red-300 hover:bg-red-400/16 hover:text-red-200"
                                      : "text-gray-600 hover:bg-tarkov-green/10 hover:text-tarkov-green",
                            )}
                        >
                            {completed ? (
                                <>
                                    <CheckCircle2 size={15} className="group-hover/complete:hidden" />
                                    <RotateCcw size={15} className="hidden group-hover/complete:block" />
                                </>
                            ) : failed ? <XCircle size={15} /> : <Circle size={15} />}
                        </button>
                    </div>
                </div>

                <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] text-gray-500">
                    <span className="flex min-w-0 items-center gap-1">
                        {traderImage && <img src={traderImage} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />}
                        <span className="truncate font-medium">{quest.trader.name}</span>
                        {essential ? (
                            <span className="shrink-0 font-serif text-[9px] font-bold uppercase text-amber-300/75" title="Essential quest">
                                Essential
                            </span>
                        ) : (
                            <span
                                className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center text-tarkov-green/75"
                                title={`${quest.trader.name} loyalty level ${traderLoyaltyLevel} tab`}
                                aria-label={`Trader loyalty level ${traderLoyaltyLevel} tab`}
                            >
                                {traderLoyaltyLevel === 4
                                    ? <Crown size={10} />
                                    : <span className="font-serif text-[9px] font-bold leading-none">{["", "I", "II", "III"][traderLoyaltyLevel]}</span>}
                            </span>
                        )}
                        {quest.removed && (
                            <span className="shrink-0 font-serif text-[9px] font-bold uppercase text-red-300">Removed</span>
                        )}
                    </span>
                    {status.status === "locked" && (
                        <span className={cn(
                            "flex shrink-0 items-center gap-1 uppercase",
                            upcoming ? "text-amber-300/80" : "text-red-300/70",
                        )}>
                            <Lock size={10} /> {upcoming ? "Upcoming" : status.label}
                        </span>
                    )}
                    {failed && <span className="flex shrink-0 items-center gap-1 uppercase text-red-300/70"><XCircle size={10} /> Failed</span>}
                    {(quest.minPlayerLevel ?? 0) > 0 && <span className="shrink-0">Lv {quest.minPlayerLevel}</span>}
                    {quest.objectives.some((objective) => objective.requiredKeyIds?.length) && (
                        <KeyRound size={10} className="shrink-0 text-amber-300/70" />
                    )}
                </div>

                <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] font-medium text-gray-500">
                    {quest.map && <span className="flex shrink-0 items-center gap-1"><MapPin size={10} /> {quest.map.name}</span>}
                    {categories.map((category) => <QuestObjectiveTypeTag key={category} category={category} />)}
                </div>
            </div>
        </article>
    );
}
