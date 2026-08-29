import assert from "node:assert/strict";
import test from "node:test";
import { reduceMapOverlays } from "./pull-map-overlays.mjs";

test("reduceMapOverlays hydrates labels and keeps only positioned overlays", () => {
    const snapshot = reduceMapOverlays({
        maps: {
            map1: {
                id: "map1",
                name: "map1 Name",
                normalizedName: "sample-map",
                extracts: [
                    { id: "extract1", name: "extract1 Name", faction: "pmc", position: { x: 1, y: 2, z: 3 }, outline: [{ x: 4, y: 5, z: 6 }] },
                    { id: "missing-position", name: "Unused" },
                ],
                transits: [{
                    id: "transit1",
                    description: "transit1 Description",
                    map: "map2",
                    position: { x: 10, y: 11, z: 12 },
                }],
                bosses: [{
                    mob: "boss1",
                    spawnChance: 0.25,
                    spawnLocations: [
                        { name: "zone1 Name", spawnKey: "zone1", chance: 1, positions: [{ x: 7, y: 8, z: 9 }] },
                        { name: "empty", positions: [] },
                    ],
                }],
            },
            map2: {
                id: "map2",
                name: "map2 Name",
                normalizedName: "destination-map",
            },
        },
        mobs: {
            boss1: { id: "boss1", name: "boss1 Name", normalizedName: "the-boss" },
        },
    }, {
        "map1 Name": "Sample Map",
        "extract1 Name": "Gate Zero",
        "boss1 Name": "The Boss",
        "zone1 Name": "Warehouse",
        "transit1 Description": "Path to Destination Map",
        "map2 Name": "Destination Map",
    });

    const map = snapshot.maps.find((entry) => entry.normalizedName === "sample-map");
    assert.equal(map.name, "Sample Map");
    assert.deepEqual(map.extracts, [{
        id: "extract1",
        name: "Gate Zero",
        faction: "pmc",
        position: { x: 1, y: 2, z: 3 },
        outline: [{ x: 4, y: 5, z: 6 }],
    }]);
    assert.equal(map.bosses[0].name, "The Boss");
    assert.deepEqual(map.bosses[0].locations[0].positions, [{ x: 7, y: 8, z: 9 }]);
    assert.deepEqual(map.transits[0], {
        id: "transit1",
        name: "Path to Destination Map",
        destinationMapId: "map2",
        destinationMapName: "Destination Map",
        position: { x: 10, y: 11, z: 12 },
    });
});

test("reduceMapOverlays rejects invalid root data", () => {
    assert.throws(() => reduceMapOverlays({}, { key: "value" }), /data\.maps/);
    assert.throws(() => reduceMapOverlays({ maps: {} }, {}), /locale is empty/);
});
