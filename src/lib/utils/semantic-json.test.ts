import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeSemanticJson, semanticJsonEqual } from "./semantic-json";

test("semantic JSON ignores object-key and stable-ID array ordering", () => {
    const stored = {
        maps: [
            { id: "woods", name: "Woods" },
            { id: "customs", name: "Customs" },
        ],
        count: 2,
    };
    const current = {
        count: 2,
        maps: [
            { name: "Customs", id: "customs" },
            { name: "Woods", id: "woods" },
        ],
    };

    assert.equal(semanticJsonEqual(stored, current), true);
    assert.deepEqual(canonicalizeSemanticJson(stored), canonicalizeSemanticJson(current));
});

test("semantic JSON ignores primitive set ordering", () => {
    assert.equal(semanticJsonEqual(["complete", "failed"], ["failed", "complete"]), true);
});

test("semantic JSON preserves positional object-array ordering", () => {
    const clockwise = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    const reversed = [...clockwise].reverse();

    assert.equal(semanticJsonEqual(clockwise, reversed), false);
});

test("semantic JSON still detects changed values on stable records", () => {
    assert.equal(
        semanticJsonEqual([{ id: "map", name: "Old" }], [{ id: "map", name: "New" }]),
        false,
    );
});
