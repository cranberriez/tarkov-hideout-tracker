import assert from "node:assert/strict";
import test from "node:test";
import { normalizeQuestObjectiveLocations } from "./quest-objective-locations";

const maps = {
    customs: { id: "customs", name: "Customs", normalizedName: "customs" },
    factory: { id: "factory", name: "Factory", normalizedName: "factory" },
};

test("normalizes zone points, outlines, and height bounds without synthesizing geometry", () => {
    const locations = normalizeQuestObjectiveLocations({
        zones: [
            {
                map: "customs",
                position: { x: 10, y: 2, z: -4 },
                outline: [{ x: 9, y: 2, z: -5 }, { x: 11, y: 2, z: -3 }],
                top: 5,
                bottom: -1,
            },
            { map: "factory", outline: [{ x: 1, y: 2, z: 3 }] },
        ],
    }, (id) => id && id in maps ? maps[id as keyof typeof maps] : null);

    assert.deepEqual(locations[0], {
        map: maps.customs,
        position: { x: 10, y: 2, z: -4 },
        outline: [{ x: 9, y: 2, z: -5 }, { x: 11, y: 2, z: -3 }],
        top: 5,
        bottom: -1,
        source: "zone",
    });
    assert.equal(locations[1].position, undefined);
    assert.deepEqual(locations[1].outline, [{ x: 1, y: 2, z: 3 }]);
});

test("flattens possible quest-item positions and rejects malformed points", () => {
    const locations = normalizeQuestObjectiveLocations({
        possibleLocations: [{
            map: "customs",
            positions: [{ x: 1, y: 2, z: 3 }, { x: 4, y: "bad", z: 6 }, null],
        }],
    }, (id) => id === "customs" ? maps.customs : null);

    assert.deepEqual(locations, [{
        map: maps.customs,
        position: { x: 1, y: 2, z: 3 },
        outline: [],
        source: "possibleLocation",
    }]);
});
