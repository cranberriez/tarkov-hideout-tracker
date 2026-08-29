import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types";
import { buildRaidPlannerMarkers, createQuestMarkerStyles } from "./raid-planner-markers";

const map = { id: "customs-id", name: "Customs", normalizedName: "customs" };
const quest = {
    id: "quest-1",
    name: "Mapped quest",
    objectives: [{
        id: "objective-1",
        type: "visit",
        description: "Visit the marked place",
        optional: false,
        locations: [
            { map, position: { x: 1, y: 2, z: 3 }, outline: [], source: "zone" },
            { map, position: { x: 1, y: 2, z: 3 }, outline: [], source: "zone" },
            { map, position: { x: 4, y: 5, z: 6 }, outline: [], source: "possibleLocation" },
            { map, position: { x: 7, y: 8, z: 9 }, outline: [], source: "possibleLocation" },
        ],
    }, {
        id: "objective-2",
        type: "visit",
        description: "Inspect the same marked place",
        optional: false,
        locations: [
            { map, position: { x: 1.004, y: 2.004, z: 3.004 }, outline: [], source: "zone" },
        ],
    }],
} as FullQuest;

test("renders zone and possible quest-item locations by default", () => {
    const styles = createQuestMarkerStyles([quest]);
    const markers = buildRaidPlannerMarkers([quest], "customs", styles);
    assert.equal(markers.length, 3);
    assert.equal(markers[0].questId, quest.id);
    assert.deepEqual(markers[0].objectiveIds, ["objective-1", "objective-2"]);
    assert.deepEqual(markers[0].descriptions, [
        "Visit the marked place",
        "Inspect the same marked place",
    ]);
});

test("possible quest-item spawns reuse one quest symbol at every known spawn", () => {
    const styles = createQuestMarkerStyles([quest]);
    const markers = buildRaidPlannerMarkers([quest], "customs", styles);
    assert.equal(markers.length, 3);
    assert.deepEqual(new Set(markers.map((marker) => marker.label)).size, 1);
    assert.deepEqual(new Set(markers.map((marker) => marker.color)).size, 1);
});

test("omits visited objectives before combining planner markers", () => {
    const styles = createQuestMarkerStyles([quest]);
    const markers = buildRaidPlannerMarkers([quest], "customs", styles, {
        [quest.id]: { "objective-1": true },
    });

    assert.equal(markers.length, 1);
    assert.deepEqual(markers[0].objectiveIds, ["objective-2"]);
    assert.deepEqual(markers[0].descriptions, ["Inspect the same marked place"]);
});
