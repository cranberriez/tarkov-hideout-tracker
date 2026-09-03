import assert from "node:assert/strict";
import test from "node:test";
import { recordsByRequestedIds } from "./projection";

test("batch projection deduplicates requested IDs and omits missing records", () => {
    const records = [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
    ];

    assert.deepEqual(recordsByRequestedIds(records, ["b", "missing", "b", "a"]), {
        a: records[0],
        b: records[1],
    });
});

test("batch projection does not leak unrequested records", () => {
    assert.deepEqual(
        recordsByRequestedIds([{ id: "a" }, { id: "b" }], ["missing"]),
        {},
    );
});
