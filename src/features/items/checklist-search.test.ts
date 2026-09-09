import assert from "node:assert/strict";
import test from "node:test";
import {
    buildChecklistSearchIds,
    findOutsideFilterMatches,
    matchesChecklistSearch,
} from "./checklist-search";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";

const item = (id: string, name = id): ItemSummary => ({
    id,
    name,
    normalizedName: name.toLowerCase().replaceAll(" ", "-"),
    shortName: "Test",
});

test("search matches names, short names and normalized names with case-insensitive terms", () => {
    const target = item("a", "Electric Motor");
    assert.equal(matchesChecklistSearch(target, " MOTOR electric "), true);
    assert.equal(matchesChecklistSearch(target, "test"), true);
    assert.equal(matchesChecklistSearch(target, "electric-motor"), true);
    assert.equal(matchesChecklistSearch(target, "electric wire"), false);
    assert.equal(matchesChecklistSearch(undefined, "motor"), false);
});

test("full search membership includes every station level and quest alternative, scoped by source", () => {
    const stations = [
        {
            levels: [
                { itemRequirements: [{ itemId: "early" }] },
                { itemRequirements: [{ itemId: "late" }] },
            ],
        },
    ] as Station[];
    const quests = [{ itemId: "quest", quests: [] }];
    const groups = [{ itemIds: ["alternative", "quest"] }] as Parameters<
        typeof buildChecklistSearchIds
    >[2];
    assert.deepEqual(
        [...buildChecklistSearchIds(stations, quests, groups, "hideout")],
        ["early", "late"],
    );
    assert.deepEqual(
        [...buildChecklistSearchIds(stations, quests, groups, "quest")],
        ["quest", "alternative"],
    );
    assert.deepEqual(
        [...buildChecklistSearchIds(stations, quests, groups, "all")],
        ["early", "late", "quest", "alternative"],
    );
});

test("outside matches exclude visible rows and alternatives, deduplicate and report missing data", () => {
    const result = findOutsideFilterMatches({
        query: "test",
        sourceIds: new Set(["visible", "alternative", "z", "a", "missing"]),
        visibleIds: new Set(["visible", "alternative"]),
        itemById: Object.fromEntries(
            ["visible", "alternative", "z", "a", "unrelated"].map((id) => [id, item(id)]),
        ),
    });
    assert.deepEqual(
        result.items.map((item) => item.id),
        ["a", "z"],
    );
    assert.deepEqual(result.missingIds, ["missing"]);
});

test("blank and unmatched queries do not expose unrelated full-list items", () => {
    for (const query of ["  ", "no match"]) {
        assert.deepEqual(
            findOutsideFilterMatches({
                query,
                sourceIds: new Set(["a"]),
                visibleIds: new Set(),
                itemById: { a: item("a") },
            }).items,
            [],
        );
    }
});

test("search uses only the supplied mode's item data", () => {
    const input = { query: "motor", sourceIds: new Set(["shared"]), visibleIds: new Set<string>() };
    assert.equal(
        findOutsideFilterMatches({ ...input, itemById: { shared: item("shared", "Motor") } }).items
            .length,
        1,
    );
    assert.equal(
        findOutsideFilterMatches({ ...input, itemById: { shared: item("shared", "Wire") } }).items
            .length,
        0,
    );
});
