"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { QuestDetailMapData } from "./quest-details-model";

export function useQuestDetailsController(questId: string | null, questMapData: QuestDetailMapData | null) {
    const [showDebug, setShowDebug] = useState(false);
    const [isDesktopMapOpen, setIsDesktopMapOpen] = useState(true);
    const [condensedQuestId, setCondensedQuestId] = useState<string | null>(null);
    const [compactMapQuestId, setCompactMapQuestId] = useState<string | null>(null);
    const [mapWidthPercent, setMapWidthPercent] = useState(46);
    const [isResizingMap, setIsResizingMap] = useState(false);
    const [objectiveFloorNames, setObjectiveFloorNames] = useState<ReadonlyMap<string, string[]>>(new Map());
    const [hoveredObjectiveId, setHoveredObjectiveId] = useState<string | null>(null);
    const [mapTarget, setMapTarget] = useState<{
        questId: string;
        mapKey: string;
        objectiveId: string | null;
        requestKey: number;
    } | null>(null);
    const mapSectionRef = useRef<HTMLElement>(null);
    const detailScrollRef = useRef<HTMLDivElement>(null);
    const detailSplitRef = useRef<HTMLDivElement>(null);
    const deferredMapData = useDeferredValue(questMapData);

    useEffect(() => {
        detailScrollRef.current?.scrollTo({ top: 0 });
    }, [questId]);

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 1024px)");
        const clearDesktopCondensedHeader = () => {
            if (desktop.matches) setCondensedQuestId(null);
        };
        clearDesktopCondensedHeader();
        desktop.addEventListener("change", clearDesktopCondensedHeader);
        return () => desktop.removeEventListener("change", clearDesktopCondensedHeader);
    }, []);

    const isCompactMapOpen = compactMapQuestId === questId;
    useEffect(() => {
        document.body.classList.toggle("quest-objective-map-active", isCompactMapOpen);
        return () => document.body.classList.remove("quest-objective-map-active");
    }, [isCompactMapOpen]);

    const detailMaps = questMapData?.maps ?? [];
    const selectedDetailMapKey = questId && mapTarget?.questId === questId &&
        detailMaps.some((map) => map.key === mapTarget.mapKey)
        ? mapTarget.mapKey
        : detailMaps[0]?.key ?? null;
    const selectedDetailMap = detailMaps.find((map) => map.key === selectedDetailMapKey) ?? null;
    const detailMarkers = selectedDetailMapKey
        ? questMapData?.markersByMap.get(selectedDetailMapKey) ?? []
        : [];
    const panelMapData = deferredMapData ?? questMapData;
    const panelMapKey = panelMapData && mapTarget?.questId === panelMapData.questId &&
        panelMapData.maps.some((map) => map.key === mapTarget.mapKey)
        ? mapTarget.mapKey
        : panelMapData?.maps[0]?.key ?? null;
    const panelSelectedMap = panelMapData?.maps.find((map) => map.key === panelMapKey) ?? null;
    const panelMarkers = panelMapKey ? panelMapData?.markersByMap.get(panelMapKey) ?? [] : [];
    const isMapUpdatePending = !!panelMapData && panelMapData.questId !== questId;
    const focusedObjectiveId = questId && mapTarget?.questId === questId && mapTarget.mapKey === selectedDetailMapKey
        ? mapTarget.objectiveId
        : null;
    const focusRequestKey = focusedObjectiveId ? mapTarget?.requestKey ?? null : null;

    const showObjectiveOnMap = useCallback((mapKey: string, objectiveId: string) => {
        if (!questId) return;
        setMapTarget((current) => ({
            questId,
            mapKey,
            objectiveId,
            requestKey: (current?.requestKey ?? 0) + 1,
        }));
        setIsDesktopMapOpen(true);
        if (!window.matchMedia("(min-width: 1700px)").matches) setCompactMapQuestId(questId);
    }, [questId]);

    const selectDetailMap = useCallback((mapKey: string) => {
        if (!questId) return;
        setMapTarget((current) => ({
            questId,
            mapKey,
            objectiveId: null,
            requestKey: (current?.requestKey ?? 0) + 1,
        }));
    }, [questId]);

    const openCompactMap = useCallback(() => {
        if (!questId) return;
        setIsDesktopMapOpen(true);
        setCompactMapQuestId(questId);
    }, [questId]);

    const resizeMapFromPointer = useCallback((clientX: number) => {
        const bounds = detailSplitRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width === 0) return;
        const nextWidth = ((bounds.right - clientX) / bounds.width) * 100;
        setMapWidthPercent(Math.min(65, Math.max(28, nextWidth)));
    }, []);

    const handleDetailScroll = useCallback((scrollTop: number) => {
        if (!questId || window.matchMedia("(min-width: 1024px)").matches) return;
        setCondensedQuestId((current) => {
            if (scrollTop > 38) return questId;
            if (scrollTop < 8) return null;
            return current === questId ? current : null;
        });
    }, [questId]);

    return {
        showDebug,
        setShowDebug,
        isDesktopMapOpen,
        setIsDesktopMapOpen,
        isHeaderCondensed: condensedQuestId === questId,
        isCompactMapOpen,
        closeCompactMap: () => setCompactMapQuestId(null),
        mapWidthPercent,
        setMapWidthPercent,
        isResizingMap,
        setIsResizingMap,
        objectiveFloorNames,
        handleObjectiveFloorsChange: setObjectiveFloorNames,
        hoveredObjectiveId,
        setHoveredObjectiveId,
        mapSectionRef,
        detailScrollRef,
        detailSplitRef,
        detailMaps,
        selectedDetailMapKey,
        selectedDetailMap,
        detailMarkers,
        panelSelectedMap,
        panelMarkers,
        isMapUpdatePending,
        focusedObjectiveId,
        focusRequestKey,
        showObjectiveOnMap,
        selectDetailMap,
        openCompactMap,
        resizeMapFromPointer,
        handleDetailScroll,
    };
}
