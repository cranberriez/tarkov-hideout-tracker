"use client";

import { useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    CheckCircle,
    Circle,
    Package,
    Search,
    Crosshair,
    DoorOpen,
    MapPin,
    Hammer,
    Zap,
    ExternalLink,
    Braces,
    Pin,
    CircleSlash,
    Lock,
} from "lucide-react";
import type {
    FullQuest,
    FullQuestObjective,
    QuestObjectiveItemType,
    QuestObjectiveShootType,
} from "@/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useQuestsContext } from "./QuestsContext";
import { isQuestAvailableForProfile } from "./quest-sync";

export interface QuestRef {
    id: string;
    name: string;
    trader: { imageLink: string | null; image4xLink: string | null; name: string };
}

interface QuestCardProps {
    quest: FullQuest;
    prerequisiteQuests: QuestRef[];
    leadsToQuests: QuestRef[];
    attachedTop?: boolean;
    showDebugButton?: boolean;
    highlighted?: boolean;
    onQuestLinkClick?: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}

const questMetaChipBaseClass =
    "inline-flex h-5 items-center rounded border px-1.5 text-[10px] leading-none";

function isItemObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
    return (o.type === "giveItem" || o.type === "findItem") && "items" in o;
}

function isGiveItemObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
    return o.type === "giveItem" && "items" in o;
}

function isShootObjective(o: FullQuestObjective): o is QuestObjectiveShootType {
    return o.type === "shoot" && "target" in o;
}

function ObjectiveIcon({ type }: { type: string }) {
    const cls = "shrink-0 mt-0.5";
    switch (type) {
        case "giveItem":
            return <Package size={13} className={`${cls} text-tarkov-green/60`} />;
        case "findItem":
            return <Search size={13} className={`${cls} text-blue-400/60`} />;
        case "shoot":
            return <Crosshair size={13} className={`${cls} text-red-400/60`} />;
        case "extract":
            return <DoorOpen size={13} className={`${cls} text-yellow-400/60`} />;
        case "visit":
        case "mark":
        case "locate":
            return <MapPin size={13} className={`${cls} text-purple-400/60`} />;
        case "buildItem":
            return <Hammer size={13} className={`${cls} text-orange-400/60`} />;
        case "skill":
        case "playerLevel":
            return <Zap size={13} className={`${cls} text-cyan-400/60`} />;
        default:
            return <ChevronRight size={13} className={`${cls} text-gray-600`} />;
    }
}

function ObjectiveRow({
    objective,
    onItemClick,
}: {
    objective: FullQuestObjective;
    onItemClick?: (itemId: string) => void;
}) {
    const item = isItemObjective(objective) ? objective : null;
    const shoot = isShootObjective(objective) ? objective : null;
    const hasItemChoices = !!item && item.items.length > 1;

    return (
        <div className={`flex items-start gap-2 ${objective.optional ? "opacity-50" : ""}`}>
            <ObjectiveIcon type={objective.type} />
            <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-gray-300 leading-snug">{objective.description}</p>
                {shoot && shoot.bodyParts.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {shoot.bodyParts.map((part) => (
                            <span
                                key={part}
                                className="text-[10px] text-gray-500 border border-white/10 bg-black/30 px-1.5 py-0.5 rounded"
                            >
                                {part}
                            </span>
                        ))}
                    </div>
                )}
                {item && item.items.length > 0 && (
                    <div
                        className={
                            hasItemChoices
                                ? "space-y-2 rounded-md border border-white/12 bg-white/4 px-2.5 py-2.5"
                                : "flex flex-wrap gap-1.5"
                        }
                    >
                        {hasItemChoices && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span>{item.count} of any of these</span>
                                {item.foundInRaid && (
                                    <span className="rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">
                                        FiR
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                            {item.items.map((itm) => (
                                <div
                                    key={itm.id}
                                    className={`flex items-center gap-1.5 rounded border border-white/10 bg-black/40 px-2 py-1 ${onItemClick ? "cursor-pointer hover:border-white/25 transition-colors" : ""}`}
                                    onClick={onItemClick ? (e) => { e.stopPropagation(); onItemClick(itm.id); } : undefined}
                                >
                                    {(itm.iconLink ?? itm.gridImageLink) && (
                                        <span
                                            className={`flex h-6 w-6 items-center justify-center rounded-sm bg-black/35 ${
                                                item.foundInRaid ? "ring-1 ring-orange-500" : ""
                                            }`}
                                        >
                                            <img
                                                src={itm.iconLink ?? itm.gridImageLink ?? ""}
                                                alt={itm.name}
                                                className="h-5 w-5 object-contain"
                                            />
                                        </span>
                                    )}
                                    <span className="text-[11px] text-gray-200">{itm.name}</span>
                                    {!hasItemChoices && (
                                        <span className="text-[11px] text-gray-500">
                                            x{item.count}
                                        </span>
                                    )}
                                    {!hasItemChoices && item.foundInRaid && (
                                        <span className="text-[9px] text-orange-400 font-medium">
                                            FiR
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {objective.optional && (
                <span className="text-[9px] text-gray-600 border border-white/5 px-1 py-0.5 rounded mt-0.5 shrink-0">
                    opt
                </span>
            )}
        </div>
    );
}

function QuestChip({
    questRef,
    onQuestLinkClick,
}: {
    questRef: QuestRef;
    onQuestLinkClick?: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
    return (
        <a
            href={`#quest-${questRef.id}`}
            onClick={(e) => {
                e.stopPropagation();
                onQuestLinkClick?.(questRef.id, e);
            }}
            className="flex items-center gap-1.5 text-xs text-gray-400 bg-black/40 border border-white/10 px-2 py-0.5 rounded hover:border-white/25 hover:text-gray-300 transition-colors"
        >
            {questRef.trader.image4xLink ?? questRef.trader.imageLink ? (
                <img
                    src={questRef.trader.image4xLink ?? questRef.trader.imageLink ?? ""}
                    alt={questRef.trader.name}
                    className="w-3.5 h-3.5 rounded-full shrink-0 object-cover"
                />
            ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-white/10 flex items-center justify-center text-[9px] shrink-0">
                    {questRef.trader.name[0]}
                </span>
            )}
            {questRef.name}
        </a>
    );
}

export function QuestCard({
    quest,
    prerequisiteQuests,
    leadsToQuests,
    attachedTop = false,
    showDebugButton = false,
    highlighted = false,
    onQuestLinkClick,
}: QuestCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [debugOpen, setDebugOpen] = useState(false);
    const { syncProfile, questsById, onItemClick } = useQuestsContext();
    const {
        completedQuests,
        ignoredQuests,
        pinnedQuests,
        toggleQuestCompletion,
        toggleIgnoredQuest,
        togglePinnedQuest,
    } = useUserStore();
    const completed = !!completedQuests[quest.id];
    const ignored = !!ignoredQuests[quest.id];
    const pinned = !!pinnedQuests[quest.id];
    const completedRequirementCount = quest.taskRequirements.filter(
        (req) => completedQuests[req.task.id],
    ).length;
    const available = isQuestAvailableForProfile(quest, syncProfile, questsById);

    const giveItemObjectives = quest.objectives.filter(isGiveItemObjective);
    const allHandInItems = [
        ...new Map(
            giveItemObjectives.flatMap((o) =>
                o.items.map((item) => [item.id, { ...item, count: o.count, fir: o.foundInRaid }]),
            ),
        ).values(),
    ];

    return (
        <div
            id={`quest-${quest.id}`}
            className={`border overflow-hidden transition-colors ${
                attachedTop ? "rounded-b-md rounded-t-none" : "rounded-md"
            } ${
                highlighted
                    ? "border-tarkov-green shadow-[0_0_0_1px_rgba(157,255,0,0.18)]"
                    : completed
                    ? "border-white/5 bg-black/10"
                    : ignored
                    ? "border-white/8 bg-black/20"
                    : pinned
                    ? "border-sky-500/20 bg-[linear-gradient(90deg,rgba(56,189,248,0.16)_0%,rgba(56,189,248,0.08)_30%,rgba(17,17,17,0.95)_72%)] hover:border-sky-400/30"
                    : "border-white/10 hover:border-white/15"
            } ${
                completed
                    ? "bg-black/10"
                    : ignored
                    ? "bg-black/20"
                    : pinned
                    ? "bg-[linear-gradient(90deg,rgba(56,189,248,0.16)_0%,rgba(56,189,248,0.08)_30%,rgba(17,17,17,0.95)_72%)]"
                    : "bg-[#111111]"
            }`}
        >
            {/* Header row */}
            <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                onClick={() => setExpanded((v) => !v)}
            >
                {/* Completion toggle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleQuestCompletion(quest.id);
                    }}
                    className="group relative shrink-0 -ml-3 -my-2.5 w-11 h-11 flex items-center justify-center cursor-pointer"
                >
                    <Circle
                        size={16}
                        className={`absolute transition-opacity duration-200 text-gray-600 ${
                            completed ? "opacity-0" : "opacity-100 group-hover:opacity-0"
                        }`}
                    />
                    <CheckCircle
                        size={16}
                        className={`absolute transition-all duration-200 ${
                            completed
                                ? "opacity-100 text-tarkov-green"
                                : "opacity-0 group-hover:opacity-100 text-gray-500"
                        }`}
                    />
                </button>

                {/* Trader avatar */}
                {quest.trader.image4xLink ?? quest.trader.imageLink ? (
                    <img
                        src={quest.trader.image4xLink ?? quest.trader.imageLink ?? ""}
                        alt={quest.trader.name}
                        className="w-6 h-6 rounded-full shrink-0 object-cover"
                    />
                ) : (
                    <div className="w-6 h-6 rounded-full shrink-0 bg-white/10 flex items-center justify-center text-[10px] text-gray-400">
                        {quest.trader.name[0]}
                    </div>
                )}

                {/* Quest name */}
                <div className="flex flex-1 items-center gap-1.5 min-w-0">
                    <span
                        className={`min-w-0 truncate text-sm font-medium leading-tight ${
                            completed ? "text-gray-600 line-through" : "text-white"
                        }`}
                    >
                        {quest.name}
                    </span>
                    <span
                        className={`${questMetaChipBaseClass} shrink-0 ${
                            completed
                                ? "text-tarkov-green/80 bg-tarkov-green/10 border-tarkov-green/20"
                                : ignored
                                ? "text-gray-400 bg-black/50 border-white/10"
                                : available
                                ? "text-blue-400/80 bg-blue-400/10 border-blue-400/20"
                                : "border-transparent bg-transparent px-0 text-red-300"
                        }`}
                    >
                        {completed
                            ? "Completed"
                            : ignored
                            ? "Ignored"
                            : available
                            ? "Available"
                            : <Lock size={12} strokeWidth={2.25} aria-label="Locked" />}
                    </span>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1 shrink-0">
                    {quest.taskRequirements.length > 0 && (
                        <span
                            className={`${questMetaChipBaseClass} hidden text-gray-400 bg-black/40 border-white/10 md:inline-flex`}
                            title={`${completedRequirementCount}/${quest.taskRequirements.length} prerequisite quests completed`}
                        >
                            {completedRequirementCount}/{quest.taskRequirements.length} reqs
                        </span>
                    )}
                    {quest.minPlayerLevel != null && (
                        <span
                            className={`${questMetaChipBaseClass} hidden text-gray-400 bg-black/40 border-white/10 sm:inline-flex`}
                        >
                            Lv.{quest.minPlayerLevel}
                        </span>
                    )}
                    {quest.map && (
                        <span
                            className={`${questMetaChipBaseClass} hidden text-gray-400 bg-black/40 border-white/10 sm:inline-flex`}
                        >
                            {quest.map.name}
                        </span>
                    )}
                    {quest.kappaRequired && (
                        <span
                            className={`${questMetaChipBaseClass} text-yellow-500/80 bg-yellow-500/10 border-yellow-500/20`}
                            title="Required for Kappa"
                        >
                            Kappa
                        </span>
                    )}
                    {quest.lightkeeperRequired && (
                        <span
                            className={`${questMetaChipBaseClass} text-teal-400/80 bg-teal-400/10 border-teal-400/20`}
                            title="Required for Lightkeeper"
                        >
                            LK
                        </span>
                    )}
                    {(quest.factionName === "USEC" || quest.factionName === "BEAR") && (
                        <span
                            className={`${questMetaChipBaseClass} ${
                                quest.factionName === "USEC"
                                    ? "text-blue-400/80 bg-blue-400/10 border-blue-400/20"
                                    : "text-red-400/80 bg-red-400/10 border-red-400/20"
                            }`}
                        >
                            {quest.factionName}
                        </span>
                    )}
                    {quest.traderRequirements.map((req) => (
                        <span
                            key={req.id}
                            className={`${questMetaChipBaseClass} text-cyan-400/80 bg-cyan-400/10 border-cyan-400/20`}
                            title={`${req.trader.name} loyalty ${req.compareMethod} ${req.value}`}
                        >
                            {req.trader.name} LL{req.value}
                        </span>
                    ))}
                    {quest.requiredPrestige && (
                        <span
                            className={`${questMetaChipBaseClass} text-purple-400/80 bg-purple-400/10 border-purple-400/20`}
                            title={`Requires prestige ${quest.requiredPrestige.prestigeLevel}`}
                        >
                            P{quest.requiredPrestige.prestigeLevel}
                        </span>
                    )}
                </div>

                {showDebugButton && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setDebugOpen((v) => !v);
                        }}
                        className={`shrink-0 transition-colors ${
                            debugOpen ? "text-yellow-500" : "text-gray-700 hover:text-gray-500"
                        }`}
                        title="Toggle raw JSON"
                    >
                        <Braces size={13} />
                    </button>
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        togglePinnedQuest(quest.id);
                    }}
                    className={`shrink-0 rounded-md p-1.5 transition-all ${
                        pinned
                            ? "text-sky-300 bg-sky-500/12 shadow-[0_0_18px_rgba(56,189,248,0.24)]"
                            : "text-gray-500 hover:text-sky-300 hover:bg-sky-500/8"
                    }`}
                    title={pinned ? "Unpin quest" : "Pin quest"}
                >
                    <Pin size={16} className={pinned ? "fill-current" : ""} />
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleIgnoredQuest(quest.id);
                    }}
                    className={`shrink-0 rounded-md p-1.5 transition-all ${
                        ignored
                            ? "text-red-300 bg-red-500/12 shadow-[0_0_18px_rgba(239,68,68,0.18)]"
                            : "text-gray-500 hover:text-red-300 hover:bg-red-500/8"
                    }`}
                    title={ignored ? "Stop ignoring quest" : "Ignore quest"}
                >
                    <CircleSlash size={16} className={ignored ? "stroke-[2.25]" : ""} />
                </button>

                {expanded ? (
                    <ChevronDown size={14} className="text-gray-500 shrink-0" />
                ) : (
                    <ChevronRight size={14} className="text-gray-500 shrink-0" />
                )}
            </div>

            {/* Compact item strip */}
            {!expanded && allHandInItems.length > 0 && (
                <div className="flex items-center gap-1 px-3 pb-2.5 pl-[52px]">
                    {allHandInItems.slice(0, 10).map((item) => (
                        <div
                            key={item.id}
                            className={`relative ${onItemClick ? "cursor-pointer" : ""}`}
                            title={`${item.name} x${item.count}${item.fir ? " (FiR)" : ""}${onItemClick ? " — click to view" : ""}`}
                            onClick={onItemClick ? (e) => { e.stopPropagation(); onItemClick(item.id); } : undefined}
                        >
                            <img
                                src={item.iconLink ?? item.gridImageLink ?? ""}
                                alt={item.name}
                                className={`w-8 h-8 object-contain rounded bg-black/40 transition-opacity ${
                                    onItemClick ? "hover:opacity-75" : ""
                                } ${
                                    item.fir
                                        ? "ring-1 ring-orange-500"
                                        : "border border-white/10"
                                }`}
                            />
                            {item.fir && (
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
                            )}
                        </div>
                    ))}
                    {allHandInItems.length > 10 && (
                        <span className="text-xs text-gray-600">+{allHandInItems.length - 10}</span>
                    )}
                </div>
            )}

            {/* Expanded content */}
            {expanded && (
                <div className="border-t border-white/5 px-3 py-3 space-y-3">
                    {/* Objectives */}
                    <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                            Objectives
                        </span>
                        <div className="space-y-1.5">
                            {quest.objectives.map((obj) => (
                                <ObjectiveRow key={obj.id} objective={obj} onItemClick={onItemClick ?? undefined} />
                            ))}
                        </div>
                    </div>

                    {(quest.minPlayerLevel != null || quest.taskRequirements.length > 0) && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                                Requirements
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {quest.minPlayerLevel != null && (
                                    <span
                                        className={`${questMetaChipBaseClass} text-gray-400 bg-black/40 border-white/10`}
                                    >
                                        Requires Level {quest.minPlayerLevel}
                                    </span>
                                )}
                                {quest.taskRequirements.length > 0 && (
                                    <span
                                        className={`${questMetaChipBaseClass} text-gray-400 bg-black/40 border-white/10`}
                                    >
                                        {completedRequirementCount}/{quest.taskRequirements.length} prerequisite quests completed
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Prerequisites */}
                    {prerequisiteQuests.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                                Requires
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {prerequisiteQuests.map((ref) => (
                                    <QuestChip
                                        key={ref.id}
                                        questRef={ref}
                                        onQuestLinkClick={onQuestLinkClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Leads to */}
                    {leadsToQuests.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                                Unlocks
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {leadsToQuests.map((ref) => (
                                    <QuestChip
                                        key={ref.id}
                                        questRef={ref}
                                        onQuestLinkClick={onQuestLinkClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="text-xs text-gray-600">
                            {quest.experience.toLocaleString()} XP
                        </span>
                        <div className="flex items-center gap-3">
                            {quest.map && (
                                <span className="text-xs text-gray-500">{quest.map.name}</span>
                            )}
                            {quest.wikiLink && (
                                <a
                                    href={quest.wikiLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-tarkov-green transition-colors"
                                >
                                    Wiki <ExternalLink size={11} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Debug JSON panel */}
            {debugOpen && (
                <div className="border-t border-yellow-500/20 bg-black/60">
                    <pre className="text-[11px] font-mono text-gray-400 leading-relaxed overflow-x-auto max-h-96 p-3 overflow-y-auto">
                        {JSON.stringify(quest, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
