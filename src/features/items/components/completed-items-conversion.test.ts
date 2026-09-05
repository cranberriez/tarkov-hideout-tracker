import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCompletedItemConversions,
    removeConvertedRequirements,
} from "./completed-items-conversion";

test("preserves completed requirement records that were not converted", () => {
    const completedRequirements = {
        "known-requirement": true,
        "already-reached-requirement": true,
        "missing-from-release": true,
    };
    const result = buildCompletedItemConversions(
        [{
            id: "station-a",
            name: "Station A",
            levels: [
                {
                    level: 1,
                    itemRequirements: [{
                        id: "already-reached-requirement",
                        itemId: "old-item",
                        count: 2,
                        isFir: false,
                    }],
                },
                {
                    level: 2,
                    itemRequirements: [{
                        id: "known-requirement",
                        itemId: "item-a",
                        count: 3,
                        isFir: true,
                    }],
                },
            ],
        }],
        [{ id: "item-a", name: "Item A" }],
        { "station-a": 1 },
        completedRequirements,
    );

    assert.deepEqual(result.conversions, [{
        itemId: "item-a",
        itemName: "Item A",
        total: 3,
        totalFir: 3,
    }]);
    assert.deepEqual(
        removeConvertedRequirements(completedRequirements, result.convertedRequirementIds),
        {
            "already-reached-requirement": true,
            "missing-from-release": true,
        },
    );
});
