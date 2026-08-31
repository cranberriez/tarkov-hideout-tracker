import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types";
import { buildQuestListModel, buildSortedQuestListModel } from "./quest-list-model";
import type { QuestWorkspaceStatusInfo } from "./quest-workspace-utils";

const prapor = { id: "prapor", name: "Prapor", normalizedName: "prapor" };
const therapist = { id: "therapist", name: "Therapist", normalizedName: "therapist" };

function makeQuest(
    id: string,
    trader: FullQuest["trader"],
    options: { level?: number; loyalty?: number; prerequisiteId?: string } = {},
): FullQuest {
    return {
        id,
        name: id,
        normalizedName: id,
        minPlayerLevel: options.level ?? 1,
        experience: 0,
        trader,
        taskRequirements: options.prerequisiteId ? [{
            task: { id: options.prerequisiteId, name: options.prerequisiteId },
            status: ["complete"],
        }] : [],
        traderRequirements: options.loyalty ? [{
            id: `${id}-loyalty`,
            trader,
            requirementType: "loyaltyLevel",
            compareMethod: ">=",
            value: options.loyalty,
        }] : [],
        otherRequirements: [],
        objectives: [],
    };
}

function status(status: QuestWorkspaceStatusInfo["status"]): QuestWorkspaceStatusInfo {
    return { status, label: status, reasons: [], terminal: status === "completed" ? "completed" : null };
}

test("builds stable trader and nested loyalty descriptors containing quest IDs", () => {
    const quests = [
        makeQuest("prapor-one", prapor),
        makeQuest("prapor-two", prapor, { loyalty: 2 }),
        makeQuest("therapist-one", therapist),
    ];
    const model = buildQuestListModel({
        quests,
        allQuests: quests,
        statusByQuestId: new Map(quests.map((quest) => [quest.id, status("active")])),
        groupByTrader: true,
        groupByLoyaltyLevel: true,
    });

    assert.equal(model.questCount, 3);
    assert.deepEqual(model.entries, [
        {
            kind: "group",
            id: "trader:prapor",
            label: "Prapor",
            count: 2,
            image: undefined,
            entries: [
                { kind: "group", id: "trader:prapor:loyalty-level:1", label: "Loyalty level 1", count: 1, nested: true, entries: [{ kind: "quest", questId: "prapor-one" }] },
                { kind: "group", id: "trader:prapor:loyalty-level:2", label: "Loyalty level 2", count: 1, nested: true, entries: [{ kind: "quest", questId: "prapor-two" }] },
            ],
        },
        {
            kind: "group",
            id: "trader:therapist",
            label: "Therapist",
            count: 1,
            image: undefined,
            entries: [{ kind: "group", id: "trader:therapist:loyalty-level:1", label: "Loyalty level 1", count: 1, nested: true, entries: [{ kind: "quest", questId: "therapist-one" }] }],
        },
    ]);
});

test("essential series descriptors retain manifest order and isolate active quests for condensation", () => {
    const first = makeQuest("666314b4d7f171c4c20226c3", prapor);
    const second = makeQuest("666314b0acf8442f8b0531a1", prapor, { prerequisiteId: first.id });
    const model = buildQuestListModel({
        quests: [second, first],
        allQuests: [second, first],
        statusByQuestId: new Map([
            [first.id, status("completed")],
            [second.id, status("active")],
        ]),
        groupByTrader: false,
        groupByLoyaltyLevel: false,
    });

    assert.deepEqual(model.entries, [{
        kind: "essential-category",
        id: "all:essential",
        count: 2,
        entries: [{
            kind: "essential-series",
            id: "all:essential-series:the-good-times",
            title: "The Good Times",
            questIds: [first.id, second.id],
            activeQuestIds: [second.id],
        }],
    }]);
});

test("sorted list model uses canonical manifest order as the stable tie-breaker", () => {
    const first = makeQuest("first", prapor, { level: 10 });
    const second = makeQuest("second", prapor, { level: 5 });
    const model = buildSortedQuestListModel({
        quests: [first, second],
        allQuests: [first, second],
        statusByQuestId: new Map([[first.id, status("active")], [second.id, status("active")]]),
        groupByTrader: false,
        groupByLoyaltyLevel: false,
        sortMode: "level",
    });

    assert.deepEqual(model.entries, [
        { kind: "quest", questId: "second" },
        { kind: "quest", questId: "first" },
    ]);
});
