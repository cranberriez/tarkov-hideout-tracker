import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types";
import { prepareQuestSeriesForGameMode } from "../../../lib/utils/quest-series";
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

test("does not infer visualizer series from removed map groups", () => {
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

test("does not expose ordinary reviewed quest series", () => {
    const ids = [
        "666314b4d7f171c4c20226c3",
        "666314b0acf8442f8b0531a1",
        "666314b2a9290f9e0806cca3",
        "666314bafd5ca9577902e03a",
    ];
    const quests = ids.map((id, index) => quest(id, `Good Times ${index + 1}`));

    assert.deepEqual(buildQuestBranchLines(quests), []);
});

test("does not infer an Essential quest series", () => {
    const shady = {
        ...quest("67a09636b8725511260bc421", "Shady Contractor"),
        trader: { id: "mechanic", name: "Mechanic", normalizedName: "mechanic" },
    };
    const needle = {
        ...quest(
            "67a0964e972c11a3f507731b",
            "Needle in a Haystack",
            [{ task: { id: shady.id, name: shady.name }, status: ["complete"] }],
        ),
        trader: { id: "mechanic", name: "Mechanic", normalizedName: "mechanic" },
    };

    assert.deepEqual(buildQuestBranchLines([shady, needle]), []);
});

test("builds the explicit Lightkeeper access line through Information Source", () => {
    const members = [
        ["625d6ff5ddc94657c21a1625", "Network Provider - Part 1"],
        ["625d6ffaf7308432be1d44c5", "Network Provider - Part 2"],
        ["625d6ffcaa168e51321d69d7", "Assessment - Part 1"],
        ["625d6fff4149f1149b5b12c9", "Assessment - Part 2"],
        ["625d7001c4874104f230c0c5", "Assessment - Part 3"],
        ["625d70031ed3bb5bcc5bd9e5", "Key to the Tower"],
        ["625d7005a4eb80027c4f2e09", "Knock-Knock"],
        ["625d700cc48e6c62a440fab5", "Getting Acquainted"],
        ["63966faeea19ac7ed845db2c", "Information Source"],
    ] as const;
    const quests = members.map(([id, name], index) => ({
        ...quest(id, name),
        trader: index === members.length - 1
            ? { id: "lightkeeper", name: "Lightkeeper", normalizedName: "lightkeeper" }
            : { id: "mechanic", name: "Mechanic", normalizedName: "mechanic" },
    }));

    const line = buildQuestBranchLines(quests).find(
        (candidate) => candidate.id === "lightkeeper-access",
    );
    assert.ok(line);
    assert.deepEqual(line.nodes.map((node) => node.quest.id), members.map(([id]) => id));
    assert.deepEqual(line.nodes.map((node) => node.rank), members.map((_, index) => index));
});

test("limits the Lightkeeper graph to Information Source through Trouble in the Big City", () => {
    const informationSource = {
        ...quest("63966faeea19ac7ed845db2c", "Information Source"),
        trader: { id: "lightkeeper", name: "Lightkeeper", normalizedName: "lightkeeper" },
    };
    const missingInformant = {
        ...quest(
            "63966fbeea19ac7ed845db2e",
            "Missing Informant",
            [{ task: { id: informationSource.id, name: informationSource.name }, status: ["complete"] }],
        ),
        trader: informationSource.trader,
    };
    const troubleInTheBigCity = {
        ...quest(
            "63967028c4a91c5cb76abd81",
            "Trouble in the Big City",
            [{ task: { id: missingInformant.id, name: missingInformant.name }, status: ["complete"] }],
        ),
        trader: informationSource.trader,
    };
    const unrelated = {
        ...quest("67a09761e720611a6a01f288", "Keeper's Word"),
        trader: informationSource.trader,
    };

    const line = buildQuestBranchLines([
        informationSource,
        missingInformant,
        troubleInTheBigCity,
        unrelated,
    ]).find(
        (candidate) => candidate.id === "lightkeeper",
    );
    assert.ok(line);
    assert.equal(line.kind, "special");
    assert.deepEqual(line.nodes.map((node) => node.quest.id), [
        informationSource.id,
        missingInformant.id,
        troubleInTheBigCity.id,
    ]);
});

test("builds the Ref graph as a strict forward closure from the PVP Easy Money root", () => {
    const root = {
        ...quest("66058cb22cee99303f1ba067", "Easy Money - Part 1"),
        trader: { id: "skier", name: "Skier", normalizedName: "skier" },
    };
    const easyMoneyTwo = {
        ...quest(
            "66058cb5ae4719735349b9e8",
            "Easy Money - Part 2",
            [{ task: { id: root.id, name: root.name }, status: ["complete"] }],
        ),
        trader: { id: "ref", name: "Ref", normalizedName: "ref" },
    };
    const balancing = {
        ...quest(
            "66058cb7c7f3584787181476",
            "Balancing - Part 1",
            [{ task: { id: easyMoneyTwo.id, name: easyMoneyTwo.name }, status: ["complete"] }],
        ),
        trader: easyMoneyTwo.trader,
    };
    const unrelated = {
        ...quest("697877e0c639962b2e0cf24f", "Unconnected Ref quest"),
        trader: easyMoneyTwo.trader,
    };
    const betweenTwoFires = {
        ...quest(
            "66058ccf06ef1d50a60c1f48",
            "Between Two Fires",
            [{ task: { id: balancing.id, name: balancing.name }, status: ["complete"] }],
        ),
        trader: { id: "fence", name: "Fence", normalizedName: "fence" },
    };
    const surpriseGift = {
        ...quest(
            "67e993b1ac26bf29380a320b",
            "Surprise Gift",
            [{ task: { id: betweenTwoFires.id, name: betweenTwoFires.name }, status: ["active"] }],
        ),
        trader: { id: "lightkeeper", name: "Lightkeeper", normalizedName: "lightkeeper" },
    };
    const decisions = {
        ...quest(
            "66058cd19f59e625462acc90",
            "Decisions, Decisions",
            [{ task: { id: betweenTwoFires.id, name: betweenTwoFires.name }, status: ["active"] }],
        ),
        trader: easyMoneyTwo.trader,
    };

    const line = buildQuestBranchLines([
        root,
        easyMoneyTwo,
        balancing,
        betweenTwoFires,
        surpriseGift,
        decisions,
        unrelated,
    ]).find(
        (candidate) => candidate.id === "ref",
    );
    assert.ok(line);
    assert.equal(line.nodes.some((node) => node.quest.id === unrelated.id), false);
    const choiceNodes = [surpriseGift, betweenTwoFires, decisions].map((choice) =>
        line.nodes.find((node) => node.quest.id === choice.id),
    );
    assert.equal(choiceNodes.every((node) => node !== undefined), true);
    assert.equal(new Set(choiceNodes.map((node) => node?.rank)).size, 1);
    assert.equal(new Set(choiceNodes.map((node) => node?.lane)).size, 3);
});

test("supports the PVE Easy Money root and omits Ref when neither root exists", () => {
    const root = {
        ...quest("6834145ebc1f443d7603c8a7", "Easy Money - Part 1 [PVE ZONE]"),
        trader: { id: "skier", name: "Skier", normalizedName: "skier" },
    };
    const next = {
        ...quest(
            "6834158f2f0e2a7eb90b62c8",
            "Easy Money - Part 2 [PVE ZONE]",
            [{ task: { id: root.id, name: root.name }, status: ["complete"] }],
        ),
        trader: { id: "ref", name: "Ref", normalizedName: "ref" },
    };
    const seasonalOnly = {
        ...quest("675c15fbf7da9792a4059871", "Provide Viewership"),
        trader: next.trader,
    };

    assert.ok(buildQuestBranchLines([root, next]).some((line) => line.id === "ref"));
    assert.equal(buildQuestBranchLines([seasonalOnly]).some((line) => line.id === "ref"), false);
});

test("keeps Lightkeeper quests in the BTR graph only outside seasonal mode", () => {
    const btrStart = quest("btr-start", "BTR start");
    const btrChoice = quest(
        "btr-choice",
        "BTR choice",
        [{ task: { id: btrStart.id, name: btrStart.name }, status: ["active"] }],
    );
    const lightkeeperFollowUp = {
        ...quest(
            "lightkeeper-follow-up",
            "Lightkeeper follow-up",
            [{ task: { id: btrChoice.id, name: btrChoice.name }, status: ["complete"] }],
        ),
        trader: { id: "lightkeeper", name: "Lightkeeper", normalizedName: "lightkeeper" },
    };
    const quests = [btrStart, btrChoice, lightkeeperFollowUp];

    const regularLine = buildQuestBranchLines(
        prepareQuestSeriesForGameMode(quests, "regular"),
    ).find((candidate) => candidate.id === "btr-driver");
    const seasonalLine = buildQuestBranchLines(
        prepareQuestSeriesForGameMode(quests, "pvp-season"),
    ).find((candidate) => candidate.id === "btr-driver");

    assert.ok(regularLine);
    assert.ok(seasonalLine);
    assert.equal(regularLine.nodes.some((node) => node.quest.id === lightkeeperFollowUp.id), true);
    assert.equal(seasonalLine.nodes.some((node) => node.quest.id === lightkeeperFollowUp.id), false);
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
