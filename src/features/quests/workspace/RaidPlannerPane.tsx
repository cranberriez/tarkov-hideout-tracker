"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Crosshair, KeyRound, Maximize2, Minimize2, X } from "lucide-react";
import Image from "next/image";
import { MapViewer } from "@/features/maps/MapViewer";
import type { MapViewTransform } from "@/features/maps/map-view-transform";
import type { MapOverlayMarker } from "@/types/maps";
import type { ItemSummary } from "@/types/items";
import { useUserStore } from "@/lib/stores/useUserStore";
import { mapOverlaysQueryOptions } from "@/lib/query/maps";
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

const EMPTY_NAVIGATION_MARKERS: MapOverlayMarker[] = [];

export function RaidPlannerPane({ rememberedView, onViewChange }: RaidPlannerPaneProps) {
    const { itemById } = useQuestsContext();
    const [isKillListOpen, setIsKillListOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
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
    const navigationQuery = useQuery({
        ...mapOverlaysQueryOptions(selectedMapKey ?? ""),
        enabled: Boolean(selectedMapKey),
    });
    const navigationMarkers = navigationQuery.data?.markers ?? EMPTY_NAVIGATION_MARKERS;
    const plannerQuests = useMemo(() => selectedMap
        ? activeQuests.filter((quest) =>
            getQuestMapGroupsForQuest(quest).some((map) => map.key === selectedMap.key),
        )
        : [], [activeQuests, selectedMap]);
    const markers = useMemo(() => selectedMap ? [
        ...buildRaidPlannerMarkers(plannerQuests, selectedMap.key, markerByQuestId, completedQuestObjectives),
        ...navigationMarkers,
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

    const focusQuest = (questId: string | null) => {
        setHighlightedQuestId(questId);
        if (questId) {
            document.getElementById(`quest-workspace-${questId}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    if (!selectedMap) {
        return (
            <div className="flex min-h-0 flex-1 flex-col bg-[var(--background)]">
                <button
                    type="button"
                    onClick={exitPlanner}
                    className="flex h-12 shrink-0 items-center gap-2 border-b border-highlight/10 bg-[var(--card-bg)] px-4 text-xs font-medium text-foreground transition-colors hover:text-foreground lg:hidden"
                >
                    <ChevronLeft size={16} /> Back to quests
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Raid planner</p>
                    <h1 className="mt-2 text-3xl font-semibold text-foreground">Where are you heading?</h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-subtle-foreground">
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
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--card-bg)]">
            {navigationQuery.isError && (
                <div role="alert" className="absolute right-3 top-3 z-40 border border-danger/30 bg-danger-surface/90 px-3 py-2 text-xs text-danger">
                    Map navigation could not be loaded.
                    <button type="button" onClick={() => void navigationQuery.refetch()} className="ml-2 underline">Retry</button>
                </div>
            )}
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
                        <span className="mt-3 block border-t border-highlight/10 pt-2.5">
                            <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-warning/70">
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
                        className="inline-flex items-center gap-1.5 border border-danger/30 bg-danger-surface/80 px-2.5 py-1.5 text-[10px] font-semibold text-danger shadow-xl backdrop-blur-sm lg:hidden"
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
                        className="hidden border border-highlight/10 bg-shadow/80 p-2 text-foreground shadow-xl backdrop-blur-sm transition-colors hover:text-foreground lg:flex"
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
                    className="inline-flex items-center gap-2 border border-highlight/12 bg-shadow/80 px-3 py-2 text-xs font-medium text-foreground shadow-xl backdrop-blur-sm transition-colors hover:border-brand/40 hover:text-brand"
                >
                    <ChevronLeft size={14} /> {selectedMap.name}
                </button>
                <button
                    type="button"
                    aria-expanded={isKillListOpen}
                    aria-controls="raid-planner-kill-list"
                    onClick={() => setIsKillListOpen((open) => !open)}
                    className="inline-flex items-center gap-2 border border-danger/25 bg-danger-surface/75 px-3 py-2 text-xs font-medium text-danger shadow-xl backdrop-blur-sm transition-colors hover:border-danger/45 hover:bg-danger-surface/90"
                >
                    <Crosshair size={14} className="text-danger/80" />
                    Kill List
                    <span className="text-[10px] text-danger/50">{killObjectives.length}</span>
                </button>
                {isKillListOpen && (
                    <div
                        id="raid-planner-kill-list"
                        className="max-h-[min(60vh,32rem)] w-full overflow-y-auto border border-danger/20 bg-[var(--danger-surface)]/95 shadow-2xl backdrop-blur-md"
                    >
                        {killObjectives.length > 0 ? (
                            <div className="divide-y divide-danger/8">
                                {killObjectives.map((objective) => (
                                    <div
                                        key={`${objective.questId}:${objective.objectiveId}`}
                                        title={objective.fullDescription}
                                        className={objective.optional ? "px-3 py-2.5 opacity-55" : "px-3 py-2.5"}
                                    >
                                        <div className="flex items-start gap-2">
                                            <Crosshair size={12} className="mt-0.5 shrink-0 text-danger/65" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-semibold leading-4 text-danger/90">
                                                    {objective.summary}
                                                </p>
                                                <p className="mt-0.5 truncate text-[9px] text-subtle-foreground">
                                                    {objective.questName}{objective.optional ? " · Optional" : ""}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="px-3 py-3 text-[10px] text-subtle-foreground">No active kill objectives on this map.</p>
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
            className="group relative min-h-44 overflow-hidden border border-highlight/8 bg-[var(--card-bg)] p-3 text-left transition-all hover:border-brand/40 hover:bg-[var(--accent)] lg:min-h-56 lg:p-4"
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
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,var(--card-bg)_18%,color-mix(in_oklab,_var(--card-bg)_90%,_transparent)_52%,color-mix(in_oklab,_var(--card-bg)_35%,_transparent))]" />
            <span className="relative flex h-full min-h-36 flex-col pb-5 lg:min-h-48 lg:pb-0">
                <span className="block pr-16 text-base font-semibold text-foreground group-hover:text-foreground">{mapName}</span>
                <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-brand/75">
                    {summary.questCount} active quest{summary.questCount === 1 ? "" : "s"}
                </span>

                {summary.objectiveGroups.length > 0 ? (
                    <span className="mt-3 flex flex-wrap gap-1.5 lg:mt-4">
                        {summary.objectiveGroups.map((group) => (
                            <span
                                key={group.category}
                                className="inline-flex items-center gap-1.5 border border-highlight/10 bg-shadow/35 px-2 py-1 text-[10px] text-foreground"
                            >
                                {OBJECTIVE_CATEGORY_SHORT_LABELS[group.category]}
                                <span className="text-subtle-foreground">{group.questCount}</span>
                                {group.keyedQuestCount > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-warning/80" title={`${group.keyedQuestCount} quest${group.keyedQuestCount === 1 ? "" : "s"} require keys`}>
                                        <KeyRound size={9} /> {group.keyedQuestCount}
                                    </span>
                                )}
                            </span>
                        ))}
                    </span>
                ) : (
                    <span className="mt-3 text-xs text-subtle-foreground lg:mt-4">No active objectives on this map.</span>
                )}

                {summary.requiredKeyIds.length > 0 && (
                    <span className="mt-2.5 block lg:mt-4">
                        <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-warning/70">
                            <KeyRound size={10} /> Required keys
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5 lg:mt-2">
                            {summary.requiredKeyIds.map((itemId) => itemById[itemId]).filter(Boolean).map((key) => (
                                <RaidPlannerKey key={key.id} item={key} />
                            ))}
                        </span>
                    </span>
                )}

                <span className="absolute bottom-0 right-0 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground transition-colors group-hover:text-brand">
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
                <KeyRound size={28} className="absolute inset-0 m-auto text-subtle-foreground lg:h-[34px] lg:w-[34px]" />
            )}
        </span>
    );
}
