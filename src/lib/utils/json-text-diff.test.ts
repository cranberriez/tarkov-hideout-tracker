import assert from "node:assert/strict";
import test from "node:test";
import { buildSideBySideJsonDiff } from "./json-text-diff";

test("JSON text diff preserves context and marks only changed text", () => {
    const rows = buildSideBySideJsonDiff(
        { count: 5, name: "same" },
        { count: 7, name: "same" },
    );
    const changedRow = rows.find((row) =>
        row.left?.some((segment) => segment.changed),
    );

    assert.ok(changedRow);
    assert.deepEqual(
        changedRow.left?.filter((segment) => segment.changed).map((segment) => segment.text),
        ["5"],
    );
    assert.deepEqual(
        changedRow.right?.filter((segment) => segment.changed).map((segment) => segment.text),
        ["7"],
    );
    assert.ok(rows.some((row) => row.left?.some((segment) => segment.text.includes("same"))));
});

test("JSON text diff aligns added lines with an empty opposite side", () => {
    const rows = buildSideBySideJsonDiff(["one"], ["one", "two"]);
    assert.ok(rows.some((row) => row.left === null && row.right?.some((segment) => segment.changed)));
});
