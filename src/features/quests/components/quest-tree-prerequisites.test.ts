import test from "node:test";
import assert from "node:assert/strict";

import {
    partitionLinkedPrerequisites,
    shouldFoldLinkedPrerequisites,
    type LinkedPrerequisiteStatus,
} from "./quest-tree-prerequisites.ts";

test("shouldFoldLinkedPrerequisites folds ignored quests even with one prerequisite", () => {
    assert.equal(
        shouldFoldLinkedPrerequisites({
            completed: false,
            ignored: true,
            prerequisiteIds: ["root"],
        }),
        true,
    );
});

test("shouldFoldLinkedPrerequisites folds completed quests when they have prerequisite links", () => {
    assert.equal(
        shouldFoldLinkedPrerequisites({
            completed: true,
            ignored: false,
            prerequisiteIds: ["a", "b"],
        }),
        true,
    );
});

test("shouldFoldLinkedPrerequisites keeps completed quests unfolded when there are no prerequisite links", () => {
    assert.equal(
        shouldFoldLinkedPrerequisites({
            completed: true,
            ignored: false,
            prerequisiteIds: [],
        }),
        false,
    );
});

test("shouldFoldLinkedPrerequisites does not fold active quests", () => {
    assert.equal(
        shouldFoldLinkedPrerequisites({
            completed: false,
            ignored: false,
            prerequisiteIds: ["a", "b"],
        }),
        false,
    );
});

function makeLinked(id: string, status: LinkedPrerequisiteStatus) {
    return { id, status };
}

test("partitionLinkedPrerequisites folds all prerequisite links for ignored quests", () => {
    const result = partitionLinkedPrerequisites({
        completed: false,
        ignored: true,
        linkedPrerequisites: [
            makeLinked("completed", "completed"),
            makeLinked("locked", "locked"),
            makeLinked("available", "available"),
        ],
    });

    assert.deepEqual(result.expanded.map((item) => item.id), []);
    assert.deepEqual(result.folded.map((item) => item.id), ["available", "locked", "completed"]);
});

test("partitionLinkedPrerequisites folds only completed prerequisite links for completed quests", () => {
    const result = partitionLinkedPrerequisites({
        completed: true,
        ignored: false,
        linkedPrerequisites: [
            makeLinked("completed-a", "completed"),
            makeLinked("available", "available"),
            makeLinked("locked", "locked"),
            makeLinked("completed-b", "completed"),
        ],
    });

    assert.deepEqual(result.expanded.map((item) => item.id), ["available", "locked"]);
    assert.deepEqual(result.folded.map((item) => item.id), ["completed-a", "completed-b"]);
});

test("partitionLinkedPrerequisites keeps active quests unfolded", () => {
    const result = partitionLinkedPrerequisites({
        completed: false,
        ignored: false,
        linkedPrerequisites: [
            makeLinked("completed", "completed"),
            makeLinked("available", "available"),
            makeLinked("locked", "locked"),
        ],
    });

    assert.deepEqual(result.expanded.map((item) => item.id), [
        "available",
        "locked",
        "completed",
    ]);
    assert.deepEqual(result.folded.map((item) => item.id), []);
});
