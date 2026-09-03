"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Crosshair, KeyRound, Maximize2, Minimize2, X } from "lucide-react";
import Image from "next/image";
import { MapViewer } from "@/features/maps/MapViewer";
import type { MapViewTransform } from "@/features/maps/map-view-transform";
import type { MapOverlayMarker } from "@/types/maps";
import type { ItemSummary } from "@/types/items";
import { useUserStore } from "@/lib/stores/useUserStore";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { useQuestsContext } from "../QuestsContext";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import { buildRaidPlannerMarkers } from "./raid-planner-markers";
import { OBJECTIVE_CATEGORY_SHORT_LABELS } from "./quest-workspace-utils";
import {
    buildRaidPlannerKillList,
    buildRaidPlannerMapSummary,
    buildRaidPlannerObjectiveKeyIndex,
    getActiveRaidPlannerQuests,
    getRaidPlannerMarkerKeys,
} from "./raid-planner-summary";

interface RaidPlannerPaneProps {
    rememberedView: MapViewTransform | null;
    onViewChange: (mapKey: string, view: MapViewTransform | null) => void;
}

export function RaidPlannerPane({ rememberedView, onViewChange }: RaidPlannerPaneProps) {
    const { itemById } = useQuestsContext();
    const [isKillListOpen, setIsKillListOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [navigationMarkers, setNavigationMarkers] = useState<{
        mapKey: string;
        markers: MapOverlayMarker[];
    } | null>(null);
    const completedQuestObjectives = useUserStore((state) => state.completedQuestObjectives);
    const toggleQuestObjectiveCompletion = useUserStore((state) => state.toggleQuestObjectiveCompletion);
    const {
        quests, maps, plannerMapKey, selectPlannerMap, clearPlannerMap, statusByQuestId,
        markerByQuestId, highlightedQuestId, setHighlightedQuestId, setSelectedQuestId, setMode,
    } = useQuestWorkspace();
    const exitPlanner = () => {
        setIsFullScreen(false);
        setSelectedQuestId(null);
        setMode("details");
    };
    const activeQuests = useMemo(
        () => getActiveRaidPlannerQuests(quests, statusByQuestId),
        [quests, statusByQuestId],
    );
    const selectedMap = useMemo(
        () => maps.find((map) => map.key === plannerMapKey) ?? null,
        [maps, plannerMapKey],
    );
    const selectedMapKey = selectedMap?.key;
    const plannerQuests = useMemo(() => selectedMap
        ? activeQuests.filter((quest) =>
            getQuestMapGroupsForQuest(quest).some((map) => map.key === selectedMap.key),
        )
        : [], [activeQuests, selectedMap]);
    const markers = useMemo(() => selectedMap ? [
        ...buildRaidPlannerMarkers(plannerQuests, selectedMap.key, markerByQuestId, completedQuestObjectives),
        ...(navigationMarkers?.mapKey === selectedMap.key ? navigationMarkers.markers : []),
    ] : [], [completedQuestObjectives, markerByQuestId, navigationMarkers, plannerQuests, selectedMap]);
    const killObjectives = useMemo(
        () => buildRaidPlannerKillList(plannerQuests),
        [plannerQuests],
    );
    const objectiveKeyIndex = useMemo(
        () => buildRaidPlannerObjectiveKeyIndex(plannerQuests),
        [plannerQuests],
    );
    const completableQuestIds = useMemo(
        () => new Set(plannerQuests.filter((quest) => quest.objectives.length > 1).map((quest) => quest.id)),
        [plannerQuests],
    );

    useEffect(() => {
        document.body.classList.toggle("quest-raid-planner-fullscreen", isFullScreen);
        return () => document.body.classList.remove("quest-raid-planner-fullscreen");
    }, [isFullScreen]);

    useEffect(() => {
        if (!selectedMapKey) return;
        const controller = new AbortController();
        fetch(`/api/maps/overlays/${encodeURIComponent(selectedMapKey)}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) return { markers: [] };
                return response.json() as Promise<{ markers: MapOverlayMarker[] }>;
            })
            .then(({ markers }) => setNavigationMarkers({ mapKey: selectedMapKey, markers }))
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setNavigationMarkers({ mapKey: selectedMapKey, markers: [] });
            });
        return () => controller.abort();
    }, [selectedMapKey]);

    const focusQuest = (questId: string | null) => {
        setHighlightedQuestId(questId);
        if (questId) {
            document.getElementById(`quest-workspace-${questId}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    if (!selectedMap) {
        return (
            <div className="flex min-h-0 flex-1 flex-col bg-[#0b0c0e]">
                <button
                    type="button"
                    onClick={exitPlanner}
                    className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#101113] px-4 text-xs font-medium text-gray-300 transition-colors hover:text-white lg:hidden"
                >
                    <ChevronLeft size={16} /> Back to quests
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-tarkov-green">Raid planner</p>
                    <h1 className="mt-2 text-3xl font-semibold text-white">Where are you heading?</h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                        Choose a map to review your active quest objectives, required keys, and precise locations.
                    </p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {maps.map((map) => {
                            const summary = buildRaidPlannerMapSummary(activeQuests, map.key);
                            return (
                                <RaidPlannerMapCard
                                    key={map.key}
                                    mapKey={map.key}
                                    mapName={map.name}
                                    summary={summary}
                                    itemById={itemById}
                                    onSelect={() => selectPlannerMap(map.key)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#111316]">
            <MapViewer
                mapKey={selectedMap.key}
                markers={markers}
                rememberedView={rememberedView}
                onViewChange={(view) => onViewChange(selectedMap.key, view)}
                highlightedQuestId={highlightedQuestId}
                canCompleteMarker={(marker) => !!marker.questId && completableQuestIds.has(marker.questId)}
                onMarkerComplete={(marker) => {
                    if (!marker.questId) return;
                    const questId = marker.questId;
                    marker.objectiveIds?.forEach((objectiveId) => {
                        toggleQuestObjectiveCompletion(questId, objectiveId);
                    });
                }}
                renderMarkerDetails={(marker) => {
                    const requiredKeys = getRaidPlannerMarkerKeys(marker.objectiveIds, objectiveKeyIndex)
                        .map((itemId) => itemById[itemId])
                        .filter(Boolean);
                    if (requiredKeys.length === 0) return null;
                    return (
                        <span className="mt-3 block border-t border-white/10 pt-2.5">
                            <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">
                                <KeyRound size={10} /> Required keys
                            </span>
                            <span className="mt-2 flex flex-wrap gap-1.5">
                                {requiredKeys.map((key) => <RaidPlannerKey key={key.id} item={key} />)}
                            </span>
                        </span>
                    );
                }}
                onMarkerSelect={(marker) => {
                    if (!marker.questId) return;
                    setSelectedQuestId(marker.questId);
                    focusQuest(marker.questId);
                }}
                topRightContent={(
                    <button
                        type="button"
                        onClick={exitPlanner}
                        className="inline-flex items-center gap-1.5 border border-red-400/30 bg-red-950/80 px-2.5 py-1.5 text-[10px] font-semibold text-red-200 shadow-xl backdrop-blur-sm lg:hidden"
                    >
                        <X size={12} /> Exit
                    </button>
                )}
                bottomRightContent={(
                    <button
                        type="button"
                        aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
                        aria-pressed={isFullScreen}
                        onClick={() => setIsFullScreen((fullScreen) => !fullScreen)}
                        className="hidden border border-white/10 bg-black/80 p-2 text-gray-300 shadow-xl backdrop-blur-sm transition-colors hover:text-white lg:flex"
                        title={isFullScreen ? "Exit full screen" : "Full screen"}
                    >
                        {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                )}
                compactAttribution
                attributionPlacement="navigation-controls"
            />
            <div className="absolute left-3 top-3 z-30 flex w-80 max-w-[calc(100%_-_1.5rem)] flex-col items-start gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setIsFullScreen(false);
                        setIsKillListOpen(false);
                        clearPlannerMap();
                    }}
                    className="inline-flex items-center gap-2 border border-white/12 bg-black/80 px-3 py-2 text-xs font-medium text-gray-200 shadow-xl backdrop-blur-sm transition-colors hover:border-tarkov-green/40 hover:text-tarkov-green"
                >
                    <ChevronLeft size={14} /> {selectedMap.name}
                </button>
                <button
                    type="button"
                    aria-expanded={isKillListOpen}
                    aria-controls="raid-planner-kill-list"
                    onClick={() => setIsKillListOpen((open) => !open)}
                    className="inline-flex items-center gap-2 border border-red-400/25 bg-red-950/75 px-3 py-2 text-xs font-medium text-red-100 shadow-xl backdrop-blur-sm transition-colors hover:border-red-300/45 hover:bg-red-950/90"
                >
                    <Crosshair size={14} className="text-red-300/80" />
                    Kill List
                    <span className="text-[10px] text-red-200/50">{killObjectives.length}</span>
                </button>
                {isKillListOpen && (
                    <div
                        id="raid-planner-kill-list"
                        className="max-h-[min(60vh,32rem)] w-full overflow-y-auto border border-red-400/20 bg-[#130d0e]/95 shadow-2xl backdrop-blur-md"
                    >
                        {killObjectives.length > 0 ? (
                            <div className="divide-y divide-red-200/8">
                                {killObjectives.map((objective) => (
                                    <div
                                        key={`${objective.questId}:${objective.objectiveId}`}
                                        title={objective.fullDescription}
                                        className={objective.optional ? "px-3 py-2.5 opacity-55" : "px-3 py-2.5"}
                                    >
                                        <div className="flex items-start gap-2">
                                            <Crosshair size={12} className="mt-0.5 shrink-0 text-red-300/65" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-semibold leading-4 text-red-100/90">
                                                    {objective.summary}
                                                </p>
                                                <p className="mt-0.5 truncate text-[9px] text-gray-500">
                                                    {objective.questName}{objective.optional ? " · Optional" : ""}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-3 py-3 text-[10px] text-gray-500">No active kill objectives on this map.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function RaidPlannerMapCard({
    mapKey,
    mapName,
    summary,
    itemById,
    onSelect,
}: {
    mapKey: string;
    mapName: string;
    summary: ReturnType<typeof buildRaidPlannerMapSummary>;
    itemById: Readonly<Record<string, ItemSummary>>;
    onSelect: () => void;
}) {
    const [artworkAvailable, setArtworkAvailable] = useState(true);

    return (
        <button
            type="button"
            onClick={onSelect}
            className="group relative min-h-44 overflow-hidden border border-white/8 bg-[#121316] p-3 text-left transition-all hover:border-tarkov-green/40 hover:bg-[#151917] lg:min-h-56 lg:p-4"
        >
            {artworkAvailable && (
                <Image
                    src={`/api/maps/render/${encodeURIComponent(mapKey)}/svg`}
                    alt=""
                    aria-hidden="true"
                    width={224}
                    height={176}
                    unoptimized
                    onError={() => setArtworkAvailable(false)}
                    className="pointer-events-none absolute -right-8 -top-8 h-44 w-56 object-contain opacity-20 grayscale transition-all duration-300 group-hover:scale-105 group-hover:opacity-30 group-hover:grayscale-0"
                />
            )}
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(18,19,22,1)_18%,rgba(18,19,22,.9)_52%,rgba(18,19,22,.35))]" />
            <span className="relative flex h-full min-h-36 flex-col pb-5 lg:min-h-48 lg:pb-0">
                <span className="block pr-16 text-base font-semibold text-gray-100 group-hover:text-white">{mapName}</span>
                <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-tarkov-green/75">
                    {summary.questCount} active quest{summary.questCount === 1 ? "" : "s"}
                </span>

                {summary.objectiveGroups.length > 0 ? (
                    <span className="mt-3 flex flex-wrap gap-1.5 lg:mt-4">
                        {summary.objectiveGroups.map((group) => (
                            <span
                                key={group.category}
                                className="inline-flex items-center gap-1.5 border border-white/10 bg-black/35 px-2 py-1 text-[10px] text-gray-300"
                            >
                                {OBJECTIVE_CATEGORY_SHORT_LABELS[group.category]}
                                <span className="text-gray-500">{group.questCount}</span>
                                {group.keyedQuestCount > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-amber-300/80" title={`${group.keyedQuestCount} quest${group.keyedQuestCount === 1 ? "" : "s"} require keys`}>
                                        <KeyRound size={9} /> {group.keyedQuestCount}
                                    </span>
                                )}
                            </span>
                        ))}
                    </span>
                ) : (
                    <span className="mt-3 text-xs text-gray-600 lg:mt-4">No active objectives on this map.</span>
                )}

                {summary.requiredKeyIds.length > 0 && (
                    <span className="mt-2.5 block lg:mt-4">
                        <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300/70">
                            <KeyRound size={10} /> Required keys
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5 lg:mt-2">
                            {summary.requiredKeyIds.map((itemId) => itemById[itemId]).filter(Boolean).map((key) => (
                                <RaidPlannerKey key={key.id} item={key} />
                            ))}
                        </span>
                    </span>
                )}

                <span className="absolute bottom-0 right-0 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500 transition-colors group-hover:text-tarkov-green">
                    Plan this map <ChevronRight size={11} />
                </span>
            </span>
        </button>
    );
}

function RaidPlannerKey({ item }: { item: ItemSummary }) {
    const image = item.gridImageLink ?? item.iconLink;

    return (
        <span
            title={item.name}
            aria-label={item.name}
            className="relative h-11 w-11 shrink-0 overflow-hidden lg:h-16 lg:w-16"
        >
            {image ? (
                <Image
                    src={image}
                    alt=""
                    aria-hidden="true"
                    width={64}
                    height={64}
                    className="absolute inset-0 h-full w-full object-cover"
                />
            ) : (
                <KeyRound size={28} className="absolute inset-0 m-auto text-gray-600 lg:h-[34px] lg:w-[34px]" />
            )}
        </span>
    );
}
