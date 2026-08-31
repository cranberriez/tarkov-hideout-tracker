import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuestObjective, QuestSpecificItem } from "@/types";
import { buildObjectivePresentation } from "./quest-objective-presentation";

function regularObjective(id: string, type: "findItem" | "giveItem", itemIds: string[]): FullQuestObjective {
    return { id, type, description: id, optional: false, count: 1, foundInRaid: false, itemIds };
}

function questItemObjective(id: string, type: "pickupQuestItem" | "findQuestItem", itemId: string): FullQuestObjective {
    const questItem: QuestSpecificItem = { id: itemId, name: itemId, normalizedName: itemId };
    return { id, type, description: id, optional: false, count: 1, questItem };
}

test("moves matching find-item objectives next to their hand-in and hides duplicate items", () => {
    const result = buildObjectivePresentation([
        regularObjective("find", "findItem", ["b", "a"]),
        { id: "other", type: "extract", description: "other", optional: false, exitName: null },
        regularObjective("give", "giveItem", ["a", "b"]),
    ]);

    assert.deepEqual(result.map(({ objective, showItems }) => [objective.id, showItems]), [
        ["other", true],
        ["find", false],
        ["give", true],
    ]);
});

test("groups repeated quest-item objectives at the last occurrence", () => {
    const result = buildObjectivePresentation([
        questItemObjective("pick-up", "pickupQuestItem", "folder"),
        { id: "visit", type: "extract", description: "visit", optional: false, exitName: null },
        questItemObjective("find", "findQuestItem", "folder"),
    ]);

    assert.deepEqual(result.map(({ objective, showItems }) => [objective.id, showItems]), [
        ["visit", true],
        ["pick-up", false],
        ["find", true],
    ]);
});

test("leaves unrelated objectives in source order", () => {
    const result = buildObjectivePresentation([
        regularObjective("find-a", "findItem", ["a"]),
        regularObjective("give-b", "giveItem", ["b"]),
    ]);

    assert.deepEqual(result.map(({ objective, showItems }) => [objective.id, showItems]), [
        ["find-a", true],
        ["give-b", true],
    ]);
});
