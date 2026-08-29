import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types";
import { buildQuestBranchLines } from "./quest-branch-graph";

function quest(
    id: string,
    name: string,
    requirements: FullQuest["taskRequirements"] = [],
    failConditions: FullQuest["failConditions"] = [],
): FullQuest {
    return {
        id,
        name,
        normalizedName: name.toLowerCase(),
        experience: 0,
        trader: { id: "btr", name: "BTR Driver", normalizedName: "btr-driver" },
        taskRequirements: requirements,
        failConditions,
        traderRequirements: [],
        otherRequirements: [],
        objectives: [],
    };
}

test("keeps branched questlines with three or more quests", () => {
    const quests = [
        quest("a", "Start"),
        quest("b", "Success", [{ task: { id: "a", name: "Start" }, status: ["complete"] }]),
        quest("c", "Recovery", [{ task: { id: "b", name: "Success" }, status: ["failed"] }]),
    ];
    const [line] = buildQuestBranchLines(quests);
    assert.equal(line.name, "BTR Driver questline");
    assert.deepEqual(line.nodes.map((node) => node.rank), [0, 1, 2]);
    assert.equal(line.edges.find((edge) => edge.targetId === "c")?.label, "On fail");
});

test("collapses reciprocal completion failures into a mutual exclusion edge", () => {
    const failure = (id: string) => [{
        id: `fail-${id}`,
        type: "taskStatus" as const,
        description: "",
        optional: false,
        task: { id },
        status: ["complete"],
    }];
    const quests = [
        quest("a", "Start"),
        quest("b", "Choice one", [{ task: { id: "a", name: "Start" }, status: ["active"] }], failure("c")),
        quest("c", "Choice two", [{ task: { id: "a", name: "Start" }, status: ["active"] }], failure("b")),
    ];
    const [line] = buildQuestBranchLines(quests);
    assert.equal(line.edges.filter((edge) => edge.kind === "exclusive").length, 1);
    assert.equal(line.edges.filter((edge) => edge.kind === "failure").length, 0);
});

test("omits ordinary linear chains", () => {
    const quests = [
        quest("a", "One"),
        quest("b", "Two", [{ task: { id: "a", name: "One" }, status: ["complete"] }]),
        quest("c", "Three", [{ task: { id: "b", name: "Two" }, status: ["complete"] }]),
    ];
    assert.deepEqual(buildQuestBranchLines(quests), []);
});

test("keeps the complete connected progression around a qualifying branch", () => {
    const quests = [
        quest("a", "Start"),
        quest("b", "Choice", [{ task: { id: "a", name: "Start" }, status: ["active"] }]),
        quest("c", "Follow-up", [{ task: { id: "b", name: "Choice" }, status: ["complete"] }]),
        quest("d", "Long route", [{ task: { id: "c", name: "Follow-up" }, status: ["complete"] }]),
        quest("e", "Collector gate", [{ task: { id: "d", name: "Long route" }, status: ["complete"] }]),
        quest("f", "Collector", [{ task: { id: "e", name: "Collector gate" }, status: ["complete"] }]),
    ];
    const [line] = buildQuestBranchLines(quests);
    assert.deepEqual(line.nodes.map((node) => node.quest.id), ["a", "b", "c", "d", "e", "f"]);
});

test("generates Collector strictly backward and excludes downstream side quests", () => {
    const quests = [
        quest("root", "Root"),
        quest("gate", "Collector gate", [{ task: { id: "root", name: "Root" }, status: ["complete"] }]),
        quest("collector", "Collector", [{ task: { id: "gate", name: "Collector gate" }, status: ["complete"] }]),
        quest("side", "Unrelated follow-up", [{ task: { id: "gate", name: "Collector gate" }, status: ["complete"] }]),
    ];

    const collectorLine = buildQuestBranchLines(quests).find((line) => line.id === "collector");
    assert.ok(collectorLine);
    assert.deepEqual(
        collectorLine.nodes.map((node) => node.quest.id),
        ["root", "gate", "collector"],
    );
});

test("condenses repeated BTR failure routes to one per source quest", () => {
    const failureFrom = (sourceId: string) => [{
        id: `fail-${sourceId}`,
        type: "taskStatus" as const,
        description: "",
        optional: false,
        task: { id: sourceId },
        status: ["complete"],
    }];
    const quests = [
        quest("start", "Start"),
        quest("route", "Route", [{ task: { id: "start", name: "Start" }, status: ["active"] }]),
        quest("failed-one", "Failed one", [], failureFrom("route")),
        quest("failed-two", "Failed two", [], failureFrom("route")),
    ];

    const btrLine = buildQuestBranchLines(quests).find((line) => line.id === "btr-driver");
    assert.ok(btrLine);
    assert.equal(
        btrLine.edges.filter((edge) => edge.kind === "failure" && edge.sourceId === "route").length,
        1,
    );
});

test("only exposes the BTR Driver and Collector visualizers", () => {
    const labyrinthMap = { id: "labyrinth", name: "The Labyrinth", normalizedName: "the-labyrinth" };
    const icebreakerMap = { id: "icebreaker", name: "Icebreaker", normalizedName: "icebreaker" };
    const quests = [
        quest("btr-start", "BTR start"),
        quest("btr-choice", "BTR choice", [{ task: { id: "btr-start", name: "BTR start" }, status: ["active"] }]),
        quest("collector-gate", "Collector gate"),
        quest("collector", "Collector", [{ task: { id: "collector-gate", name: "Collector gate" }, status: ["complete"] }]),
        { ...quest("shady", "Shady Contractor"), map: labyrinthMap },
        { ...quest("keeper", "Keeper's Word", [{ task: { id: "shady", name: "Shady Contractor" }, status: ["complete"] }]), map: labyrinthMap },
        { ...quest("ice-one", "Ice one"), map: icebreakerMap },
        { ...quest("ice-two", "Ice two"), map: icebreakerMap },
    ];

    assert.deepEqual(
        buildQuestBranchLines(quests).map((line) => line.id),
        ["btr-driver", "collector"],
    );
});

test("keeps each BTR route in its predecessor column", () => {
    const quests = [
        quest("start", "Start"),
        quest("route-a", "Route A", [{ task: { id: "start", name: "Start" }, status: ["active"] }]),
        quest("route-b", "Route B", [{ task: { id: "start", name: "Start" }, status: ["active"] }]),
        quest("route-a-next", "Route A next", [{ task: { id: "route-a", name: "Route A" }, status: ["complete"] }]),
        quest("route-b-next", "Route B next", [{ task: { id: "route-b", name: "Route B" }, status: ["complete"] }]),
    ];

    const line = buildQuestBranchLines(quests).find((candidate) => candidate.id === "btr-driver");
    assert.ok(line);
    const laneById = new Map(line.nodes.map((node) => [node.quest.id, node.lane]));
    assert.equal(laneById.get("route-a-next"), laneById.get("route-a"));
    assert.equal(laneById.get("route-b-next"), laneById.get("route-b"));
    assert.notEqual(laneById.get("route-a"), laneById.get("route-b"));
});

test("keeps Collector prerequisite chains stable and centers Collector", () => {
    const quests = [
        quest("left-root", "Left root"),
        quest("right-root", "Right root"),
        quest("left-gate", "Left gate", [{ task: { id: "left-root", name: "Left root" }, status: ["complete"] }]),
        quest("right-gate", "Right gate", [{ task: { id: "right-root", name: "Right root" }, status: ["complete"] }]),
        quest("collector", "Collector", [
            { task: { id: "left-gate", name: "Left gate" }, status: ["complete"] },
            { task: { id: "right-gate", name: "Right gate" }, status: ["complete"] },
        ]),
    ];

    const line = buildQuestBranchLines(quests).find((candidate) => candidate.id === "collector");
    assert.ok(line);
    const laneById = new Map(line.nodes.map((node) => [node.quest.id, node.lane]));
    assert.equal(laneById.get("left-gate"), laneById.get("left-root"));
    assert.equal(laneById.get("right-gate"), laneById.get("right-root"));
    assert.equal(
        laneById.get("collector"),
        ((laneById.get("left-root") ?? 0) + (laneById.get("right-root") ?? 0)) / 2,
    );
});

test("preserves duplicate-name quest records as separate stable routes", () => {
    const quests = [
        quest("start", "Start"),
        quest("duplicate-a", "Same assignment", [{ task: { id: "start", name: "Start" }, status: ["active"] }]),
        quest("duplicate-b", "Same assignment", [{ task: { id: "start", name: "Start" }, status: ["active"] }]),
        quest("finish-a", "Finish A", [{ task: { id: "duplicate-a", name: "Same assignment" }, status: ["complete"] }]),
        quest("finish-b", "Finish B", [{ task: { id: "duplicate-b", name: "Same assignment" }, status: ["complete"] }]),
    ];

    const line = buildQuestBranchLines(quests).find((candidate) => candidate.id === "btr-driver");
    assert.ok(line);
    const duplicateNodes = line.nodes.filter((node) => node.quest.name === "Same assignment");
    assert.deepEqual(duplicateNodes.map((node) => node.quest.id), ["duplicate-a", "duplicate-b"]);
    assert.notEqual(duplicateNodes[0].lane, duplicateNodes[1].lane);
    const laneById = new Map(line.nodes.map((node) => [node.quest.id, node.lane]));
    assert.equal(laneById.get("finish-a"), laneById.get("duplicate-a"));
    assert.equal(laneById.get("finish-b"), laneById.get("duplicate-b"));
});
