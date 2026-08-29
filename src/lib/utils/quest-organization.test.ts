import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "@/types";
import {
    deriveQuestOrganization,
    validateQuestSeriesManifest,
    type QuestSeriesManifest,
} from "./quest-organization";

function makeQuest(
    id: string,
    traderId = "trader-a",
    traderRequirements: FullQuest["traderRequirements"] = [],
): FullQuest {
    return {
        id,
        name: id,
        normalizedName: id,
        experience: 1_000,
        map: null,
        trader: {
            id: traderId,
            name: traderId,
            normalizedName: traderId,
        },
        taskRequirements: [],
        traderRequirements,
        otherRequirements: [],
        requiredPrestige: null,
        objectives: [],
    };
}

function traderRequirement(
    id: string,
    traderId: string,
    value: number,
    requirementType = "level",
): FullQuest["traderRequirements"][number] {
    return {
        id,
        requirementType,
        compareMethod: ">=",
        value,
        trader: {
            id: traderId,
            name: traderId,
            normalizedName: traderId,
        },
    };
}

test("derives all five categories and applies series-first precedence", () => {
    const seriesQuest = makeQuest(
        "series-ll3",
        "trader-a",
        [traderRequirement("series-level", "trader-a", 3)],
    );
    const quests = [
        makeQuest("default"),
        makeQuest("tier-2", "trader-a", [traderRequirement("ll2", "trader-a", 2)]),
        makeQuest("tier-3", "trader-a", [traderRequirement("ll3", "trader-a", 3)]),
        makeQuest("tier-4", "trader-a", [traderRequirement("ll4", "trader-a", 4)]),
        seriesQuest,
    ];
    const manifest: QuestSeriesManifest = {
        version: 1,
        series: [
            {
                id: "sample-series",
                name: "Sample Series",
                traderId: "trader-a",
                members: [{ questId: seriesQuest.id, order: 1 }],
            },
        ],
    };

    const result = deriveQuestOrganization(quests, manifest);

    assert.deepEqual(
        result.entries.map((entry) => [entry.questId, entry.category, entry.issuingTraderTier]),
        [
            ["default", "tier-1", 1],
            ["tier-2", "tier-2", 2],
            ["tier-3", "tier-3", 3],
            ["tier-4", "tier-4", 4],
            ["series-ll3", "series", 3],
        ],
    );
    assert.equal(result.byQuestId.get("series-ll3")?.seriesName, "Sample Series");
    assert.equal(result.byQuestId.get("series-ll3")?.seriesOrder, 1);
});

test("uses only the issuing trader's level gate and supports legacy loyaltyLevel", () => {
    const quests = [
        makeQuest("cross-trader", "trader-a", [
            traderRequirement("other-trader", "trader-b", 4),
        ]),
        makeQuest("legacy-level", "trader-a", [
            traderRequirement("legacy", "trader-a", 2, "loyaltyLevel"),
        ]),
    ];

    const result = deriveQuestOrganization(quests, { version: 1, series: [] });

    assert.equal(result.byQuestId.get("cross-trader")?.category, "tier-1");
    assert.equal(result.byQuestId.get("legacy-level")?.category, "tier-2");
});

test("places an issuing-trader completion milestone in that loyalty bracket", () => {
    const quest = makeQuest("mechanic-ll4-milestone", "Mechanic");
    quest.otherRequirements = [{
        type: "globalVariable",
        variableId: "6a3d1c0990e9ffe15463e961",
        compareMethod: ">=",
        value: 1,
    }];

    const result = deriveQuestOrganization([quest], { version: 1, series: [] });

    assert.equal(result.byQuestId.get(quest.id)?.category, "tier-4");
    assert.equal(result.byQuestId.get(quest.id)?.issuingTraderTier, 4);
});

test("applies reviewed numeric and essential trader-tab overrides", () => {
    const quests = [
        makeQuest("59674eb386f774539f14813a", "prapor"),
        makeQuest("597a171586f77405ba6887d3", "prapor"),
    ];

    const result = deriveQuestOrganization(quests, { version: 1, series: [] });

    assert.deepEqual(
        result.entries.map((entry) => [entry.questId, entry.category, entry.issuingTraderTier]),
        [
            ["59674eb386f774539f14813a", "tier-2", 2],
            ["597a171586f77405ba6887d3", "series", 1],
        ],
    );
    assert.equal(
        result.byQuestId.get("597a171586f77405ba6887d3")?.seriesName,
        "Other essential quests",
    );
});

test("organizes the curated Network Provider line as an essential named series", () => {
    const quest = makeQuest("625d700cc48e6c62a440fab5", "5a7c2eca46aef81a7ca2145d");

    const result = deriveQuestOrganization([quest]);
    const organization = result.byQuestId.get(quest.id);

    assert.equal(organization?.category, "series");
    assert.equal(organization?.seriesId, "network-provider");
    assert.equal(organization?.seriesName, "Network Provider");
    assert.equal(organization?.seriesOrder, 8);
});

test("clamps invalid issuing-trader tiers and reports each issue", () => {
    const quests = [
        makeQuest("too-low", "trader-a", [traderRequirement("low", "trader-a", 0)]),
        makeQuest("too-high", "trader-a", [traderRequirement("high", "trader-a", 9)]),
        makeQuest("fraction", "trader-a", [traderRequirement("fraction", "trader-a", 2.5)]),
    ];

    const result = deriveQuestOrganization(quests, { version: 1, series: [] });

    assert.deepEqual(
        result.entries.map((entry) => [entry.category, entry.issuingTraderTier]),
        [
            ["tier-1", 1],
            ["tier-4", 4],
            ["tier-3", 3],
        ],
    );
    assert.deepEqual(
        result.validationIssues.map((issue) => [issue.code, issue.questId, issue.clampedValue]),
        [
            ["invalid-trader-tier", "too-low", 1],
            ["invalid-trader-tier", "too-high", 4],
            ["invalid-trader-tier", "fraction", 3],
        ],
    );
});

test("validates unknown IDs, duplicate membership/order, and trader mismatches", () => {
    const quests = [makeQuest("known", "trader-a"), makeQuest("other", "trader-b")];
    const manifest: QuestSeriesManifest = {
        version: 1,
        series: [
            {
                id: "first",
                name: "First",
                traderId: "trader-a",
                members: [
                    { questId: "known", order: 1 },
                    { questId: "unknown", order: 1 },
                ],
            },
            {
                id: "second",
                name: "Second",
                traderId: "trader-a",
                members: [
                    { questId: "known", order: 1 },
                    { questId: "other", order: 2 },
                ],
            },
        ],
    };

    const codes = validateQuestSeriesManifest(quests, manifest).map((issue) => issue.code);

    assert.equal(codes.filter((code) => code === "unknown-quest-id").length, 1);
    assert.equal(codes.filter((code) => code === "duplicate-series-membership").length, 1);
    assert.equal(codes.filter((code) => code === "duplicate-series-order").length, 1);
    assert.equal(codes.filter((code) => code === "trader-mismatch").length, 1);
});

test("allows an explicitly declared cross-trader series", () => {
    const quests = [makeQuest("cross-trader", "trader-b")];
    const manifest: QuestSeriesManifest = {
        version: 1,
        series: [
            {
                id: "allowed",
                name: "Allowed",
                traderId: "trader-a",
                allowCrossTrader: true,
                members: [{ questId: "cross-trader", order: 1 }],
            },
        ],
    };

    assert.equal(validateQuestSeriesManifest(quests, manifest).length, 0);
});
