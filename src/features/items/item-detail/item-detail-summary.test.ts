import test from "node:test";
import assert from "node:assert/strict";

import { summarizeItemDetailDemand } from "./item-detail-summary";

test("summarizes incomplete hideout and quest quantities including FiR demand", () => {
    const summary = summarizeItemDetailDemand({
        stationRequirements: [
            [
                "Workbench",
                [
                    {
                        count: 2,
                        isFir: false,
                        isCompleted: false,
                        requirementId: "remaining",
                    },
                    {
                        count: 3,
                        isFir: true,
                        isCompleted: true,
                        requirementId: "station-complete",
                    },
                    {
                        count: 4,
                        isFir: true,
                        isCompleted: false,
                        requirementId: "manually-complete",
                    },
                ],
            ],
        ],
        completedRequirements: { "manually-complete": true },
        questItemState: { requiredCount: 5, requiredFirCount: 5 },
        anyOfGroups: [],
    });

    assert.deepEqual(summary, {
        hideoutRequiredCount: 2,
        hideoutRequiredFirCount: 0,
        questRequiredCount: 5,
        questRequiredFirCount: 5,
        totalRequiredCount: 7,
        totalRequiredFirCount: 5,
    });
});

test("deducts active any-of groups without deducting completed groups", () => {
    const summary = summarizeItemDetailDemand({
        stationRequirements: [],
        completedRequirements: {},
        questItemState: { requiredCount: 8, requiredFirCount: 5 },
        anyOfGroups: [
            { requiredCount: 3, requiredFirCount: 3, status: "available" },
            { requiredCount: 2, requiredFirCount: 2, status: "completed" },
        ],
    });

    assert.equal(summary.questRequiredCount, 5);
    assert.equal(summary.questRequiredFirCount, 2);
});
