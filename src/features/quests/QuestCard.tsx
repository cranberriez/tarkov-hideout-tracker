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
} from "lucide-react";
import type {
    FullQuest,
    FullQuestObjective,
    QuestObjectiveItemType,
    QuestObjectiveShootType,
    QuestObjectiveExtractType,
} from "@/types";
import { useUserStore } from "@/lib/stores/useUserStore";

interface QuestCardProps {
    quest: FullQuest;
    prerequisiteNames: string[];
    leadsToNames: string[];
}

function isItemObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
    return (o.type === "giveItem" || o.type === "findItem") && "items" in o;
}

function isShootObjective(o: FullQuestObjective): o is QuestObjectiveShootType {
    return o.type === "shoot" && "target" in o;
}

function isExtractObjective(o: FullQuestObjective): o is QuestObjectiveExtractType {
    return o.type === "extract" && "exitName" in o;
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

function ObjectiveRow({ objective }: { objective: FullQuestObjective }) {
    const item = isItemObjective(objective) ? objective : null;
    const shoot = isShootObjective(objective) ? objective : null;

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
                    <div className="flex flex-wrap gap-1">
                        {item.items.map((itm) => (
                            <div
                                key={itm.id}
                                className={`flex items-center gap-1 bg-black/40 rounded px-1.5 py-0.5 ${
                                    item.foundInRaid
                                        ? "ring-1 ring-orange-500"
                                        : "border border-white/10"
                                }`}
                            >
                                {(itm.iconLink ?? itm.gridImageLink) && (
                                    <img
                                        src={itm.iconLink ?? itm.gridImageLink ?? ""}
                                        alt={itm.name}
                                        className="w-4 h-4 object-contain"
                                    />
                                )}
                                <span className="text-[10px] text-gray-300">{itm.name}</span>
                                <span className="text-[10px] text-gray-500">×{item.count}</span>
                                {item.foundInRaid && (
                                    <span className="text-[9px] text-orange-400 font-medium">
                                        FiR
                                    </span>
                                )}
                            </div>
                        ))}
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

export function QuestCard({ quest, prerequisiteNames, leadsToNames }: QuestCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [debugOpen, setDebugOpen] = useState(false);
    const { completedQuests, toggleQuestCompletion } = useUserStore();
    const completed = !!completedQuests[quest.id];

    const giveItemObjectives = quest.objectives.filter(isItemObjective);
    const allHandInItems = [
        ...new Map(
            giveItemObjectives.flatMap((o) =>
                o.items.map((item) => [item.id, { ...item, count: o.count, fir: o.foundInRaid }]),
            ),
        ).values(),
    ];

    return (
        <div
            className={`border rounded-md overflow-hidden transition-colors ${
                completed
                    ? "border-white/5 bg-black/10"
                    : "border-white/10 bg-[#111111] hover:border-white/15"
            }`}
        >
            {/* Header row */}
            <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                onClick={() => setExpanded((v) => !v)}
            >
                {/* Completion toggle — 44×44 hit area absorbs the row's px-3 py-2.5 padding */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleQuestCompletion(quest.id);
                    }}
                    className="group relative -ml-3 -my-2.5 w-11 h-11 flex items-center justify-center shrink-0 cursor-pointer"
                >
                    <Circle
                        size={16}
                        className={`absolute transition-opacity duration-200 text-gray-600 ${completed ? "opacity-0" : "opacity-100 group-hover:opacity-0"}`}
                    />
                    <CheckCircle
                        size={16}
                        className={`absolute transition-all duration-200 ${completed ? "opacity-100 text-tarkov-green" : "opacity-0 group-hover:opacity-100 text-gray-500"}`}
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
                <span
                    className={`flex-1 text-sm font-medium leading-tight min-w-0 truncate ${
                        completed ? "text-gray-600 line-through" : "text-white"
                    }`}
                >
                    {quest.name}
                </span>

                {/* Badges */}
                <div className="flex items-center gap-1 shrink-0">
                    {quest.minPlayerLevel != null && (
                        <span className="text-[10px] text-gray-400 bg-black/40 border border-white/10 px-1.5 py-0.5 rounded">
                            Lv.{quest.minPlayerLevel}
                        </span>
                    )}
                    {quest.map && (
                        <span className="text-[10px] text-gray-400 bg-black/40 border border-white/10 px-1.5 py-0.5 rounded hidden sm:inline">
                            {quest.map.name}
                        </span>
                    )}
                    {quest.kappaRequired && (
                        <span
                            className="text-[10px] text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded"
                            title="Required for Kappa"
                        >
                            κ
                        </span>
                    )}
                    {quest.lightkeeperRequired && (
                        <span
                            className="text-[10px] text-teal-400/80 bg-teal-400/10 border border-teal-400/20 px-1.5 py-0.5 rounded"
                            title="Required for Lightkeeper"
                        >
                            LK
                        </span>
                    )}
                    {quest.factionName && (
                        <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
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
                            className="text-[10px] text-cyan-400/80 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded"
                            title={`${req.trader.name} loyalty ${req.compareMethod} ${req.value}`}
                        >
                            {req.trader.name} LL{req.value}
                        </span>
                    ))}
                    {quest.requiredPrestige && (
                        <span
                            className="text-[10px] text-purple-400/80 bg-purple-400/10 border border-purple-400/20 px-1.5 py-0.5 rounded"
                            title={`Requires prestige ${quest.requiredPrestige.prestigeLevel}`}
                        >
                            P{quest.requiredPrestige.prestigeLevel}
                        </span>
                    )}
                </div>

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
                            className="relative"
                            title={`${item.name} ×${item.count}${item.fir ? " (FiR)" : ""}`}
                        >
                            <img
                                src={item.iconLink ?? item.gridImageLink ?? ""}
                                alt={item.name}
                                className={`w-8 h-8 object-contain rounded bg-black/40 ${
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
                                <ObjectiveRow key={obj.id} objective={obj} />
                            ))}
                        </div>
                    </div>

                    {/* Prerequisites */}
                    {prerequisiteNames.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                                Requires
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {prerequisiteNames.map((name) => (
                                    <span
                                        key={name}
                                        className="text-xs text-gray-400 bg-black/40 border border-white/10 px-2 py-0.5 rounded"
                                    >
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Leads to */}
                    {leadsToNames.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                                Unlocks
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {leadsToNames.map((name) => (
                                    <span
                                        key={name}
                                        className="text-xs text-gray-400 bg-black/40 border border-white/10 px-2 py-0.5 rounded"
                                    >
                                        {name}
                                    </span>
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
