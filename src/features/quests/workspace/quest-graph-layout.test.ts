import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types/quests";
import type { QuestBranchEdge, QuestBranchLine, QuestBranchNode } from "./quest-branch-graph";
import {
    buildQuestGraphLayout,
    getQuestGraphNodePosition,
    QUEST_GRAPH_NODE_HEIGHT,
    QUEST_GRAPH_NODE_WIDTH,
} from "./quest-graph-layout";

function node(id: string, name: string, rank: number, lane: number): QuestBranchNode {
    return {
        quest: {
            id,
            name,
            normalizedName: name.toLowerCase(),
            experience: 0,
            trader: { id: "trader", name: "Trader", normalizedName: "trader" },
            taskRequirements: [],
            traderRequirements: [],
            otherRequirements: [],
            objectives: [],
        } satisfies FullQuest,
        rank,
        lane,
        canFail: false,
    };
}

function edge(
    id: string,
    sourceId: string,
    targetId: string,
    kind: QuestBranchEdge["kind"] = "requirement",
): QuestBranchEdge {
    return {
        id,
        sourceId,
        targetId,
        kind,
        timing: kind === "exclusive" ? "exclusive" : "complete",
        label: kind === "exclusive" ? "Mutually exclusive" : "On complete",
    };
}

function line(nodes: QuestBranchNode[], edges: QuestBranchEdge[]): QuestBranchLine {
    return { id: "series", name: "Series", kind: "special", nodes, edges };
}

test("places graph nodes on stable rank and lane coordinates", () => {
    const first = node("a", "First", 0, 0);
    const second = node("b", "Second", 2, 1);
    const layout = buildQuestGraphLayout(line([first, second], [edge("a-b", "a", "b")]));

    assert.deepEqual(layout.nodes.map((entry) => entry.position), [
        getQuestGraphNodePosition(first),
        getQuestGraphNodePosition(second),
    ]);
    assert.ok(layout.width >= getQuestGraphNodePosition(second).x + QUEST_GRAPH_NODE_WIDTH);
    assert.ok(layout.height >= getQuestGraphNodePosition(second).y + QUEST_GRAPH_NODE_HEIGHT);
});

test("fans shared requirement ports apart and labels repeated timing once", () => {
    const layout = buildQuestGraphLayout(line(
        [node("a", "Start", 0, 0), node("b", "Left", 1, 0), node("c", "Right", 1, 1)],
        [edge("a-b", "a", "b"), edge("a-c", "a", "c")],
    ));

    assert.equal(new Set(layout.edges.map((entry) => entry.geometry.path)).size, 2);
    assert.equal(layout.edges.filter((entry) => entry.geometry.showLabel).length, 1);
    for (const entry of layout.edges) {
        assert.match(entry.geometry.path, /^M /);
        assert.doesNotMatch(entry.geometry.path, /NaN|undefined/);
    }
});

test("renders highlighted relationships last and dims only unrelated nodes", () => {
    const layout = buildQuestGraphLayout(line(
        [node("a", "Start", 0, 0), node("b", "Middle", 1, 0), node("c", "Other", 0, 1)],
        [edge("a-b", "a", "b"), edge("c-b", "c", "b", "failure")],
    ), "a");

    assert.equal(layout.edges.at(-1)?.edge.id, "a-b");
    assert.equal(layout.edges.at(-1)?.isHighlighted, true);
    assert.deepEqual(
        layout.nodes.map((entry) => [entry.node.quest.id, entry.isConnected]),
        [["a", true], ["b", true], ["c", false]],
    );
});

test("assigns duplicate route labels deterministically by graph position", () => {
    const layout = buildQuestGraphLayout(line(
        [node("later", "Same quest", 2, 0), node("first", "same QUEST", 1, 1)],
        [],
    ));

    assert.deepEqual(
        layout.nodes.map((entry) => [entry.node.quest.id, entry.duplicateRouteIndex]),
        [["later", 1], ["first", 0]],
    );
});
