import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest, TimedResponse } from "@/types";
import { compareFullQuestData } from "./questCacheComparison";

function response(quests: FullQuest[]): TimedResponse<{ quests: FullQuest[] }> {
    return { data: { quests }, updatedAt: 1 };
}

function quest(id: string, name: string, level = 1): FullQuest {
    return { id, name, minPlayerLevel: level } as FullQuest;
}

test("quest comparison identifies additions, removals, and top-level changes", () => {
    const result = compareFullQuestData(
        response([quest("same", "Same"), quest("changed", "Changed"), quest("gone", "Gone")]),
        response([quest("same", "Same"), quest("changed", "Changed", 2), quest("new", "New")]),
    );

    assert.deepEqual(result.added, [{ id: "new", name: "New" }]);
    assert.deepEqual(result.removed, [{ id: "gone", name: "Gone" }]);
    assert.equal(result.changed.length, 1);
    assert.deepEqual(result.changed[0].changedFields, ["minPlayerLevel"]);
    assert.deepEqual(result.changed[0].stored, { minPlayerLevel: 1 });
    assert.deepEqual(result.changed[0].current, { minPlayerLevel: 2 });
    assert.equal(result.unchangedCount, 1);
});

test("quest comparison ignores semantically unordered nested records", () => {
    const storedQuest = {
        ...quest("maps", "Maps"),
        objectives: [
            {
                id: "objective",
                maps: [
                    { id: "woods", name: "Woods" },
                    { id: "customs", name: "Customs" },
                ],
            },
        ],
    } as FullQuest;
    const currentQuest = {
        ...quest("maps", "Maps"),
        objectives: [
            {
                id: "objective",
                maps: [
                    { id: "customs", name: "Customs" },
                    { id: "woods", name: "Woods" },
                ],
            },
        ],
    } as FullQuest;

    const result = compareFullQuestData(response([storedQuest]), response([currentQuest]));
    assert.equal(result.changed.length, 0);
    assert.equal(result.unchangedCount, 1);
});
