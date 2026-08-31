import type { QuestBranchEdge, QuestBranchLine, QuestBranchNode } from "./quest-branch-graph";

export const QUEST_GRAPH_NODE_WIDTH = 240;
export const QUEST_GRAPH_NODE_HEIGHT = 74;
export const QUEST_GRAPH_X_STEP = 292;
export const QUEST_GRAPH_Y_STEP = 148;
export const QUEST_GRAPH_PADDING_X = 48;
export const QUEST_GRAPH_PADDING_Y = 54;

export interface QuestGraphPoint {
    x: number;
    y: number;
}

export interface QuestGraphEdgeGeometry {
    path: string;
    labelX: number;
    labelY: number;
    labelRotation?: number;
    showLabel: boolean;
}

export interface QuestGraphNodeLayout {
    node: QuestBranchNode;
    position: QuestGraphPoint;
    duplicateRouteIndex?: number;
    isConnected: boolean;
}

export interface QuestGraphEdgeLayout {
    edge: QuestBranchEdge;
    geometry: QuestGraphEdgeGeometry;
    color: string;
    isHighlighted: boolean;
}

export interface QuestGraphLayout {
    width: number;
    height: number;
    nodesById: ReadonlyMap<string, QuestBranchNode>;
    nodes: readonly QuestGraphNodeLayout[];
    edges: readonly QuestGraphEdgeLayout[];
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

export function getQuestGraphNodePosition(node: QuestBranchNode, offsetX = 0): QuestGraphPoint {
    return {
        x: offsetX + QUEST_GRAPH_PADDING_X + node.lane * QUEST_GRAPH_X_STEP,
        y: QUEST_GRAPH_PADDING_Y + node.rank * QUEST_GRAPH_Y_STEP,
    };
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

function buildSpecialRoutes(
    edges: readonly QuestBranchEdge[],
    nodes: readonly QuestBranchNode[],
    nodesById: ReadonlyMap<string, QuestBranchNode>,
    maxLane: number,
    width: number,
) {
    const outerEdges = edges.filter((edge) => edge.kind !== "requirement");
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
                const sourcePosition = getQuestGraphNodePosition(source);
                const targetPosition = getQuestGraphNodePosition(target);
                const targetBelow = targetRank > sourceRank;
                const targetY = targetPosition.y + (targetBelow ? 0 : QUEST_GRAPH_NODE_HEIGHT);
                const approachY = targetY + (targetBelow ? -(18 + approachOffset) : 18 + approachOffset);
                const sourceY = sourcePosition.y + QUEST_GRAPH_NODE_HEIGHT / 2;
                const verticalTop = Math.min(sourceY, approachY);
                const verticalBottom = Math.max(sourceY, approachY);
                const baseCandidates = [
                    sourcePosition.x - distance,
                    sourcePosition.x + QUEST_GRAPH_NODE_WIDTH + distance,
                    ...nodes.flatMap((node) => {
                        const position = getQuestGraphNodePosition(node);
                        return [position.x - 22, position.x + QUEST_GRAPH_NODE_WIDTH + 22];
                    }),
                    18,
                    width - 18,
                ];
                const candidates = [...new Set(baseCandidates.flatMap((candidate) =>
                    [candidate, candidate - 8, candidate + 8],
                ))].filter((candidate) => candidate >= 8 && candidate <= width - 8);
                const isClear = (candidate: number) => {
                    const sourceSideX = candidate < sourcePosition.x
                        ? sourcePosition.x
                        : sourcePosition.x + QUEST_GRAPH_NODE_WIDTH;
                    const exitLeft = Math.min(sourceSideX, candidate);
                    const exitRight = Math.max(sourceSideX, candidate);
                    return nodes.every((node) => {
                        if (node.quest.id === edge.sourceId || node.quest.id === edge.targetId) return true;
                        const position = getQuestGraphNodePosition(node);
                        const blocksVertical =
                            verticalBottom > position.y + 4 &&
                            verticalTop < position.y + QUEST_GRAPH_NODE_HEIGHT - 4 &&
                            candidate > position.x - 6 &&
                            candidate < position.x + QUEST_GRAPH_NODE_WIDTH + 6;
                        const blocksExit =
                            node.rank === sourceRank &&
                            exitRight > position.x + 4 &&
                            exitLeft < position.x + QUEST_GRAPH_NODE_WIDTH - 4;
                        return !blocksVertical && !blocksExit;
                    });
                };
                gutterX = candidates
                    .filter(isClear)
                    .sort((a, b) => {
                        const aUsage = corridorUsage.get(Math.round(a)) ?? 0;
                        const bUsage = corridorUsage.get(Math.round(b)) ?? 0;
                        return aUsage * 120 + Math.abs(a - (sourcePosition.x + QUEST_GRAPH_NODE_WIDTH / 2)) -
                            (bUsage * 120 + Math.abs(b - (sourcePosition.x + QUEST_GRAPH_NODE_WIDTH / 2)));
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
}

function getEdgeGeometry(
    edge: QuestBranchEdge,
    nodesById: ReadonlyMap<string, QuestBranchNode>,
    routing: EdgeRouting,
): QuestGraphEdgeGeometry | null {
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    if (!source || !target) return null;
    const sourcePosition = getQuestGraphNodePosition(source);
    const targetPosition = getQuestGraphNodePosition(target);

    if (edge.kind === "failure" || edge.kind === "exclusive") {
        const route = routing.specialRouteByEdge.get(edge.id) ?? {
            distance: 22,
            targetOffset: 0,
            approachOffset: 0,
        };
        if (source.rank === target.rank) {
            const x1 = sourcePosition.x + QUEST_GRAPH_NODE_WIDTH / 2;
            const x2 = targetPosition.x + QUEST_GRAPH_NODE_WIDTH / 2;
            const y = sourcePosition.y + QUEST_GRAPH_NODE_HEIGHT;
            const gutterY = y + route.distance;
            return {
                path: `M ${x1} ${y} L ${x1} ${gutterY} L ${x2} ${gutterY} L ${x2} ${y}`,
                labelX: (x1 + x2) / 2,
                labelY: gutterY - 6,
                showLabel: false,
            };
        }
        const targetBelow = targetPosition.y > sourcePosition.y;
        const targetDirectionOffset = Math.sign(source.lane - target.lane || 1) * 10;
        const x1 = sourcePosition.x + QUEST_GRAPH_NODE_WIDTH / 2;
        const y1 = sourcePosition.y + (targetBelow ? QUEST_GRAPH_NODE_HEIGHT : 0);
        const x2 = targetPosition.x + QUEST_GRAPH_NODE_WIDTH / 2 + targetDirectionOffset + route.targetOffset;
        const y2 = targetPosition.y + (targetBelow ? 0 : QUEST_GRAPH_NODE_HEIGHT);
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
        const gutterX = route.gutterX ?? sourcePosition.x + (routeLeft ? -route.distance : QUEST_GRAPH_NODE_WIDTH + route.distance);
        const sourceSideX = sourcePosition.x + (routeLeft ? 0 : QUEST_GRAPH_NODE_WIDTH);
        const sourceSideY = sourcePosition.y + QUEST_GRAPH_NODE_HEIGHT / 2;
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
    const x1 = sourcePosition.x + QUEST_GRAPH_NODE_WIDTH / 2 + ports.source;
    const y1 = sourcePosition.y + QUEST_GRAPH_NODE_HEIGHT;
    const x2 = targetPosition.x + QUEST_GRAPH_NODE_WIDTH / 2 + ports.target;
    const y2 = targetPosition.y;
    const midpoint = (y1 + y2) / 2;
    if (target.rank - source.rank > 1) {
        const direction = target.lane > source.lane
            ? 1
            : target.lane < source.lane
              ? -1
              : source.lane <= routing.centerLane ? -1 : 1;
        const routeX = sourcePosition.x + (direction > 0 ? QUEST_GRAPH_NODE_WIDTH + 24 : -24) + ports.source;
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

function getEdgeColor(edge: QuestBranchEdge) {
    if (edge.kind === "exclusive") return "#d6b66f";
    if (edge.kind === "failure" || edge.timing === "failed") return "#ef5f5f";
    if (edge.timing === "active") return "#69aee8";
    return "#8aa58b";
}

export function buildQuestGraphLayout(
    line: QuestBranchLine,
    activeQuestId: string | null = null,
): QuestGraphLayout {
    const nodesById = new Map(line.nodes.map((node) => [node.quest.id, node]));
    const maxRank = Math.max(0, ...line.nodes.map((node) => node.rank));
    const maxLane = Math.max(0, ...line.nodes.map((node) => node.lane));
    const width = QUEST_GRAPH_PADDING_X * 2 + QUEST_GRAPH_NODE_WIDTH + maxLane * QUEST_GRAPH_X_STEP;
    const height = QUEST_GRAPH_PADDING_Y * 2 + QUEST_GRAPH_NODE_HEIGHT + maxRank * QUEST_GRAPH_Y_STEP;
    const requirementRoutes = buildRequirementRoutes(line.edges, nodesById);
    const requirementLabelEdgeIds = new Set<string>();
    const seenLabels = new Set<string>();
    for (const edge of line.edges) {
        if (edge.kind !== "requirement") continue;
        const key = `${edge.sourceId}:${edge.label}`;
        if (seenLabels.has(key)) continue;
        seenLabels.add(key);
        requirementLabelEdgeIds.add(edge.id);
    }
    const routing: EdgeRouting = {
        specialRouteByEdge: buildSpecialRoutes(line.edges, line.nodes, nodesById, maxLane, width),
        requirementRoutes,
        requirementLabelEdgeIds,
        centerLane: maxLane / 2,
    };

    const duplicateRouteByQuestId = new Map<string, number>();
    const duplicateGroups = new Map<string, QuestBranchNode[]>();
    for (const node of line.nodes) {
        const key = node.quest.name.trim().toLowerCase();
        duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), node]);
    }
    for (const group of duplicateGroups.values()) {
        if (group.length < 2) continue;
        [...group]
            .sort((a, b) => a.rank - b.rank || a.lane - b.lane || a.quest.id.localeCompare(b.quest.id))
            .forEach((node, index) => duplicateRouteByQuestId.set(node.quest.id, index));
    }

    const connectedQuestIds = new Set<string>();
    if (activeQuestId) {
        connectedQuestIds.add(activeQuestId);
        for (const edge of line.edges) {
            if (edge.sourceId === activeQuestId) connectedQuestIds.add(edge.targetId);
            if (edge.targetId === activeQuestId) connectedQuestIds.add(edge.sourceId);
        }
    }
    const kindOrder = { failure: 0, exclusive: 1, requirement: 2 } as const;
    const orderedEdges = [...line.edges].sort((a, b) => {
        const aHighlighted = Boolean(activeQuestId && (a.sourceId === activeQuestId || a.targetId === activeQuestId));
        const bHighlighted = Boolean(activeQuestId && (b.sourceId === activeQuestId || b.targetId === activeQuestId));
        if (aHighlighted !== bHighlighted) return Number(aHighlighted) - Number(bHighlighted);
        return kindOrder[a.kind] - kindOrder[b.kind];
    });

    return {
        width,
        height,
        nodesById,
        nodes: line.nodes.map((node) => ({
            node,
            position: getQuestGraphNodePosition(node),
            duplicateRouteIndex: duplicateRouteByQuestId.get(node.quest.id),
            isConnected: !activeQuestId || connectedQuestIds.has(node.quest.id),
        })),
        edges: orderedEdges.flatMap((edge) => {
            const geometry = getEdgeGeometry(edge, nodesById, routing);
            if (!geometry) return [];
            return [{
                edge,
                geometry,
                color: getEdgeColor(edge),
                isHighlighted: Boolean(activeQuestId && (edge.sourceId === activeQuestId || edge.targetId === activeQuestId)),
            }];
        }),
    };
}
