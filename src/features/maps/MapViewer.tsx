"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Eye, EyeOff, Layers3, LocateFixed, Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getProjectedMapAspectRatio, worldToMapPoint } from "./map-projection";
import { orderMapFloorsTopToBottom, resolveMapFloors } from "./map-floor-resolution";
import type { MapOverlayMarker, MapRenderDefinition } from "./map-types";
import { constrainMapView, zoomViewAroundPoint, type MapViewTransform } from "./map-view-transform";
import { getQuestObjectiveTypeLabel, QuestObjectiveIcon } from "@/features/quests/components/QuestObjectiveIcon";

interface MapViewerProps {
    mapKey: string;
    markers: MapOverlayMarker[];
    rememberedView?: MapViewTransform | null;
    onViewChange?: (view: MapViewTransform | null) => void;
    highlightedQuestId?: string | null;
    highlightedObjectiveId?: string | null;
    focusedObjectiveId?: string | null;
    focusRequestKey?: string | number | null;
    onMarkerSelect?: (marker: MapOverlayMarker) => void;
    onMarkerFocus?: (marker: MapOverlayMarker | null) => void;
    onMarkerComplete?: (marker: MapOverlayMarker) => void;
    canCompleteMarker?: (marker: MapOverlayMarker) => boolean;
    renderMarkerDetails?: (marker: MapOverlayMarker) => ReactNode;
    onObjectiveFloorsChange?: (floors: ReadonlyMap<string, string[]>) => void;
    topRightContent?: ReactNode;
    bottomRightContent?: ReactNode;
    compactAttribution?: boolean;
    attributionPlacement?: "top-right" | "navigation-controls";
}

const MIN_SCALE = 1;
const MAX_SCALE = 7;
const MAP_SVG_RENDER_VERSION = "2";

function getNavigationLabelTransform(percentX: number, scale: number) {
    const translateX = percentX < 12 ? "0%" : percentX > 88 ? "-100%" : "-50%";
    const transformOrigin = percentX < 12 ? "left center" : percentX > 88 ? "right center" : "center";
    return {
        transform: `translate(${translateX}, -115%) scale(${1 / scale})`,
        transformOrigin,
    };
}

function MarkerPopup({
    marker,
    floorNames,
    pinned,
    completed,
    canComplete,
    renderMarkerDetails,
    onComplete,
    onClose,
}: {
    marker: MapOverlayMarker;
    floorNames: string[];
    pinned: boolean;
    completed: boolean;
    canComplete: boolean;
    renderMarkerDetails?: (marker: MapOverlayMarker) => ReactNode;
    onComplete: () => void;
    onClose: () => void;
}) {
    return (
        <div
            data-marker-popup
            className={cn(
                "absolute bottom-full left-1/2 z-[110] w-72 -translate-x-1/2 pb-2 text-left font-sans font-normal",
                pinned ? "block" : "hidden group-hover:block group-focus-within:block",
            )}
        >
            <div className="border border-white/12 bg-[#111214]/95 p-3 shadow-2xl backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 text-xs font-semibold text-white">{marker.title}</span>
                    <span className="flex shrink-0 items-center gap-1">
                        {canComplete && (
                            <button
                                type="button"
                                disabled={completed}
                                onClick={onComplete}
                                className="inline-flex items-center gap-1 border border-tarkov-green/30 bg-tarkov-green/8 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-tarkov-green transition-colors hover:border-tarkov-green/60 hover:bg-tarkov-green/15 disabled:cursor-default disabled:opacity-60"
                            >
                                <Check size={9} /> {completed ? "Completed" : "Complete"}
                            </button>
                        )}
                        {pinned && (
                            <button
                                type="button"
                                aria-label="Close marker details"
                                onClick={onClose}
                                className="inline-flex h-5 w-5 items-center justify-center border border-white/10 text-gray-500 transition-colors hover:border-white/25 hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        )}
                    </span>
                </div>
                <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                    {floorNames.join(" · ")}
                </span>
                <span className="mt-2 block space-y-1 text-[10px] leading-relaxed text-gray-400">
                    {marker.descriptions.map((description) => (
                        <span key={description} className="block">{description}</span>
                    ))}
                </span>
                {renderMarkerDetails?.(marker)}
            </div>
        </div>
    );
}

export function MapViewer({
    mapKey,
    markers,
    rememberedView,
    onViewChange,
    highlightedQuestId,
    highlightedObjectiveId,
    focusedObjectiveId,
    focusRequestKey,
    onMarkerSelect,
    onMarkerFocus,
    onMarkerComplete,
    canCompleteMarker,
    renderMarkerDetails,
    onObjectiveFloorsChange,
    topRightContent,
    bottomRightContent,
    compactAttribution = false,
    attributionPlacement = "top-right",
}: MapViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        pointerId: number;
        x: number;
        y: number;
        view: MapViewTransform;
    } | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const pendingDragViewRef = useRef<MapViewTransform | null>(null);
    const [mapRequest, setMapRequest] = useState<{
        mapKey: string;
        state: "ready" | "unsupported" | "error";
        definition: MapRenderDefinition | null;
    } | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [manualView, setManualView] = useState<{
        key: string;
        value: MapViewTransform;
        focusRequestKey: string | number | null;
    } | null>(null);
    const [floorVisibilityState, setFloorVisibilityState] = useState<{
        mapKey: string;
        values: Record<string, boolean>;
    }>({ mapKey, values: {} });
    const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
    const [pinnedMarkerPopup, setPinnedMarkerPopup] = useState<{
        mapKey: string;
        marker: MapOverlayMarker;
        percentX: number;
        percentY: number;
        floorNames: string[];
        completed: boolean;
    } | null>(null);
    const [navigationLabelsVisible, setNavigationLabelsVisible] = useState(false);

    useEffect(() => {
        if (!pinnedMarkerPopup) return;
        const dismissPinnedPopup = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Element && target.closest("[data-marker-popup]")) return;
            setPinnedMarkerPopup(null);
        };
        document.addEventListener("pointerdown", dismissPinnedPopup, true);
        return () => document.removeEventListener("pointerdown", dismissPinnedPopup, true);
    }, [pinnedMarkerPopup]);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/maps/render/${encodeURIComponent(mapKey)}`, { signal: controller.signal })
            .then(async (response) => {
                if (response.status === 404) {
                    setMapRequest({ mapKey, state: "unsupported", definition: null });
                    return;
                }
                if (!response.ok) throw new Error(`Map manifest request failed (${response.status})`);
                setMapRequest({ mapKey, state: "ready", definition: await response.json() as MapRenderDefinition });
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setMapRequest({ mapKey, state: "error", definition: null });
            });
        return () => controller.abort();
    }, [mapKey]);

    const loadState = mapRequest?.mapKey === mapKey ? mapRequest.state : "loading";
    const definition = mapRequest?.mapKey === mapKey ? mapRequest.definition : null;

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => () => {
        if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    }, []);

    const projectedMarkers = useMemo(() => {
        if (!definition) return [];
        return markers.map((marker) => {
            const point = worldToMapPoint(marker.position, definition);
            return {
                marker,
                point,
                floors: resolveMapFloors(marker.position, definition),
                outlines: marker.outlines?.map((outline) =>
                    outline.map((position) => worldToMapPoint(position, definition)),
                ) ?? [],
            };
        });
    }, [definition, markers]);
    const hasNavigationMarkers = useMemo(
        () => projectedMarkers.some(({ marker }) => marker.kind === "extract" || marker.kind === "transit"),
        [projectedMarkers],
    );

    const floorVisibilityOverrides = useMemo(
        () => floorVisibilityState.mapKey === mapKey ? floorVisibilityState.values : {},
        [floorVisibilityState, mapKey],
    );
    const layerFocus = useMemo(() => {
        const objectiveId = highlightedObjectiveId ?? focusedObjectiveId;
        const entries = hoveredMarkerId
            ? projectedMarkers.filter(({ marker }) => marker.id === hoveredMarkerId)
            : objectiveId
              ? projectedMarkers.filter(({ marker }) => marker.objectiveIds?.includes(objectiveId))
              : [];
        return {
            active: entries.length > 0,
            floorIds: new Set(entries.flatMap(({ floors }) => floors.map(({ floor }) => floor.id))),
        };
    }, [focusedObjectiveId, highlightedObjectiveId, hoveredMarkerId, projectedMarkers]);
    const visibleFloors = useMemo(() => definition?.floors
        .filter((floor) => floor.isBase || (
            layerFocus.active
                ? layerFocus.floorIds.has(floor.id)
                : (floorVisibilityOverrides[floor.id] ?? floor.isDefaultVisible)
        ))
        .sort((left, right) => left.stackOrder - right.stackOrder) ?? [],
    [definition, floorVisibilityOverrides, layerFocus]);
    const visibleFloorIds = useMemo(() => new Set(visibleFloors.map((floor) => floor.id)), [visibleFloors]);
    const orderedFloors = useMemo(
        () => definition ? orderMapFloorsTopToBottom(definition.floors) : [],
        [definition],
    );
    const layerImageUrl = useMemo(() => {
        if (!definition) return "";
        const params = new URLSearchParams();
        params.set("v", MAP_SVG_RENDER_VERSION);
        visibleFloors.forEach((floor) => params.append("layer", floor.id));
        return `${definition.svgPath}?${params.toString()}`;
    }, [definition, visibleFloors]);

    useEffect(() => {
        if (!onObjectiveFloorsChange) return;
        const floorNamesByObjective = new Map<string, Set<string>>();
        projectedMarkers.forEach(({ marker, floors }) => marker.objectiveIds?.forEach((objectiveId) => {
            const names = floorNamesByObjective.get(objectiveId) ?? new Set<string>();
            floors.forEach(({ floor }) => names.add(floor.name));
            floorNamesByObjective.set(objectiveId, names);
        }));
        onObjectiveFloorsChange(new Map(
            [...floorNamesByObjective].map(([objectiveId, names]) => [objectiveId, [...names]]),
        ));
    }, [onObjectiveFloorsChange, projectedMarkers]);

    const stageSize = useMemo(() => {
        if (!definition || !containerSize.width || !containerSize.height) return { width: 0, height: 0 };
        const aspectRatio = getProjectedMapAspectRatio(definition);
        const containerAspectRatio = containerSize.width / containerSize.height;
        return containerAspectRatio > aspectRatio
            ? { width: containerSize.height * aspectRatio, height: containerSize.height }
            : { width: containerSize.width, height: containerSize.width / aspectRatio };
    }, [containerSize, definition]);

    const fitProjectedMarkers = useCallback((entries: typeof projectedMarkers): MapViewTransform => {
        if (!stageSize.width || !stageSize.height || entries.length === 0) {
            return { scale: 1, x: 0, y: 0 };
        }
        const xs = entries.flatMap(({ point, outlines }) => [
            point.percentX,
            ...outlines.flatMap((outline) => outline.map((entry) => entry.percentX)),
        ]);
        const ys = entries.flatMap(({ point, outlines }) => [
            point.percentY,
            ...outlines.flatMap((outline) => outline.map((entry) => entry.percentY)),
        ]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const spanWidth = Math.max((maxX - minX) / 100 * stageSize.width, stageSize.width * 0.12);
        const spanHeight = Math.max((maxY - minY) / 100 * stageSize.height, stageSize.height * 0.12);
        const scale = Math.min(3, Math.max(1, Math.min(
            containerSize.width * 0.78 / spanWidth,
            containerSize.height * 0.78 / spanHeight,
        )));
        const centerX = (minX + maxX) / 200;
        const centerY = (minY + maxY) / 200;
        return {
            scale,
            x: -(centerX - 0.5) * stageSize.width * scale,
            y: -(centerY - 0.5) * stageSize.height * scale,
        };
    }, [containerSize.height, containerSize.width, stageSize.height, stageSize.width]);
    const fittedView = useMemo<MapViewTransform>(
        () => fitProjectedMarkers(projectedMarkers),
        [fitProjectedMarkers, projectedMarkers],
    );

    const viewKey = `${mapKey}:${stageSize.width}:${stageSize.height}:${markers.map((marker) => marker.id).join("|")}`;
    const focusedView = useMemo(() => {
        if (!focusedObjectiveId || focusRequestKey == null) return null;
        const entries = projectedMarkers.filter(({ marker }) =>
            marker.objectiveIds?.includes(focusedObjectiveId),
        );
        return entries.length > 0 ? fitProjectedMarkers(entries) : null;
    }, [fitProjectedMarkers, focusRequestKey, focusedObjectiveId, projectedMarkers]);
    const currentManualView = manualView?.key === viewKey &&
        manualView.focusRequestKey === (focusRequestKey ?? null)
        ? manualView.value
        : null;
    const unconstrainedView = currentManualView ?? focusedView ?? rememberedView ?? fittedView;
    const view = useMemo(
        () => constrainMapView(unconstrainedView, stageSize, containerSize),
        [containerSize, stageSize, unconstrainedView],
    );
    const fitMarkers = useCallback(() => {
        setManualView({ key: viewKey, value: fittedView, focusRequestKey: focusRequestKey ?? null });
        onViewChange?.(null);
    }, [fittedView, focusRequestKey, onViewChange, viewKey]);

    const updateView = (value: MapViewTransform, remember = true) => {
        const constrainedValue = constrainMapView(value, stageSize, containerSize);
        setManualView({ key: viewKey, value: constrainedValue, focusRequestKey: focusRequestKey ?? null });
        if (remember) onViewChange?.(constrainedValue);
        return constrainedValue;
    };

    const renderPendingDragView = () => {
        dragFrameRef.current = null;
        const pendingView = pendingDragViewRef.current;
        if (!pendingView) return;
        pendingDragViewRef.current = null;
        updateView(pendingView, false);
    };

    const finishDrag = () => {
        const drag = dragRef.current;
        if (!drag) return;
        if (dragFrameRef.current !== null) {
            cancelAnimationFrame(dragFrameRef.current);
            dragFrameRef.current = null;
        }
        pendingDragViewRef.current = null;
        updateView(drag.view, false);
        onViewChange?.(drag.view);
        dragRef.current = null;
    };

    const zoomBy = (factor: number, focalPoint = { x: 0, y: 0 }) => {
        updateView(zoomViewAroundPoint(view, factor, focalPoint, MIN_SCALE, MAX_SCALE));
    };

    if (loadState !== "ready" || !definition) {
        return (
            <div ref={containerRef} className="flex h-full min-h-72 items-center justify-center bg-[#0b0c0e] p-8 text-center">
                <div>
                    <p className="text-sm font-semibold text-gray-300">
                        {loadState === "loading" && "Loading map…"}
                        {loadState === "unsupported" && "Map artwork unavailable"}
                        {loadState === "error" && "Map could not be loaded"}
                    </p>
                    {loadState === "unsupported" && (
                        <p className="mt-2 max-w-sm text-xs leading-relaxed text-gray-500">
                            Quest locations are preserved, but this map does not yet have a validated SVG definition.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative h-full min-h-72 touch-none select-none overflow-hidden bg-[#08090a]"
            onWheel={(event) => {
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, {
                    x: event.clientX - bounds.left - bounds.width / 2,
                    y: event.clientY - bounds.top - bounds.height / 2,
                });
            }}
            onPointerDown={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("[data-marker-popup]")) return;
                setPinnedMarkerPopup(null);
                if (target.closest("button, summary, a")) return;
                event.preventDefault();
                dragRef.current = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    view,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const nextView = constrainMapView({
                    ...drag.view,
                    x: drag.view.x + event.clientX - drag.x,
                    y: drag.view.y + event.clientY - drag.y,
                }, stageSize, containerSize);
                dragRef.current = {
                    ...drag,
                    x: event.clientX,
                    y: event.clientY,
                    view: nextView,
                };
                pendingDragViewRef.current = nextView;
                if (dragFrameRef.current === null) {
                    dragFrameRef.current = requestAnimationFrame(renderPendingDragView);
                }
            }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
        >
            <div
                className="absolute left-1/2 top-1/2 will-change-transform"
                style={{
                    width: stageSize.width,
                    height: stageSize.height,
                    transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                    transformOrigin: "center",
                }}
            >
                <Image
                    key={layerImageUrl}
                    src={layerImageUrl}
                    alt=""
                    fill
                    unoptimized
                    draggable={false}
                    sizes="100vw"
                    className="select-none"
                />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                    {projectedMarkers.flatMap(({ marker, outlines }) => {
                        const isNavigationOverlay = marker.kind === "extract" || marker.kind === "transit";
                        return outlines.map((outline, outlineIndex) => outline.length > 2 && (
                            <polygon
                                key={`${marker.id}:outline:${outlineIndex}`}
                                points={outline.map((point) => `${point.percentX},${point.percentY}`).join(" ")}
                                fill={marker.color ?? "#9dbb61"}
                                fillOpacity="0.2"
                                stroke={marker.color ?? "#9dbb61"}
                                strokeOpacity="0.8"
                                strokeWidth={0.25 / view.scale}
                                vectorEffect="non-scaling-stroke"
                                className={isNavigationOverlay ? "pointer-events-auto outline-none" : undefined}
                                tabIndex={isNavigationOverlay ? 0 : undefined}
                                role={isNavigationOverlay ? "img" : undefined}
                                aria-label={isNavigationOverlay ? marker.label : undefined}
                                onMouseEnter={isNavigationOverlay ? () => {
                                    setHoveredMarkerId(marker.id);
                                    onMarkerFocus?.(marker);
                                } : undefined}
                                onMouseLeave={isNavigationOverlay ? () => {
                                    setHoveredMarkerId(null);
                                    onMarkerFocus?.(null);
                                } : undefined}
                                onFocus={isNavigationOverlay ? () => {
                                    setHoveredMarkerId(marker.id);
                                    onMarkerFocus?.(marker);
                                } : undefined}
                                onBlur={isNavigationOverlay ? () => {
                                    setHoveredMarkerId(null);
                                    onMarkerFocus?.(null);
                                } : undefined}
                            />
                        ));
                    })}
                </svg>
                {projectedMarkers.map(({ marker, point, floors }) => {
                    if (marker.kind !== "quest") {
                        if (!navigationLabelsVisible && hoveredMarkerId !== marker.id) return null;
                        const labelTransform = getNavigationLabelTransform(point.percentX, view.scale);
                        return (
                            <span
                                key={`${marker.id}:label`}
                                aria-hidden="true"
                                className="pointer-events-none absolute z-30 whitespace-nowrap font-sans text-[9px] font-bold uppercase tracking-wide [text-shadow:0_1px_2px_#000,0_0_3px_#000,0_0_7px_#000]"
                                style={{
                                    left: `${point.percentX}%`,
                                    top: `${point.percentY}%`,
                                    color: marker.color,
                                    ...labelTransform,
                                }}
                            >
                                {marker.label}
                            </span>
                        );
                    }
                    const isPinned = pinnedMarkerPopup?.mapKey === mapKey && pinnedMarkerPopup.marker.id === marker.id;
                    const markerCanBeCompleted = !!onMarkerComplete && (canCompleteMarker?.(marker) ?? true);
                    return <div
                        key={marker.id}
                        className={cn(
                            "group absolute z-20 flex h-7 min-w-7 items-center justify-center rounded-full hover:z-[100] focus-within:z-[100]",
                            (highlightedQuestId === marker.questId ||
                                (!!highlightedObjectiveId && marker.objectiveIds?.includes(highlightedObjectiveId))) &&
                                "ring-2 ring-white/70",
                        )}
                        style={{
                            left: `${point.percentX}%`,
                            top: `${point.percentY}%`,
                            color: marker.color,
                            borderColor: marker.color,
                            transform: `translate(-50%, -50%) scale(${1 / view.scale})`,
                        }}
                    >
                        <button
                            type="button"
                            aria-label={`${getQuestObjectiveTypeLabel(marker.objectiveType ?? "")}: ${marker.title}: ${marker.descriptions.join("; ")}`}
                            aria-expanded={isPinned}
                            onMouseEnter={() => { setHoveredMarkerId(marker.id); onMarkerFocus?.(marker); }}
                            onMouseLeave={() => { setHoveredMarkerId(null); onMarkerFocus?.(null); }}
                            onFocus={() => { setHoveredMarkerId(marker.id); onMarkerFocus?.(marker); }}
                            onBlur={() => { setHoveredMarkerId(null); onMarkerFocus?.(null); }}
                            onClick={() => {
                                setPinnedMarkerPopup({
                                    mapKey,
                                    marker,
                                    percentX: point.percentX,
                                    percentY: point.percentY,
                                    floorNames: floors.map(({ floor }) => floor.name),
                                    completed: false,
                                });
                                onMarkerSelect?.(marker);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-black/70 shadow-xl outline-none"
                            style={{ backgroundColor: marker.color }}
                        >
                            <QuestObjectiveIcon type={marker.objectiveType ?? ""} size={15} className="text-black" />
                        </button>
                        <MarkerPopup
                            marker={marker}
                            floorNames={floors.map(({ floor }) => floor.name)}
                            pinned={isPinned}
                            completed={isPinned && pinnedMarkerPopup.completed}
                            canComplete={markerCanBeCompleted}
                            renderMarkerDetails={renderMarkerDetails}
                            onComplete={() => {
                                setPinnedMarkerPopup({
                                    mapKey,
                                    marker,
                                    percentX: point.percentX,
                                    percentY: point.percentY,
                                    floorNames: floors.map(({ floor }) => floor.name),
                                    completed: true,
                                });
                                onMarkerComplete?.(marker);
                            }}
                            onClose={() => setPinnedMarkerPopup(null)}
                        />
                    </div>;
                })}
                {pinnedMarkerPopup?.mapKey === mapKey &&
                    !projectedMarkers.some(({ marker }) => marker.id === pinnedMarkerPopup.marker.id) && (
                        <div
                            className="absolute z-[100] h-7 w-7"
                            style={{
                                left: `${pinnedMarkerPopup.percentX}%`,
                                top: `${pinnedMarkerPopup.percentY}%`,
                                transform: `translate(-50%, -50%) scale(${1 / view.scale})`,
                            }}
                        >
                            <MarkerPopup
                                marker={pinnedMarkerPopup.marker}
                                floorNames={pinnedMarkerPopup.floorNames}
                                pinned
                                completed={pinnedMarkerPopup.completed}
                                canComplete={pinnedMarkerPopup.completed}
                                renderMarkerDetails={renderMarkerDetails}
                                onComplete={() => {}}
                                onClose={() => setPinnedMarkerPopup(null)}
                            />
                        </div>
                    )}
            </div>

            {definition.floors.length > 1 && (
                <details className="group absolute bottom-3 left-3 z-30 w-52 border border-white/10 bg-black/85 text-xs shadow-xl backdrop-blur-sm">
                    <summary
                        className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-gray-300 hover:text-white"
                        title={`Visible layers: ${visibleFloors.map((floor) => floor.name).join(", ")}`}
                    >
                        <Layers3 size={14} />
                        <span className="min-w-0 flex-1 truncate">
                            {visibleFloors.length === 1 ? visibleFloors[0].name : `${visibleFloors.length} layers visible`}
                        </span>
                        <ChevronDown size={13} className="shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-white/10 p-2">
                        {orderedFloors.map((floor) => {
                            const isVisible = visibleFloorIds.has(floor.id);
                            const markerCount = projectedMarkers.filter(({ floors }) =>
                                floors.some(({ floor: markerFloor }) => markerFloor.id === floor.id),
                            ).length;
                            if (floor.isBase) {
                                return (
                                    <div key={floor.id} className="flex w-full items-center gap-2 px-2 py-2 text-gray-300">
                                        <span className="h-2 w-2 rounded-full border border-tarkov-green bg-tarkov-green" />
                                        <span className="flex-1">{floor.name}</span>
                                        <span className="text-[9px] uppercase tracking-wider text-gray-600">Always</span>
                                    </div>
                                );
                            }
                            return (
                                <button
                                    type="button"
                                    key={floor.id}
                                    aria-pressed={isVisible}
                                    onClick={() => setFloorVisibilityState((current) => ({
                                        mapKey,
                                        values: {
                                            ...(current.mapKey === mapKey ? current.values : {}),
                                            [floor.id]: !isVisible,
                                        },
                                    }))}
                                    className="flex w-full items-center gap-2 px-2 py-2 text-left text-gray-400 hover:bg-white/5 hover:text-white"
                                >
                                    <span className={cn("h-2 w-2 rounded-full border", isVisible ? "border-tarkov-green bg-tarkov-green" : "border-gray-600")} />
                                    <span className="flex-1">{floor.name}</span>
                                    {markerCount > 0 && <span className="text-[9px] text-gray-600">{markerCount}</span>}
                                </button>
                            );
                        })}
                    </div>
                </details>
            )}

            <div className="absolute bottom-3 right-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2">
                {attributionPlacement === "navigation-controls" && (
                    <MapAttribution definition={definition} compact />
                )}
                {hasNavigationMarkers && (
                    <button
                        type="button"
                        aria-label={navigationLabelsVisible ? "Hide extract and transit labels" : "Show extract and transit labels"}
                        aria-pressed={navigationLabelsVisible}
                        onClick={() => setNavigationLabelsVisible((visible) => !visible)}
                        className={cn(
                            "border border-white/10 bg-black/80 p-2 shadow-xl backdrop-blur-sm hover:text-white",
                            navigationLabelsVisible ? "text-tarkov-green" : "text-gray-500",
                        )}
                    >
                        {navigationLabelsVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                )}
                <div className="flex border border-white/10 bg-black/80 shadow-xl backdrop-blur-sm">
                    <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)} className="p-2 text-gray-300 hover:text-white"><Minus size={15} /></button>
                    <button type="button" aria-label="Fit map markers" onClick={fitMarkers} className="border-x border-white/10 p-2 text-gray-300 hover:text-white"><LocateFixed size={15} /></button>
                    <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)} className="p-2 text-gray-300 hover:text-white"><Plus size={15} /></button>
                </div>
                {bottomRightContent}
            </div>
            <div className={cn(
                "absolute z-30 flex max-w-[calc(100%-6rem)] items-start gap-2",
                compactAttribution ? "right-2 top-2" : "right-3 top-3",
            )}>
                {topRightContent}
                {attributionPlacement === "top-right" && (
                    <MapAttribution definition={definition} compact={compactAttribution} />
                )}
            </div>
        </div>
    );
}

function MapAttribution({ definition, compact }: { definition: MapRenderDefinition; compact: boolean }) {
    return (
        <p className={cn(
            "shrink-0 leading-relaxed text-gray-500 backdrop-blur-sm",
            compact
                ? "bg-black/40 px-1.5 py-1 text-[7px]"
                : "border border-white/10 bg-black/80 px-2.5 py-2 text-[9px] shadow-xl",
        )}>
            {compact ? "Map: " : "Map by "}<a href={definition.attribution.authorLink} target="_blank" rel="noreferrer" className={cn("hover:text-white", compact ? "text-gray-400" : "text-gray-300")}>{definition.attribution.author}</a>
            {" · "}<a href={definition.attribution.licenseLink} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-white">{definition.attribution.license}</a>
        </p>
    );
}
