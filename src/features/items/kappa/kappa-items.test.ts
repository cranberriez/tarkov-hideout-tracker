import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types";
import { findCollectorQuest, getCollectorRequiredItemIds } from "./kappa-items";

type QuestFixture = Pick<FullQuest, "name" | "normalizedName" | "objectives">;

function quest(
    name: string,
    normalizedName: string,
    objectives: FullQuest["objectives"],
): QuestFixture {
    return { name, normalizedName, objectives };
}

test("finds Collector by normalized name", () => {
    const collector = quest("Localized name", "collector", []);
    assert.equal(findCollectorQuest([quest("Other", "other", []), collector]), collector);
});

test("extracts and deduplicates only Collector give-item IDs", () => {
    const quests: QuestFixture[] = [
        quest("Collector", "collector", [
            {
                id: "give-a",
                type: "giveItem",
                description: "Give items",
                optional: false,
                count: 1,
                foundInRaid: true,
                itemIds: ["item-b", "item-a", "item-a"],
            },
            {
                id: "find-only",
                type: "findItem",
                description: "Find an item",
                optional: false,
                count: 1,
                foundInRaid: true,
                itemIds: ["not-handed-in"],
            },
            {
                id: "visit",
                type: "visit",
                description: "Visit somewhere",
                optional: false,
            },
        ]),
    ];

    assert.deepEqual(getCollectorRequiredItemIds(quests), ["item-b", "item-a"]);
});

test("returns an empty list when Collector is unavailable", () => {
    assert.deepEqual(getCollectorRequiredItemIds([quest("Other", "other", [])]), []);
});
