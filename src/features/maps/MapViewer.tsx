"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getProjectedMapAspectRatio, worldToMapPoint } from "./map-projection";
import type { MapOverlayMarker, MapRenderDefinition } from "./map-types";
import { zoomViewAroundPoint, type MapViewTransform } from "./map-view-transform";

interface MapViewerProps {
    mapKey: string;
    markers: MapOverlayMarker[];
    highlightedQuestId?: string | null;
    onMarkerSelect?: (marker: MapOverlayMarker) => void;
    onMarkerFocus?: (marker: MapOverlayMarker | null) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function MapViewer({
    mapKey,
    markers,
    highlightedQuestId,
    onMarkerSelect,
    onMarkerFocus,
}: MapViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const [mapRequest, setMapRequest] = useState<{
        mapKey: string;
        state: "ready" | "unsupported" | "error";
        definition: MapRenderDefinition | null;
    } | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [manualView, setManualView] = useState<{ key: string; value: MapViewTransform } | null>(null);

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

    const projectedMarkers = useMemo(() => {
        if (!definition) return [];
        return markers.map((marker) => {
            const point = worldToMapPoint(marker.position, definition);
            return {
                marker,
                point,
                outlines: marker.outlines?.map((outline) =>
                    outline.map((position) => worldToMapPoint(position, definition)),
                ) ?? [],
            };
        });
    }, [definition, markers]);

    const stageSize = useMemo(() => {
        if (!definition || !containerSize.width || !containerSize.height) return { width: 0, height: 0 };
        const aspectRatio = getProjectedMapAspectRatio(definition);
        const containerAspectRatio = containerSize.width / containerSize.height;
        return containerAspectRatio > aspectRatio
            ? { width: containerSize.height * aspectRatio, height: containerSize.height }
            : { width: containerSize.width, height: containerSize.width / aspectRatio };
    }, [containerSize, definition]);

    const fittedView = useMemo<MapViewTransform>(() => {
        if (!stageSize.width || !stageSize.height || projectedMarkers.length === 0) {
            return { scale: 1, x: 0, y: 0 };
        }
        const xs = projectedMarkers.flatMap(({ point, outlines }) => [
            point.percentX,
            ...outlines.flatMap((outline) => outline.map((entry) => entry.percentX)),
        ]);
        const ys = projectedMarkers.flatMap(({ point, outlines }) => [
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
    }, [containerSize, projectedMarkers, stageSize]);

    const viewKey = `${mapKey}:${stageSize.width}:${stageSize.height}:${markers.map((marker) => marker.id).join("|")}`;
    const view = manualView?.key === viewKey ? manualView.value : fittedView;
    const fitMarkers = useCallback(() => setManualView(null), []);

    const zoomBy = (factor: number, focalPoint = { x: 0, y: 0 }) => {
        setManualView({
            key: viewKey,
            value: zoomViewAroundPoint(view, factor, focalPoint, MIN_SCALE, MAX_SCALE),
        });
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
            className="relative h-full min-h-72 touch-none overflow-hidden bg-[#08090a]"
            onWheel={(event) => {
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, {
                    x: event.clientX - bounds.left - bounds.width / 2,
                    y: event.clientY - bounds.top - bounds.height / 2,
                });
            }}
            onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const dx = event.clientX - drag.x;
                const dy = event.clientY - drag.y;
                dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
                setManualView({ key: viewKey, value: { ...view, x: view.x + dx, y: view.y + dy } });
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
        >
            <div
                className="absolute left-1/2 top-1/2"
                style={{
                    width: stageSize.width,
                    height: stageSize.height,
                    transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                    transformOrigin: "center",
                }}
            >
                <Image
                    src={definition.svgPath}
                    alt=""
                    fill
                    unoptimized
                    draggable={false}
                    sizes="100vw"
                    className="select-none"
                />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                    {projectedMarkers.flatMap(({ marker, outlines }) =>
                        outlines.map((outline, outlineIndex) => outline.length > 2 && (
                            <polygon
                                key={`${marker.id}:outline:${outlineIndex}`}
                                points={outline.map((point) => `${point.percentX},${point.percentY}`).join(" ")}
                                fill={marker.color ?? "#9dbb61"}
                                fillOpacity="0.2"
                                stroke={marker.color ?? "#9dbb61"}
                                strokeOpacity="0.8"
                                strokeWidth={0.25 / view.scale}
                                vectorEffect="non-scaling-stroke"
                            />
                        )),
                    )}
                </svg>
                {projectedMarkers.map(({ marker, point }) => (
                    <button
                        type="button"
                        key={marker.id}
                        aria-label={`${marker.label}: ${marker.title}: ${marker.descriptions.join("; ")}`}
                        onMouseEnter={() => onMarkerFocus?.(marker)}
                        onMouseLeave={() => onMarkerFocus?.(null)}
                        onFocus={() => onMarkerFocus?.(marker)}
                        onBlur={() => onMarkerFocus?.(null)}
                        onClick={() => onMarkerSelect?.(marker)}
                        className={cn(
                            "group absolute z-20 flex h-7 min-w-7 items-center justify-center rounded-full border-2 bg-black/90 px-1.5 font-mono text-[11px] font-bold shadow-xl outline-none hover:z-[100] focus-visible:z-[100]",
                            highlightedQuestId === marker.questId && "ring-2 ring-white/60",
                        )}
                        style={{
                            left: `${point.percentX}%`,
                            top: `${point.percentY}%`,
                            color: marker.color,
                            borderColor: marker.color,
                            transform: `translate(-50%, -50%) scale(${1 / view.scale})`,
                        }}
                    >
                        {marker.label}
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-[110] mb-2 hidden w-72 -translate-x-1/2 border border-white/12 bg-[#111214]/95 p-3 text-left font-sans font-normal shadow-2xl backdrop-blur group-hover:block group-focus-visible:block">
                            <span className="block text-xs font-semibold text-white">{marker.title}</span>
                            <span className="mt-2 block space-y-1 text-[10px] leading-relaxed text-gray-400">
                                {marker.descriptions.map((description) => (
                                    <span key={description} className="block">{description}</span>
                                ))}
                            </span>
                        </span>
                    </button>
                ))}
            </div>

            <div className="absolute bottom-3 right-3 z-20 flex border border-white/10 bg-black/80 shadow-xl backdrop-blur-sm">
                <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)} className="p-2 text-gray-300 hover:text-white"><Minus size={15} /></button>
                <button type="button" aria-label="Fit quest locations" onClick={fitMarkers} className="border-x border-white/10 p-2 text-gray-300 hover:text-white"><LocateFixed size={15} /></button>
                <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)} className="p-2 text-gray-300 hover:text-white"><Plus size={15} /></button>
            </div>
            <p className="absolute bottom-3 left-3 z-20 max-w-[60%] bg-black/70 px-2 py-1 text-[9px] leading-relaxed text-gray-500 backdrop-blur-sm">
                Map by <a href={definition.attribution.authorLink} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-white">{definition.attribution.author}</a>
                {" · "}<a href={definition.attribution.licenseLink} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-white">{definition.attribution.license}</a>
            </p>
        </div>
    );
}
