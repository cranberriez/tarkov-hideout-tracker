"use client";

import dynamic from "next/dynamic";
import { ChevronRight, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FullQuest } from "@/types/quests";
import type { useQuestDetailsController } from "../useQuestDetailsController";

const LazyMapViewer = dynamic(
    () => import("@/features/maps/MapViewer").then((module) => module.MapViewer),
    {
        ssr: false,
        loading: () => <MapLoadingPlaceholder label="Loading objective map…" />,
    },
);

/** Resizable objective map beside (desktop) or over (compact) the quest details. */
export function QuestObjectiveMap({
    quest,
    controller,
    onToggleObjectiveCompletion,
}: {
    quest: FullQuest;
    controller: ReturnType<typeof useQuestDetailsController>;
    onToggleObjectiveCompletion: (questId: string, objectiveId: string) => void;
}) {
    const {
        isDesktopMapOpen, setIsDesktopMapOpen, isCompactMapOpen, closeCompactMap,
        mapWidthPercent, setMapWidthPercent, isResizingMap, setIsResizingMap,
        handleObjectiveFloorsChange, hoveredObjectiveId, mapSectionRef,
        detailMaps, selectedDetailMapKey, selectedDetailMap, detailMarkers,
        panelSelectedMap, panelMarkers, isMapUpdatePending,
        focusedObjectiveId, focusRequestKey, showObjectiveOnMap,
        selectDetailMap, resizeMapFromPointer,
    } = controller;
    if (!selectedDetailMap) return null;
    const toggleQuestObjectiveCompletion = onToggleObjectiveCompletion;

    return (
        <aside
            ref={mapSectionRef}
            className={cn(
                "relative min-h-0 flex-1 flex-col bg-[var(--background)]",
                isCompactMapOpen ? "flex" : "hidden",
                "min-[1700px]:order-last min-[1700px]:h-auto min-[1700px]:min-h-0 min-[1700px]:border-l min-[1700px]:border-highlight/10",
                isDesktopMapOpen ? "min-[1700px]:flex" : "min-[1700px]:hidden",
            )}
        >
            {isDesktopMapOpen && (
                <div
                    role="separator"
                    aria-label="Resize objective map"
                    aria-orientation="vertical"
                    aria-valuemin={28}
                    aria-valuemax={65}
                    aria-valuenow={Math.round(mapWidthPercent)}
                    tabIndex={0}
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setIsResizingMap(true);
                        resizeMapFromPointer(event.clientX);
                    }}
                    onPointerMove={(event) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeMapFromPointer(event.clientX);
                    }}
                    onPointerUp={(event) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                        setIsResizingMap(false);
                    }}
                    onPointerCancel={() => setIsResizingMap(false)}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") setMapWidthPercent((current) => Math.min(65, current + 2));
                        if (event.key === "ArrowRight") setMapWidthPercent((current) => Math.max(28, current - 2));
                    }}
                    className={cn(
                        "absolute inset-y-0 left-0 z-30 hidden w-2 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none transition-colors min-[1700px]:flex",
                        "after:h-14 after:w-px after:bg-highlight/15 after:transition-all hover:bg-brand/10 hover:after:h-24 hover:after:bg-brand focus-visible:bg-brand/10 focus-visible:after:h-24 focus-visible:after:bg-brand",
                        isResizingMap && "bg-brand/15 after:h-24 after:w-0.5 after:bg-brand",
                    )}
                >
                    <GripVertical size={12} className="absolute text-subtle-foreground" />
                </div>
            )}
            <div className="flex min-h-11 shrink-0 border-b border-highlight/10 bg-[var(--card-bg)]">
                <button
                    type="button"
                    onClick={() => setIsDesktopMapOpen(false)}
                    className="hidden aspect-square h-full min-h-11 shrink-0 items-center justify-center border-r border-highlight/10 text-subtle-foreground transition-colors hover:bg-highlight/5 hover:text-foreground min-[1700px]:flex"
                    aria-label="Hide objective map"
                    aria-expanded
                    title="Hide objective map"
                >
                    <ChevronRight size={17} />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
                    <div className="min-w-0 shrink-0">
                        <p className="truncate text-xs">
                            {detailMarkers.length} mapped location{detailMarkers.length === 1 ? "" : "s"} on {selectedDetailMap.name}
                        </p>
                    </div>
                    {detailMaps.length > 1 && (
                        <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-1" aria-label="Quest objective maps">
                            {detailMaps.map((map) => (
                                <Button
                                    key={map.key}
                                    size="xs"
                                    selected={map.key === selectedDetailMapKey}
                                    aria-pressed={map.key === selectedDetailMapKey}
                                    onClick={() => selectDetailMap(map.key)}
                                    className="h-6 text-[10px] uppercase tracking-wider"
                                >
                                    {map.name} · {map.locationCount}
                                </Button>
                            ))}
                        </div>
                    )}
                    <Button
                        tone="danger"
                        iconOnly
                        onClick={closeCompactMap}
                        className="ml-auto min-[1700px]:hidden"
                        aria-label="Close objective map"
                        title="Close objective map"
                    >
                        <X size={15} />
                    </Button>
                </div>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--background)]">
                {panelSelectedMap ? (
                    <LazyMapViewer
                        mapKey={panelSelectedMap.key}
                        markers={panelMarkers}
                        compactAttribution
                        highlightedObjectiveId={!isMapUpdatePending ? hoveredObjectiveId ?? focusedObjectiveId : null}
                        focusedObjectiveId={!isMapUpdatePending ? focusedObjectiveId : null}
                        focusRequestKey={!isMapUpdatePending ? focusRequestKey : null}
                        onObjectiveFloorsChange={handleObjectiveFloorsChange}
                        onMarkerComplete={!isMapUpdatePending && quest.objectives.length > 1 ? (marker) => {
                            const questId = marker.questId ?? quest.id;
                            marker.objectiveIds?.forEach((objectiveId) => {
                                toggleQuestObjectiveCompletion(questId, objectiveId);
                            });
                        } : undefined}
                        onMarkerSelect={(marker) => {
                            const objectiveId = marker.objectiveIds?.[0];
                            if (objectiveId) showObjectiveOnMap(panelSelectedMap.key, objectiveId);
                        }}
                    />
                ) : (
                    <MapLoadingPlaceholder label="Preparing objective map…" />
                )}
                {isMapUpdatePending && (
                    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-shadow/35 backdrop-blur-[1px]">
                        <span className="border border-highlight/10 bg-shadow/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-xl">
                            Updating map…
                        </span>
                    </div>
                )}
            </div>
        </aside>
    );
}

function MapLoadingPlaceholder({ label }: { label: string }) {
    return (
        <div className="flex h-full min-h-72 items-center justify-center bg-[var(--background)] p-8 text-center">
            <div>
                <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-highlight/10 border-t-brand" />
                <p className="mt-3 text-xs font-medium text-subtle-foreground">{label}</p>
            </div>
        </div>
    );
}
