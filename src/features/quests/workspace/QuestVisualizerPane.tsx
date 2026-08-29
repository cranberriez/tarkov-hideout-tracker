"use client";

import { ArrowLeft, GitBranch, Lock, XCircle } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { cn } from "@/lib/utils";
import type { QuestBranchEdge, QuestBranchLine, QuestBranchNode } from "./quest-branch-graph";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 74;
const X_STEP = 292;
const Y_STEP = 148;
const PADDING_X = 48;
const PADDING_Y = 54;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

function nodePosition(node: QuestBranchNode, offsetX = 0) {
    return {
        x: offsetX + PADDING_X + node.lane * X_STEP,
        y: PADDING_Y + node.rank * Y_STEP,
    };
}

interface EdgeRouting {
    specialRouteByEdge: ReadonlyMap<string, {
        distance: number;
        targetOffset: number;
        approachOffset: number;
        gutterX?: number;
    }>;
    requirementRoutes: ReadonlyMap<string, {
        source: number;
        target: number;
        channelOffset: number;
        approachOffset: number;
    }>;
    requirementLabelEdgeIds: ReadonlySet<string>;
    centerLane: number;
}

interface EdgeGeometry {
    path: string;
    labelX: number;
    labelY: number;
    labelRotation?: number;
    showLabel: boolean;
}

function buildRequirementRoutes(
    edges: readonly QuestBranchEdge[],
    nodesById: ReadonlyMap<string, QuestBranchNode>,
) {
    const offsets = new Map<string, {
        source: number;
        target: number;
        channelOffset: number;
        approachOffset: number;
    }>();
    const requirementEdges = edges.filter((edge) => edge.kind === "requirement");
    const addPorts = (key: "sourceId" | "targetId", port: "source" | "target") => {
        const groups = new Map<string, QuestBranchEdge[]>();
        for (const edge of requirementEdges) {
            const group = groups.get(edge[key]) ?? [];
            group.push(edge);
            groups.set(edge[key], group);
        }
        for (const group of groups.values()) {
            group.sort((a, b) => {
                const aOther = nodesById.get(port === "source" ? a.targetId : a.sourceId);
                const bOther = nodesById.get(port === "source" ? b.targetId : b.sourceId);
                return (aOther?.lane ?? 0) - (bOther?.lane ?? 0);
            });
            group.forEach((edge, index) => {
                const current = offsets.get(edge.id) ?? {
                    source: 0,
                    target: 0,
                    channelOffset: 0,
                    approachOffset: 0,
                };
                current[port] = (index - (group.length - 1) / 2) * 12;
                if (port === "target") {
                    current.channelOffset = (index - (group.length - 1) / 2) * 8;
                    current.approachOffset = index * 8;
                }
                offsets.set(edge.id, current);
            });
        }
    };
    addPorts("sourceId", "source");
    addPorts("targetId", "target");
    return offsets;
}

function edgeGeometry(
    edge: QuestBranchEdge,
    nodesById: ReadonlyMap<string, QuestBranchNode>,
    routing: EdgeRouting,
): EdgeGeometry | null {
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    if (!source || !target) return null;
    const sourcePosition = nodePosition(source);
    const targetPosition = nodePosition(target);

    if (edge.kind === "failure" || edge.kind === "exclusive") {
        const route = routing.specialRouteByEdge.get(edge.id) ?? {
            distance: 22,
            targetOffset: 0,
            approachOffset: 0,
        };
        const distance = route.distance;
        if (source.rank === target.rank) {
            const x1 = sourcePosition.x + NODE_WIDTH / 2;
            const x2 = targetPosition.x + NODE_WIDTH / 2;
            const y = sourcePosition.y + NODE_HEIGHT;
            const gutterY = y + distance;
            return {
                path: `M ${x1} ${y} L ${x1} ${gutterY} L ${x2} ${gutterY} L ${x2} ${y}`,
                labelX: (x1 + x2) / 2,
                labelY: gutterY - 6,
                showLabel: false,
            };
        }
        const targetBelow = targetPosition.y > sourcePosition.y;
        const targetDirectionOffset = Math.sign(source.lane - target.lane || 1) * 10;
        const x1 = sourcePosition.x + NODE_WIDTH / 2;
        const y1 = sourcePosition.y + (targetBelow ? NODE_HEIGHT : 0);
        const x2 = targetPosition.x + NODE_WIDTH / 2 + targetDirectionOffset + route.targetOffset;
        const y2 = targetPosition.y + (targetBelow ? 0 : NODE_HEIGHT);
        if (Math.abs(source.rank - target.rank) === 1) {
            const midpoint = (y1 + y2) / 2 + route.approachOffset;
            return {
                path: `M ${x1} ${y1} L ${x1} ${midpoint} L ${x2} ${midpoint} L ${x2} ${y2}`,
                labelX: (x1 + x2) / 2,
                labelY: midpoint,
                showLabel: false,
            };
        }
        const routeLeft = source.lane <= routing.centerLane;
        const gutterX = route.gutterX ?? sourcePosition.x + (routeLeft ? -distance : NODE_WIDTH + distance);
        const sourceSideX = sourcePosition.x + (routeLeft ? 0 : NODE_WIDTH);
        const sourceSideY = sourcePosition.y + NODE_HEIGHT / 2;
        const approachDistance = 18 + route.approachOffset;
        const approachY = y2 + (targetBelow ? -approachDistance : approachDistance);
        return {
            path: `M ${sourceSideX} ${sourceSideY} L ${gutterX} ${sourceSideY} L ${gutterX} ${approachY} L ${x2} ${approachY} L ${x2} ${y2}`,
            labelX: gutterX,
            labelY: (sourceSideY + approachY) / 2,
            showLabel: false,
        };
    }

    const ports = routing.requirementRoutes.get(edge.id) ?? {
        source: 0,
        target: 0,
        channelOffset: 0,
        approachOffset: 0,
    };
    const x1 = sourcePosition.x + NODE_WIDTH / 2 + ports.source;
    const y1 = sourcePosition.y + NODE_HEIGHT;
    const x2 = targetPosition.x + NODE_WIDTH / 2 + ports.target;
    const y2 = targetPosition.y;
    const midpoint = (y1 + y2) / 2;
    if (target.rank - source.rank > 1) {
        const direction = target.lane > source.lane
            ? 1
            : target.lane < source.lane
              ? -1
              : source.lane <= routing.centerLane ? -1 : 1;
        const routeX = sourcePosition.x + (direction > 0 ? NODE_WIDTH + 24 : -24) + ports.source;
        const leaveY = y1 + 18;
        const approachY = y2 - 18 - ports.approachOffset;
        return {
            path: `M ${x1} ${y1} L ${x1} ${leaveY} L ${routeX} ${leaveY} L ${routeX} ${approachY} L ${x2} ${approachY} L ${x2} ${y2}`,
            labelX: (x1 + routeX) / 2,
            labelY: leaveY - 6,
            showLabel: routing.requirementLabelEdgeIds.has(edge.id),
        };
    }
    const channelY = midpoint + ports.channelOffset;
    return {
        path: x1 === x2
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} L ${x1} ${channelY} L ${x2} ${channelY} L ${x2} ${y2}`,
        labelX: (x1 + x2) / 2,
        labelY: channelY - 7,
        showLabel: routing.requirementLabelEdgeIds.has(edge.id),
    };
}

function edgeColor(edge: QuestBranchEdge) {
    if (edge.kind === "exclusive") return "#d6b66f";
    if (edge.kind === "failure" || edge.timing === "failed") return "#ef5f5f";
    if (edge.timing === "active") return "#69aee8";
    return "#8aa58b";
}

function LineIndex({ onSelect }: { onSelect: (line: QuestBranchLine) => void }) {
    const { branchLines, statusByQuestId } = useQuestWorkspace();
    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="mx-auto max-w-4xl">
                <div className="mb-5">
                    <h2 className="font-serif text-xl font-semibold text-gray-100">Quest series</h2>
                </div>
                {branchLines.length === 0 ? (
                    <div className="border border-white/8 bg-white/3 px-5 py-8 text-center text-sm text-gray-500">
                        No branched quest series are available in the current quest data.
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                        {branchLines.map((line) => {
                            const activeNodes = line.nodes.filter(
                                (node) => statusByQuestId.get(node.quest.id)?.status === "active",
                            );
                            const entryNodes = activeNodes.length > 0
                                ? activeNodes
                                : line.nodes.filter((node) => node.rank === 0);
                            return (
                                <button
                                    key={line.id}
                                    type="button"
                                    onClick={() => onSelect(line)}
                                    aria-label={`View ${line.name}`}
                                    className="flex h-full flex-col items-stretch justify-start border border-white/10 bg-[#111214] p-4 text-left align-top transition-colors hover:border-tarkov-green/40 hover:bg-[#151719] focus-visible:border-tarkov-green/60 focus-visible:outline-none"
                                >
                                    <div className="flex items-center gap-2">
                                        <GitBranch size={16} className="text-tarkov-green" />
                                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{line.name}</h3>
                                        <span className="text-[10px] uppercase tracking-wider text-gray-600">{line.nodes.length} quests</span>
                                    </div>
                                    <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                                        {activeNodes.length > 0 ? "Currently active" : "Start here"}
                                    </p>
                                    <div className="space-y-1.5">
                                        {entryNodes.map((node) => (
                                            <div
                                                key={node.quest.id}
                                                className="flex w-full items-center gap-2 border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-300"
                                            >
                                                <TraderIcon node={node} />
                                                <span className="min-w-0 flex-1 truncate">{node.quest.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function TraderIcon({ node }: { node: QuestBranchNode }) {
    const image = node.quest.trader.image4xLink ?? node.quest.trader.imageLink;
    return image ? (
        <img src={image} alt="" className="h-6 w-6 shrink-0 rounded-full border border-white/10 object-cover" />
    ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] text-gray-500">
            {node.quest.trader.name.slice(0, 1)}
        </span>
    );
}

function SeriesGraph({ line, onBack }: { line: QuestBranchLine; onBack: () => void }) {
    const { statusByQuestId, setSelectedQuestId, setMode } = useQuestWorkspace();
    const [hoveredQuestId, setHoveredQuestId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<{
        pointerId: number;
        clientX: number;
        clientY: number;
        scrollLeft: number;
        scrollTop: number;
    } | null>(null);
    const displayNodes = line.nodes;
    const nodesById = useMemo(
        () => new Map(displayNodes.map((node) => [node.quest.id, node])),
        [displayNodes],
    );
    const maxRank = Math.max(0, ...displayNodes.map((node) => node.rank));
    const maxLane = Math.max(0, ...displayNodes.map((node) => node.lane));
    const baseNodeAreaWidth = PADDING_X * 2 + NODE_WIDTH + maxLane * X_STEP;
    const outerEdges = useMemo(
        () => line.edges.filter((edge) => edge.kind !== "requirement"),
        [line.edges],
    );
    const specialRouteByEdge = useMemo(() => {
        const routeCountByCorridor = new Map<string, number>();
        const targetGroups = new Map<string, QuestBranchEdge[]>();
        for (const edge of outerEdges) {
            if (nodesById.get(edge.sourceId)?.rank === nodesById.get(edge.targetId)?.rank) continue;
            const group = targetGroups.get(edge.targetId) ?? [];
            group.push(edge);
            targetGroups.set(edge.targetId, group);
        }
        const targetOffsetByEdge = new Map<string, number>();
        const targetIndexByEdge = new Map<string, number>();
        for (const group of targetGroups.values()) {
            group.sort((a, b) =>
                (nodesById.get(a.sourceId)?.lane ?? 0) - (nodesById.get(b.sourceId)?.lane ?? 0),
            );
            group.forEach((edge, index) => {
                targetOffsetByEdge.set(edge.id, (index - (group.length - 1) / 2) * 10);
                targetIndexByEdge.set(edge.id, index);
            });
        }
        const corridorUsage = new Map<number, number>();
        const routes = new Map<string, {
            distance: number;
            targetOffset: number;
            approachOffset: number;
            gutterX?: number;
        }>();
        for (const edge of outerEdges) {
            const sourceLane = nodesById.get(edge.sourceId)?.lane ?? 0;
            const targetLane = nodesById.get(edge.targetId)?.lane ?? sourceLane;
            const sourceRank = nodesById.get(edge.sourceId)?.rank ?? 0;
            const targetRank = nodesById.get(edge.targetId)?.rank ?? sourceRank;
            const side = sourceLane <= maxLane / 2 ? "left" : "right";
            const corridorKey = sourceRank === targetRank
                ? `row:${sourceRank}:${Math.min(sourceLane, targetLane)}:${Math.max(sourceLane, targetLane)}`
                : `column:${side}:${sourceLane}`;
            const routeIndex = routeCountByCorridor.get(corridorKey) ?? 0;
            routeCountByCorridor.set(corridorKey, routeIndex + 1);
            const distance = 22 + routeIndex * 10;
            const approachOffset = (targetIndexByEdge.get(edge.id) ?? 0) * 8;
            let gutterX: number | undefined;

            if (Math.abs(sourceRank - targetRank) > 1) {
                const source = nodesById.get(edge.sourceId);
                const target = nodesById.get(edge.targetId);
                if (source && target) {
                    const sourcePosition = nodePosition(source);
                    const targetPosition = nodePosition(target);
                    const targetBelow = targetRank > sourceRank;
                    const targetY = targetPosition.y + (targetBelow ? 0 : NODE_HEIGHT);
                    const approachY = targetY + (targetBelow ? -(18 + approachOffset) : 18 + approachOffset);
                    const sourceY = sourcePosition.y + NODE_HEIGHT / 2;
                    const verticalTop = Math.min(sourceY, approachY);
                    const verticalBottom = Math.max(sourceY, approachY);
                    const baseCandidates = [
                        sourcePosition.x - distance,
                        sourcePosition.x + NODE_WIDTH + distance,
                        ...displayNodes.flatMap((node) => {
                            const position = nodePosition(node);
                            return [position.x - 22, position.x + NODE_WIDTH + 22];
                        }),
                        18,
                        baseNodeAreaWidth - 18,
                    ];
                    const candidates = [...new Set(baseCandidates.flatMap((candidate) =>
                        [candidate, candidate - 8, candidate + 8],
                    ))].filter((candidate) => candidate >= 8 && candidate <= baseNodeAreaWidth - 8);
                    const isClear = (candidate: number) => {
                        const sourceSideX = candidate < sourcePosition.x
                            ? sourcePosition.x
                            : sourcePosition.x + NODE_WIDTH;
                        const exitLeft = Math.min(sourceSideX, candidate);
                        const exitRight = Math.max(sourceSideX, candidate);
                        return displayNodes.every((node) => {
                            if (node.quest.id === edge.sourceId || node.quest.id === edge.targetId) return true;
                            const position = nodePosition(node);
                            const blocksVertical =
                                verticalBottom > position.y + 4 &&
                                verticalTop < position.y + NODE_HEIGHT - 4 &&
                                candidate > position.x - 6 &&
                                candidate < position.x + NODE_WIDTH + 6;
                            const blocksExit =
                                node.rank === sourceRank &&
                                exitRight > position.x + 4 &&
                                exitLeft < position.x + NODE_WIDTH - 4;
                            return !blocksVertical && !blocksExit;
                        });
                    };
                    gutterX = candidates
                        .filter(isClear)
                        .sort((a, b) => {
                            const aUsage = corridorUsage.get(Math.round(a)) ?? 0;
                            const bUsage = corridorUsage.get(Math.round(b)) ?? 0;
                            return aUsage * 120 + Math.abs(a - (sourcePosition.x + NODE_WIDTH / 2)) -
                                (bUsage * 120 + Math.abs(b - (sourcePosition.x + NODE_WIDTH / 2)));
                        })[0];
                    if (gutterX !== undefined) {
                        const key = Math.round(gutterX);
                        corridorUsage.set(key, (corridorUsage.get(key) ?? 0) + 1);
                    }
                }
            }

            routes.set(edge.id, {
                distance,
                targetOffset: targetOffsetByEdge.get(edge.id) ?? 0,
                approachOffset,
                gutterX,
            });
        }
        return routes;
    },
        [baseNodeAreaWidth, displayNodes, maxLane, nodesById, outerEdges],
    );
    const requirementRoutes = useMemo(
        () => buildRequirementRoutes(line.edges, nodesById),
        [line.edges, nodesById],
    );
    const requirementLabelEdgeIds = useMemo(() => {
        const seen = new Set<string>();
        const result = new Set<string>();
        for (const edge of line.edges) {
            if (edge.kind !== "requirement") continue;
            const key = `${edge.sourceId}:${edge.label}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.add(edge.id);
        }
        return result;
    }, [line.edges]);
    const routing = useMemo<EdgeRouting>(() => ({
        specialRouteByEdge,
        requirementRoutes,
        requirementLabelEdgeIds,
        centerLane: maxLane / 2,
    }), [maxLane, requirementLabelEdgeIds, requirementRoutes, specialRouteByEdge]);
    const duplicateRouteByQuestId = useMemo(() => {
        const groups = new Map<string, QuestBranchNode[]>();
        for (const node of displayNodes) {
            const key = node.quest.name.trim().toLowerCase();
            const group = groups.get(key) ?? [];
            group.push(node);
            groups.set(key, group);
        }
        const result = new Map<string, { index: number }>();
        for (const group of groups.values()) {
            if (group.length < 2) continue;
            [...group]
                .sort((a, b) => a.rank - b.rank || a.lane - b.lane || a.quest.id.localeCompare(b.quest.id))
                .forEach((node, index) => result.set(node.quest.id, { index }));
        }
        return result;
    }, [displayNodes]);
    const width = baseNodeAreaWidth;
    const height = PADDING_Y * 2 + NODE_HEIGHT + maxRank * Y_STEP;
    const connectedQuestIds = useMemo(() => {
        if (!hoveredQuestId) return new Set<string>();
        const result = new Set([hoveredQuestId]);
        for (const edge of line.edges) {
            if (edge.sourceId === hoveredQuestId) result.add(edge.targetId);
            if (edge.targetId === hoveredQuestId) result.add(edge.sourceId);
        }
        return result;
    }, [hoveredQuestId, line.edges]);
    const orderedEdges = useMemo(
        () => [...line.edges].sort((a, b) => {
            const aHighlighted = hoveredQuestId && (a.sourceId === hoveredQuestId || a.targetId === hoveredQuestId);
            const bHighlighted = hoveredQuestId && (b.sourceId === hoveredQuestId || b.targetId === hoveredQuestId);
            if (aHighlighted !== bHighlighted) return Number(aHighlighted) - Number(bHighlighted);
            const order = { failure: 0, exclusive: 1, requirement: 2 };
            return order[a.kind] - order[b.kind];
        }),
        [hoveredQuestId, line.edges],
    );

    const changeZoom = (nextZoom: number) => {
        const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(nextZoom * 10) / 10));
        if (boundedZoom === zoom) return;
        const container = scrollContainerRef.current;
        const contentCenterX = container ? (container.scrollLeft + container.clientWidth / 2) / zoom : 0;
        const contentCenterY = container ? (container.scrollTop + container.clientHeight / 2) / zoom : 0;
        setZoom(boundedZoom);
        if (!container) return;
        requestAnimationFrame(() => {
            container.scrollLeft = contentCenterX * boundedZoom - container.clientWidth / 2;
            container.scrollTop = contentCenterY * boundedZoom - container.clientHeight / 2;
        });
    };

    const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    };

    const continuePan = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.currentTarget.scrollLeft = drag.scrollLeft - (event.clientX - drag.clientX);
        event.currentTarget.scrollTop = drag.scrollTop - (event.clientY - drag.clientY);
    };

    const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragStateRef.current?.pointerId !== event.pointerId) return;
        dragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setIsPanning(false);
    };

    const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        event.currentTarget.scrollLeft += Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX;
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-white/8 bg-[#0e0f11] px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white">
                        <ArrowLeft size={14} /> All series
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <h2 className="text-sm font-semibold text-gray-100">{line.name}</h2>
                    <span className="text-[10px] uppercase tracking-wider text-gray-600">{line.nodes.length} quests</span>
                    <div className="ml-auto flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                        <span><i className="mr-1.5 inline-block h-0.5 w-5 bg-sky-400/80 align-middle" /> on accept</span>
                        <span><i className="mr-1.5 inline-block h-0.5 w-5 bg-tarkov-green/70 align-middle" /> on complete</span>
                        <span><i className="mr-1.5 inline-block h-0.5 w-5 bg-red-400/90 align-middle" /> on fail / fails</span>
                        <span><i className="mr-1.5 inline-block h-0.5 w-5 border-t border-dotted border-amber-300/70 align-middle" /> exclusive</span>
                        <div className="ml-1 flex items-center border border-white/10 bg-black/20">
                            <button
                                type="button"
                                onClick={() => changeZoom(zoom - ZOOM_STEP)}
                                disabled={zoom <= MIN_ZOOM}
                                aria-label="Zoom out"
                                title="Zoom out"
                                className="flex h-7 w-7 items-center justify-center text-sm text-gray-300 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                            >−</button>
                            <button
                                type="button"
                                onClick={() => changeZoom(1)}
                                aria-label="Reset zoom"
                                title="Reset zoom"
                                className="h-7 min-w-11 border-x border-white/10 px-1 text-[9px] tabular-nums text-gray-500 transition-colors hover:bg-white/8 hover:text-white"
                            >{Math.round(zoom * 100)}%</button>
                            <button
                                type="button"
                                onClick={() => changeZoom(zoom + ZOOM_STEP)}
                                disabled={zoom >= MAX_ZOOM}
                                aria-label="Zoom in"
                                title="Zoom in"
                                className="flex h-7 w-7 items-center justify-center text-sm text-gray-300 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                            >+</button>
                        </div>
                    </div>
                </div>
            </div>
            <div
                ref={scrollContainerRef}
                onPointerDown={beginPan}
                onPointerMove={continuePan}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onWheel={handleWheel}
                title="Drag to pan · Scroll vertically · Shift + scroll horizontally"
                className={cn(
                    "min-h-0 flex-1 select-none overflow-auto bg-[radial-gradient(circle_at_50%_20%,#151719,#0b0c0e_65%)]",
                    isPanning ? "cursor-grabbing" : "cursor-grab",
                )}
            >
                <div className="relative" style={{ width: width * zoom, height: height * zoom }}>
                    <div
                        className="absolute left-0 top-0 origin-top-left"
                        style={{ width, height, transform: `scale(${zoom})` }}
                    >
                    <svg className="absolute inset-0" width={width} height={height} aria-hidden="true">
                        <defs>
                            <marker id="quest-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
                            </marker>
                        </defs>
                        {orderedEdges.map((edge) => {
                            const geometry = edgeGeometry(edge, nodesById, routing);
                            if (!geometry) return null;
                            const color = edgeColor(edge);
                            const isHighlighted = hoveredQuestId !== null &&
                                (edge.sourceId === hoveredQuestId || edge.targetId === hoveredQuestId);
                            const sourceName = nodesById.get(edge.sourceId)?.quest.name ?? edge.sourceId;
                            const targetName = nodesById.get(edge.targetId)?.quest.name ?? edge.targetId;
                            return (
                                <g
                                    key={edge.id}
                                    opacity={hoveredQuestId ? (isHighlighted ? 1 : 0.08) : 0.82}
                                    className="transition-opacity duration-150"
                                >
                                    <title>{`${sourceName} → ${targetName}: ${edge.label}`}</title>
                                    <path
                                        d={geometry.path}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={isHighlighted ? "2.75" : "1.5"}
                                        strokeDasharray={edge.kind === "exclusive" ? "2 5" : undefined}
                                        markerEnd={edge.kind === "exclusive" ? undefined : "url(#quest-flow-arrow)"}
                                    />
                                    {geometry.showLabel && (
                                        <text
                                            x={geometry.labelX}
                                            y={geometry.labelY}
                                            textAnchor="middle"
                                            fill={color}
                                            stroke="#0b0c0e"
                                            strokeWidth="5"
                                            paintOrder="stroke"
                                            transform={geometry.labelRotation ? `rotate(${geometry.labelRotation} ${geometry.labelX} ${geometry.labelY})` : undefined}
                                            className="text-[10px] font-medium"
                                        >
                                            {edge.label}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                    {displayNodes.map((node) => {
                        const position = nodePosition(node);
                        const status = statusByQuestId.get(node.quest.id);
                        const traderImage = node.quest.trader.image4xLink ?? node.quest.trader.imageLink;
                        const duplicateRoute = duplicateRouteByQuestId.get(node.quest.id);
                        return (
                            <button
                                key={node.quest.id}
                                type="button"
                                onClick={() => {
                                    setSelectedQuestId(node.quest.id);
                                    setMode("details");
                                }}
                                title={`Open ${node.quest.name}`}
                                onMouseEnter={() => setHoveredQuestId(node.quest.id)}
                                onMouseLeave={() => setHoveredQuestId(null)}
                                onFocus={() => setHoveredQuestId(node.quest.id)}
                                onBlur={() => setHoveredQuestId(null)}
                                className={cn(
                                    "absolute flex h-[74px] w-[240px] cursor-pointer items-start gap-3 border bg-[#151619] px-3 pt-3 text-left shadow-lg transition-[opacity,filter,border-color,background-color] duration-150 hover:border-tarkov-green/50 hover:bg-[#191b1e] focus-visible:z-20",
                                    hoveredQuestId && !connectedQuestIds.has(node.quest.id) ? "opacity-20 grayscale" : "z-10 opacity-100",
                                    status?.status === "completed" ? "border-tarkov-green/35" : status?.status === "failed" ? "border-red-400/40" : status?.status === "active" ? "border-sky-400/35" : "border-white/12",
                                )}
                                style={{ left: position.x, top: position.y }}
                            >
                                {traderImage ? <img src={traderImage} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover" /> : <TraderIcon node={node} />}
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-start gap-1.5">
                                        <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-4 text-gray-100">{node.quest.name}</span>
                                        {duplicateRoute && (
                                            <span className="shrink-0 border border-amber-300/20 bg-amber-300/5 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-200/65">
                                                Route {String.fromCharCode(65 + duplicateRoute.index)}
                                            </span>
                                        )}
                                    </span>
                                    <span className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-gray-600">
                                        {status?.status === "locked" && <Lock size={9} />}
                                        {status?.status === "failed" && <XCircle size={9} />}
                                        {status?.label ?? node.quest.trader.name}
                                        {node.canFail && <span className="text-red-300/65">· can fail</span>}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function QuestVisualizerPane() {
    const { branchLines, branchLineByQuestId, selectedQuestId } = useQuestWorkspace();
    const selectedQuestLine = selectedQuestId ? branchLineByQuestId.get(selectedQuestId) ?? null : null;
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
    const [showIndex, setShowIndex] = useState(false);

    const selectedLine = showIndex
        ? null
        : selectedLineId
          ? branchLines.find((line) => line.id === selectedLineId) ?? null
          : selectedQuestLine;

    if (!selectedLine) {
        return <LineIndex onSelect={(line) => { setSelectedLineId(line.id); setShowIndex(false); }} />;
    }

    return <SeriesGraph line={selectedLine} onBack={() => setShowIndex(true)} />;
}
