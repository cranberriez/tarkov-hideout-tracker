"use client";

import { ChevronLeft } from "lucide-react";
import { MapViewer } from "@/features/maps/MapViewer";
import type { MapViewTransform } from "@/features/maps/map-view-transform";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import { buildRaidPlannerMarkers, questHasRenderedLocation } from "./raid-planner-markers";

interface RaidPlannerPaneProps {
    rememberedView: MapViewTransform | null;
    onViewChange: (mapKey: string, view: MapViewTransform | null) => void;
}

export function RaidPlannerPane({ rememberedView, onViewChange }: RaidPlannerPaneProps) {
    const {
        maps, plannerMapKey, selectPlannerMap, clearPlannerMap, filteredQuests,
        markerByQuestId, highlightedQuestId, setHighlightedQuestId, setSelectedQuestId,
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
            document.getElementById(`quest-workspace-${questId}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    if (!selectedMap) {
        return (
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b0c0e] p-6 sm:p-10">
                <div className="mx-auto max-w-3xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-tarkov-green">Raid planner</p>
                    <h1 className="mt-2 text-3xl font-semibold text-white">Where are you heading?</h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                        Choose a map to see precise locations for the matching quest objectives.
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
                                    <span className="block text-sm font-semibold text-gray-200 group-hover:text-white">{map.name}</span>
                                    <span className="mt-1 block text-[10px] uppercase tracking-wider text-gray-600">Plan this map</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const markers = buildRaidPlannerMarkers(plannerQuests, selectedMap.key, markerByQuestId);
    const unavailableQuests = plannerQuests.filter((quest) => !questHasRenderedLocation(quest, selectedMap.key));

    return (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#111316]">
            <MapViewer
                mapKey={selectedMap.key}
                markers={markers}
                rememberedView={rememberedView}
                onViewChange={(view) => onViewChange(selectedMap.key, view)}
                highlightedQuestId={highlightedQuestId}
                topRightContent={(
                    <div className="max-w-64 border border-white/10 bg-black/80 px-3 py-2 text-[10px] shadow-xl backdrop-blur-sm">
                        <p className="font-semibold uppercase tracking-wider text-gray-300">
                            {markers.length} mapped location{markers.length === 1 ? "" : "s"}
                        </p>
                        {unavailableQuests.length > 0 && (
                            <details className="mt-1 text-gray-500">
                                <summary className="cursor-pointer hover:text-gray-300">Location unavailable · {unavailableQuests.length}</summary>
                                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto border-t border-white/8 pt-2">
                                    {unavailableQuests.map((quest) => <li key={quest.id}>{quest.name}</li>)}
                                </ul>
                            </details>
                        )}
                    </div>
                )}
                onMarkerFocus={(marker) => focusQuest(marker?.questId ?? null)}
                onMarkerSelect={(marker) => {
                    if (!marker.questId) return;
                    setSelectedQuestId(marker.questId);
                    focusQuest(marker.questId);
                }}
            />
            <button
                type="button"
                onClick={clearPlannerMap}
                className="absolute left-3 top-3 z-30 inline-flex items-center gap-2 border border-white/12 bg-black/80 px-3 py-2 text-xs font-medium text-gray-200 shadow-xl backdrop-blur-sm transition-colors hover:border-tarkov-green/40 hover:text-tarkov-green"
            >
                <ChevronLeft size={14} /> {selectedMap.name}
            </button>
        </div>
    );
}
