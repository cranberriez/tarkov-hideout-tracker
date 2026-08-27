"use client";

import { ChevronLeft, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import { getQuestObjectiveSummary } from "./quest-workspace-utils";

export function RaidPlannerPane() {
    const {
        maps,
        plannerMapKey,
        selectPlannerMap,
        clearPlannerMap,
        filteredQuests,
        markerByQuestId,
        highlightedQuestId,
        setHighlightedQuestId,
        setSelectedQuestId,
    } = useQuestWorkspace();
    const selectedMap = maps.find((map) => map.key === plannerMapKey) ?? null;
    const plannerQuests = selectedMap
        ? filteredQuests.filter((quest) =>
              getQuestMapGroupsForQuest(quest).some((map) => map.key === selectedMap.key),
          )
        : [];

    const focusQuest = (questId: string | null) => {
        setHighlightedQuestId(questId);
        if (questId) {
            document
                .getElementById(`quest-workspace-${questId}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    if (!selectedMap) {
        return (
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b0c0e] p-6 sm:p-10">
                <div className="mx-auto max-w-3xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-tarkov-green">
                        Raid planner
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold text-white">
                        Where are you heading?
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                        Choose a map to focus the quest log and build a visual checklist for
                        the raid. Marker locations are placeholders until coordinate data is
                        connected.
                    </p>
                    <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {maps.map((map) => (
                            <button
                                type="button"
                                key={map.key}
                                onClick={() => selectPlannerMap(map.key)}
                                className="group flex min-h-24 items-end border border-white/8 bg-[radial-gradient(circle_at_75%_25%,#272a30,#121316_65%)] p-4 text-left transition-all hover:border-tarkov-green/40 hover:bg-tarkov-green/5"
                            >
                                <span>
                                    <span className="block text-sm font-semibold text-gray-200 group-hover:text-white">
                                        {map.name}
                                    </span>
                                    <span className="mt-1 block text-[10px] uppercase tracking-wider text-gray-600">
                                        Plan this map
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#111316]">
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
                    backgroundSize: "42px 42px",
                }}
            />
            <div className="absolute inset-6 border border-dashed border-white/8" />
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-gray-800">
                <MapPinned size={42} />
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em]">
                    Map surface placeholder
                </span>
            </div>

            <button
                type="button"
                onClick={clearPlannerMap}
                className="absolute left-3 top-3 z-30 inline-flex items-center gap-2 border border-white/12 bg-black/80 px-3 py-2 text-xs font-medium text-gray-200 shadow-xl backdrop-blur-sm transition-colors hover:border-tarkov-green/40 hover:text-tarkov-green"
            >
                <ChevronLeft size={14} /> {selectedMap.name}
            </button>

            {plannerQuests.map((quest) => {
                const marker = markerByQuestId.get(quest.id);
                if (!marker) return null;
                return (
                    <QuestMarker
                        key={quest.id}
                        questName={quest.name}
                        summary={getQuestObjectiveSummary(quest)}
                        label={marker.label}
                        color={marker.color}
                        x={marker.x}
                        y={marker.y}
                        active={highlightedQuestId === quest.id}
                        onEnter={() => focusQuest(quest.id)}
                        onLeave={() => focusQuest(null)}
                        onSelect={() => {
                            setSelectedQuestId(quest.id);
                            focusQuest(quest.id);
                        }}
                    />
                );
            })}

            <div className="absolute bottom-3 left-3 border border-white/8 bg-black/70 px-3 py-2 text-[10px] leading-relaxed text-gray-500 backdrop-blur-sm">
                Markers are deterministic placeholders.
                <br />
                Hover or focus one to find its quest.
            </div>
        </div>
    );
}

function QuestMarker({
    questName,
    summary,
    label,
    color,
    x,
    y,
    active,
    onEnter,
    onLeave,
    onSelect,
}: {
    questName: string;
    summary: string;
    label: string;
    color: string;
    x: number;
    y: number;
    active: boolean;
    onEnter: () => void;
    onLeave: () => void;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={`${label}: ${questName}: ${summary}`}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onFocus={onEnter}
            onBlur={onLeave}
            onClick={onSelect}
            className={cn(
                "group absolute z-10 flex min-h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-black/85 px-2 font-mono text-xs font-bold shadow-lg outline-none transition-transform hover:scale-125 focus-visible:scale-125",
                active && "scale-125 ring-2 ring-white/50",
            )}
            style={{ left: `${x}%`, top: `${y}%`, color, borderColor: color }}
        >
            {label}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 border border-white/12 bg-[#111214]/95 p-3 text-left font-sans font-normal shadow-2xl backdrop-blur group-hover:block group-focus-visible:block">
                <span className="block text-xs font-semibold text-white">{questName}</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-gray-400">
                    {summary}
                </span>
            </span>
        </button>
    );
}
