import test from "node:test";
import assert from "node:assert/strict";

import { mapQuestOtherRequirements } from "./quest-requirements";

test("preserves dialogue and global-variable requirement fields", () => {
    const source = [
        {
            id: "dialogue-gate",
            type: "dialogue",
            traders: ["therapist"],
        },
        {
            id: "variable-gate",
            type: "globalVariable",
            variableId: "event-progress",
            compareMethod: ">=",
            value: 5,
        },
    ];

    const mapped = mapQuestOtherRequirements(source);

    assert.deepEqual(mapped, source);
    assert.notEqual(mapped[0], source[0]);
});

test("maps an unavailable provider field to an empty list", () => {
    assert.deepEqual(mapQuestOtherRequirements(undefined), []);
});
