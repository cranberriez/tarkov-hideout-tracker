"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
    type WheelEvent as ReactWheelEvent,
} from "react";
import {
    getQuestGraphNodePosition,
    QUEST_GRAPH_NODE_HEIGHT,
    QUEST_GRAPH_NODE_WIDTH,
} from "./quest-graph-layout";
import type { QuestBranchNode } from "./quest-branch-graph";

export const QUEST_GRAPH_MIN_ZOOM = 0.5;
export const QUEST_GRAPH_MAX_ZOOM = 1.5;
export const QUEST_GRAPH_ZOOM_STEP = 0.1;

interface DragState {
    pointerId: number;
    clientX: number;
    clientY: number;
    scrollLeft: number;
    scrollTop: number;
}

interface UseQuestGraphViewportOptions {
    lineId: string;
    nodes: readonly QuestBranchNode[];
    focusedQuestId: string | null;
}

interface QuestGraphViewport {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    zoom: number;
    isPanning: boolean;
    changeZoom: (nextZoom: number) => void;
    beginPan: (event: ReactPointerEvent<HTMLDivElement>) => void;
    continuePan: (event: ReactPointerEvent<HTMLDivElement>) => void;
    endPan: (event: ReactPointerEvent<HTMLDivElement>) => void;
    handleWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
}

export function useQuestGraphViewport({
    lineId,
    nodes,
    focusedQuestId,
}: UseQuestGraphViewportOptions): QuestGraphViewport {
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const zoomRef = useRef(zoom);
    const nodesById = useMemo(
        () => new Map(nodes.map((node) => [node.quest.id, node])),
        [nodes],
    );

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const focusedNode = focusedQuestId ? nodesById.get(focusedQuestId) : null;
        const minRank = Math.min(...nodes.map((node) => node.rank));
        const entryNodes = focusedNode
            ? [focusedNode]
            : nodes.filter((node) => node.rank === minRank);
        if (entryNodes.length === 0) return;
        const centerX = entryNodes.reduce(
            (sum, node) => sum + getQuestGraphNodePosition(node).x + QUEST_GRAPH_NODE_WIDTH / 2,
            0,
        ) / entryNodes.length;
        const focusedPosition = focusedNode ? getQuestGraphNodePosition(focusedNode) : null;
        const frame = requestAnimationFrame(() => {
            const currentZoom = zoomRef.current;
            container.scrollTo({
                left: centerX * currentZoom - container.clientWidth / 2,
                top: focusedPosition
                    ? (focusedPosition.y + QUEST_GRAPH_NODE_HEIGHT / 2) * currentZoom - container.clientHeight / 2
                    : 0,
                behavior: "smooth",
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [focusedQuestId, lineId, nodes, nodesById]);

    const changeZoom = useCallback((nextZoom: number) => {
        const currentZoom = zoomRef.current;
        const boundedZoom = Math.min(
            QUEST_GRAPH_MAX_ZOOM,
            Math.max(QUEST_GRAPH_MIN_ZOOM, Math.round(nextZoom * 10) / 10),
        );
        if (boundedZoom === currentZoom) return;
        const container = scrollContainerRef.current;
        const contentCenterX = container
            ? (container.scrollLeft + container.clientWidth / 2) / currentZoom
            : 0;
        const contentCenterY = container
            ? (container.scrollTop + container.clientHeight / 2) / currentZoom
            : 0;
        zoomRef.current = boundedZoom;
        setZoom(boundedZoom);
        if (!container) return;
        requestAnimationFrame(() => {
            container.scrollLeft = contentCenterX * boundedZoom - container.clientWidth / 2;
            container.scrollTop = contentCenterY * boundedZoom - container.clientHeight / 2;
        });
    }, []);

    const beginPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
        dragStateRef.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
            scrollTop: event.currentTarget.scrollTop,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsPanning(true);
    }, []);

    const continuePan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.currentTarget.scrollLeft = drag.scrollLeft - (event.clientX - drag.clientX);
        event.currentTarget.scrollTop = drag.scrollTop - (event.clientY - drag.clientY);
    }, []);

    const endPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragStateRef.current?.pointerId !== event.pointerId) return;
        dragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setIsPanning(false);
    }, []);

    const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        event.currentTarget.scrollLeft += Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX;
    }, []);

    return {
        scrollContainerRef,
        zoom,
        isPanning,
        changeZoom,
        beginPan,
        continuePan,
        endPan,
        handleWheel,
    };
}
