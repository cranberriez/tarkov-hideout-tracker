import assert from "node:assert/strict";
import test from "node:test";
import type { ItemRelationsPayload } from "@/types/contracts";
import { buildStationRequirements, mergeItemDetailItems } from "./item-detail-data";

test("mergeItemDetailItems lets later scoped summaries replace earlier ones", () => {
    const itemsById = mergeItemDetailItems(
        [{ id: "item-a", name: "Initial", normalizedName: "initial" }],
        [
            { id: "item-b", name: "Related", normalizedName: "related" },
            { id: "item-a", name: "Priced", normalizedName: "priced" },
        ],
    );

    assert.equal(itemsById["item-a"].name, "Priced");
    assert.equal(itemsById["item-b"].name, "Related");
});

test("buildStationRequirements applies player progress and station ordering", () => {
    const relations = {
        hideoutRequirements: [
            {
                station: {
                    id: "station-lavatory",
                    name: "Lavatory",
                    normalizedName: "lavatory",
                },
                stationMaxLevel: 3,
                level: 2,
                requirement: {
                    id: "requirement-lavatory",
                    itemId: "item-a",
                    count: 4,
                    isFir: false,
                },
            },
            {
                station: {
                    id: "station-heating",
                    name: "Heating",
                    normalizedName: "heating",
                },
                stationMaxLevel: 3,
                level: 1,
                requirement: {
                    id: "requirement-heating",
                    itemId: "item-a",
                    count: 2,
                    isFir: true,
                },
            },
        ],
    } as ItemRelationsPayload;

    const requirements = buildStationRequirements(relations, {
        "station-heating": 3,
        "station-lavatory": 1,
    });

    assert.deepEqual(requirements.map(([name]) => name), ["Lavatory", "Heating"]);
    assert.equal(requirements[0][1][0].isCompleted, false);
    assert.equal(requirements[1][1][0].isCompleted, true);
    assert.equal(requirements[1][1][0].isStationMaxed, true);
});
