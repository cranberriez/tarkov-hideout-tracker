import type { FullQuest, QuestFailConditionTaskStatus } from "../../../types";
import { getQuestRelationTiming, type QuestRelationTiming } from "../../../lib/utils/quest-relations";
import { statusIncludesComplete } from "../../../lib/utils/quest-failures";

export type QuestBranchEdgeKind = "requirement" | "failure" | "exclusive";

export interface QuestBranchEdge {
    id: string;
    sourceId: string;
    targetId: string;
    kind: QuestBranchEdgeKind;
    timing: QuestRelationTiming | "exclusive";
    label: string;
}

export interface QuestBranchNode {
    quest: FullQuest;
    rank: number;
    lane: number;
    canFail: boolean;
}

export interface QuestBranchLine {
    id: string;
    name: string;
    nodes: QuestBranchNode[];
    edges: QuestBranchEdge[];
}

function isTaskStatusCondition(
    condition: NonNullable<FullQuest["failConditions"]>[number],
): condition is QuestFailConditionTaskStatus {
    return condition.type === "taskStatus" && "task" in condition && "status" in condition;
}

function timingLabel(timing: QuestRelationTiming) {
    switch (timing) {
        case "active": return "On accept";
        case "failed": return "On fail";
        case "resolved": return "On complete or fail";
        default: return "On complete";
    }
}

function buildEdges(quests: readonly FullQuest[]) {
    const questIds = new Set(quests.map((quest) => quest.id));
    const requirementEdges: QuestBranchEdge[] = [];
    const failurePairs = new Map<string, QuestBranchEdge>();

    for (const quest of quests) {
        for (const requirement of quest.taskRequirements) {
            if (!questIds.has(requirement.task.id)) continue;
            const timing = getQuestRelationTiming(requirement.status);
            requirementEdges.push({
                id: `requirement:${requirement.task.id}:${quest.id}:${timing}`,
                sourceId: requirement.task.id,
                targetId: quest.id,
                kind: "requirement",
                timing,
                label: timingLabel(timing),
            });
        }

        for (const condition of quest.failConditions ?? []) {
            if (!isTaskStatusCondition(condition) || condition.optional) continue;
            if (!statusIncludesComplete(condition.status) || !questIds.has(condition.task.id)) continue;
            failurePairs.set(`${condition.task.id}:${quest.id}`, {
                id: `failure:${condition.task.id}:${quest.id}`,
                sourceId: condition.task.id,
                targetId: quest.id,
                kind: "failure",
                timing: "complete",
                label: "On complete · fails",
            });
        }
    }

    const failureEdges: QuestBranchEdge[] = [];
    const consumed = new Set<string>();
    for (const [key, edge] of failurePairs) {
        if (consumed.has(key)) continue;
        const reverseKey = `${edge.targetId}:${edge.sourceId}`;
        if (failurePairs.has(reverseKey)) {
            const [sourceId, targetId] = [edge.sourceId, edge.targetId].sort();
            failureEdges.push({
                id: `exclusive:${sourceId}:${targetId}`,
                sourceId,
                targetId,
                kind: "exclusive",
                timing: "exclusive",
                label: "Mutually exclusive",
            });
            consumed.add(reverseKey);
        } else {
            failureEdges.push(edge);
        }
        consumed.add(key);
    }

    return [...requirementEdges, ...failureEdges];
}

function connectedComponents(quests: readonly FullQuest[], edges: readonly QuestBranchEdge[]) {
    const neighbors = new Map(quests.map((quest) => [quest.id, new Set<string>()]));
    for (const edge of edges) {
        neighbors.get(edge.sourceId)?.add(edge.targetId);
        neighbors.get(edge.targetId)?.add(edge.sourceId);
    }

    const visited = new Set<string>();
    const result: string[][] = [];
    for (const quest of quests) {
        if (visited.has(quest.id)) continue;
        const component: string[] = [];
        const pending = [quest.id];
        visited.add(quest.id);
        while (pending.length > 0) {
            const questId = pending.pop()!;
            component.push(questId);
            for (const neighborId of neighbors.get(questId) ?? []) {
                if (visited.has(neighborId)) continue;
                visited.add(neighborId);
                pending.push(neighborId);
            }
        }
        result.push(component);
    }
    return result;
}

function layoutNodes(
    quests: readonly FullQuest[],
    componentIds: ReadonlySet<string>,
    componentEdges: readonly QuestBranchEdge[],
    centeredQuestId?: string,
) {
    const prerequisiteParents = new Map<string, string[]>();
    for (const edge of componentEdges) {
        if (edge.kind !== "requirement") continue;
        const parents = prerequisiteParents.get(edge.targetId) ?? [];
        parents.push(edge.sourceId);
        prerequisiteParents.set(edge.targetId, parents);
    }

    const rankMemo = new Map<string, number>();
    const getRank = (questId: string, visiting = new Set<string>()): number => {
        const memoized = rankMemo.get(questId);
        if (memoized !== undefined) return memoized;
        if (visiting.has(questId)) return 0;
        const nextVisiting = new Set(visiting).add(questId);
        const parents = prerequisiteParents.get(questId) ?? [];
        const rank = parents.length === 0
            ? 0
            : Math.max(...parents.map((parentId) => getRank(parentId, nextVisiting) + 1));
        rankMemo.set(questId, rank);
        return rank;
    };

    const componentQuests = quests.filter((quest) => componentIds.has(quest.id));
    const originalOrder = new Map(componentQuests.map((quest, index) => [quest.id, index]));
    const nodesByRank = new Map<number, FullQuest[]>();
    const rankById = new Map<string, number>();
    for (const quest of componentQuests) {
        const rank = getRank(quest.id);
        rankById.set(quest.id, rank);
        const rankNodes = nodesByRank.get(rank) ?? [];
        rankNodes.push(quest);
        nodesByRank.set(rank, rankNodes);
    }

    const parentsById = new Map<string, string[]>();
    for (const edge of componentEdges) {
        if (edge.kind !== "requirement") continue;
        const parents = parentsById.get(edge.targetId) ?? [];
        parents.push(edge.sourceId);
        parentsById.set(edge.targetId, parents);
    }

    // Lanes are global columns rather than row-local indexes. A quest therefore
    // remains directly beneath its predecessor whenever that column is free.
    // Sibling routes take the nearest adjacent column and keep it on later ranks.
    const laneById = new Map<string, number>();
    const rootLaneById = new Map(
        [...(nodesByRank.get(0) ?? [])]
            .sort((a, b) => (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0))
            .map((quest, lane) => [quest.id, lane]),
    );
    const maxRank = Math.max(0, ...nodesByRank.keys());
    for (let rank = 0; rank <= maxRank; rank += 1) {
        const rankNodes = nodesByRank.get(rank) ?? [];
        const preferredLane = (questId: string) => {
            const parentLanes = (parentsById.get(questId) ?? [])
                .map((parentId) => laneById.get(parentId))
                .filter((lane): lane is number => lane !== undefined);
            if (parentLanes.length === 0) return rootLaneById.get(questId) ?? 0;
            return parentLanes.reduce((sum, lane) => sum + lane, 0) / parentLanes.length;
        };
        rankNodes.sort((a, b) =>
            preferredLane(a.id) - preferredLane(b.id) ||
            (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0),
        );

        const occupied: number[] = [];
        const isOccupied = (candidate: number) =>
            occupied.some((lane) => Math.abs(candidate - lane) < 1);
        for (const quest of rankNodes) {
            const preferred = preferredLane(quest.id);
            let lane = preferred;
            for (let distance = 1; isOccupied(lane); distance += 1) {
                const left = preferred - distance;
                const right = preferred + distance;
                lane = !isOccupied(left) ? left : right;
            }
            occupied.push(lane);
            laneById.set(quest.id, lane);
        }
    }

    if (centeredQuestId && laneById.has(centeredQuestId)) {
        const prerequisiteLanes = [...laneById]
            .filter(([questId]) => questId !== centeredQuestId)
            .map(([, lane]) => lane);
        if (prerequisiteLanes.length > 0) {
            laneById.set(
                centeredQuestId,
                (Math.min(...prerequisiteLanes) + Math.max(...prerequisiteLanes)) / 2,
            );
        }
    }

    const minLane = Math.min(0, ...laneById.values());
    if (minLane < 0) {
        for (const [questId, lane] of laneById) laneById.set(questId, lane - minLane);
    }

    return componentQuests.map((quest) => ({
        quest,
        rank: rankById.get(quest.id) ?? 0,
        lane: laneById.get(quest.id) ?? 0,
        canFail: (quest.failConditions ?? []).length > 0,
    }));
}

export function buildQuestBranchLines(quests: readonly FullQuest[]): QuestBranchLine[] {
    const edges = buildEdges(quests);
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const components = connectedComponents(quests, edges);
    const lines: QuestBranchLine[] = [];

    const makeLine = (
        id: string,
        name: string,
        questIds: Iterable<string>,
        collapseFailureBranches = false,
        centeredQuestId?: string,
    ) => {
        const componentIds = new Set([...questIds].filter((questId) => questsById.has(questId)));
        if (componentIds.size < 2) return;
        const componentEdges = edges.filter(
            (edge) => componentIds.has(edge.sourceId) && componentIds.has(edge.targetId),
        );
        const initialNodes = layoutNodes(quests, componentIds, componentEdges, centeredQuestId);
        let visibleEdges = componentEdges;
        if (collapseFailureBranches) {
            const rankById = new Map(initialNodes.map((node) => [node.quest.id, node.rank]));
            const keptFailureSourceIds = new Set<string>();
            visibleEdges = componentEdges.filter((edge) => {
                if (edge.kind !== "failure") return true;
                if (keptFailureSourceIds.has(edge.sourceId)) return false;
                const sourceFailures = componentEdges.filter(
                    (candidate) => candidate.kind === "failure" && candidate.sourceId === edge.sourceId,
                );
                const earliest = [...sourceFailures].sort(
                    (a, b) => (rankById.get(a.targetId) ?? 0) - (rankById.get(b.targetId) ?? 0),
                )[0];
                if (earliest?.id !== edge.id) return false;
                keptFailureSourceIds.add(edge.sourceId);
                return true;
            });
        }
        lines.push({
            id,
            name,
            nodes: layoutNodes(quests, componentIds, visibleEdges, centeredQuestId),
            edges: visibleEdges,
        });
    };

    const btrComponent = components
        .filter((ids) => ids.some((questId) => {
            const trader = questsById.get(questId)?.trader;
            return trader?.normalizedName === "btr-driver" || trader?.name === "BTR Driver";
        }))
        .filter((ids) => ids.some((questId) => {
            const quest = questsById.get(questId);
            return (quest?.failConditions?.length ?? 0) > 0 || quest?.taskRequirements.some(
                (requirement) => getQuestRelationTiming(requirement.status) !== "complete",
            );
        }))
        .sort((a, b) => b.length - a.length)[0];
    if (btrComponent) {
        makeLine(
            "btr-driver",
            "BTR Driver questline",
            btrComponent,
            true,
        );
    }

    const collectReverseClosure = (rootId: string) => {
        const result = new Set<string>();
        const pending = [rootId];
        while (pending.length > 0) {
            const questId = pending.pop()!;
            if (result.has(questId)) continue;
            result.add(questId);
            for (const requirement of questsById.get(questId)?.taskRequirements ?? []) {
                if (questsById.has(requirement.task.id)) pending.push(requirement.task.id);
            }
        }
        return result;
    };
    const collector = quests.find(
        (quest) => quest.normalizedName === "collector" || quest.name === "Collector",
    );
    if (collector) {
        makeLine(
            "collector",
            "Collector questline",
            collectReverseClosure(collector.id),
            false,
            collector.id,
        );
    }

    return lines;
}
