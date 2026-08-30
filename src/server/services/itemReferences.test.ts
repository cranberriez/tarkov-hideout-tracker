import assert from "node:assert/strict";
import test from "node:test";
import { resolveItemReferences } from "./itemReferences";

test("missing item references are skipped without discarding valid requirements", () => {
    const missing: string[] = [];
    const resolved = resolveItemReferences(
        [
            { id: "known-requirement", item: "known-item" },
            { id: "missing-requirement", item: "missing-item" },
        ],
        new Map([["known-item", { id: "known-item", name: "Known item" }]]),
        (requirement) => missing.push(requirement.id),
    );

    assert.deepEqual(missing, ["missing-requirement"]);
    assert.deepEqual(resolved, [
        {
            requirement: { id: "known-requirement", item: "known-item" },
            item: { id: "known-item", name: "Known item" },
        },
    ]);
});
