import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types";
import { buildQuestDetailMapData } from "./quest-details-model";
import {
    buildQuestDetailMarkers,
    createQuestDetailObjectiveStyles,
    getPositionedObjectiveMaps,
    getQuestDetailMaps,
} from "./quest-detail-markers";

const customs = { id: "customs-id", name: "Customs", normalizedName: "customs" };
const woods = { id: "woods-id", name: "Woods", normalizedName: "woods" };
const quest = {
    id: "quest-1",
    name: "Mapped quest",
    objectives: [{
        id: "objective-1",
        type: "visit",
        description: "Visit either location",
        optional: false,
        locations: [
            { map: customs, position: { x: 1, y: 2, z: 3 }, outline: [], source: "zone" },
            { map: customs, position: { x: 1, y: 2, z: 3 }, outline: [], source: "zone" },
            { map: customs, position: { x: 10, y: 11, z: 12 }, outline: [], source: "possibleLocation" },
            { map: woods, position: { x: 4, y: 5, z: 6 }, outline: [], source: "zone" },
        ],
    }, {
        id: "objective-2",
        type: "mark",
        description: "Mark the truck",
        optional: false,
        locations: [
            { map: customs, position: { x: 1.004, y: 2.004, z: 3.004 }, outline: [], source: "zone" },
        ],
    }, {
        id: "objective-3",
        type: "visit",
        description: "Visit another place",
        optional: false,
        locations: [
            { map: customs, position: { x: 7, y: 8, z: 9 }, outline: [], source: "zone" },
        ],
    }],
} as FullQuest;

test("groups positioned objective locations by map", () => {
    assert.deepEqual(
        getPositionedObjectiveMaps(quest.objectives[0]).map(({ key, locationCount }) => ({ key, locationCount })),
        [{ key: "customs", locationCount: 2 }, { key: "woods", locationCount: 1 }],
    );
    assert.deepEqual(
        getQuestDetailMaps(quest).map(({ key, locationCount }) => ({ key, locationCount })),
        [{ key: "customs", locationCount: 3 }, { key: "woods", locationCount: 1 }],
    );
});

test("collapses coincident positions across objectives into one marker", () => {
    const markers = buildQuestDetailMarkers(quest, "customs");
    assert.equal(markers.length, 3);
    assert.deepEqual(markers.map((marker) => marker.label), ["1", "1", "2"]);
    assert.deepEqual(markers.map((marker) => marker.objectiveIds), [
        ["objective-1", "objective-2"],
        ["objective-1"],
        ["objective-3"],
    ]);
    assert.deepEqual(markers[0].descriptions, ["Visit either location", "Mark the truck"]);
});

test("reuses one symbol across every location in an objective component", () => {
    const styles = createQuestDetailObjectiveStyles(quest);
    assert.equal(styles.get("objective-1"), styles.get("objective-2"));
    assert.notEqual(styles.get("objective-1"), styles.get("objective-3"));
    assert.deepEqual(
        buildQuestDetailMarkers(quest, "customs", styles).map(({ label, color }) => ({ label, color })),
        [
            { label: styles.get("objective-1")?.label, color: styles.get("objective-1")?.color },
            { label: styles.get("objective-1")?.label, color: styles.get("objective-1")?.color },
            { label: styles.get("objective-3")?.label, color: styles.get("objective-3")?.color },
        ],
    );
});

test("omits visited objectives before combining coincident markers", () => {
    const completedObjectiveIds = new Set(["objective-1"]);
    const styles = createQuestDetailObjectiveStyles(quest);
    const markers = buildQuestDetailMarkers(quest, "customs", styles, completedObjectiveIds);

    assert.equal(markers.length, 2);
    assert.deepEqual(markers.map((marker) => marker.objectiveIds), [
        ["objective-2"],
        ["objective-3"],
    ]);
    assert.deepEqual(markers[0].descriptions, ["Mark the truck"]);
    assert.deepEqual(
        getQuestDetailMaps(quest, completedObjectiveIds).map(({ key, locationCount }) => ({ key, locationCount })),
        [{ key: "customs", locationCount: 2 }],
    );
});

test("retains completed objective maps and styles while omitting their markers", () => {
    const mapData = buildQuestDetailMapData(quest, new Set(["objective-1", "objective-2", "objective-3"]));

    assert.deepEqual(mapData.maps.map(({ key, locationCount }) => ({ key, locationCount })), [
        { key: "customs", locationCount: 3 },
        { key: "woods", locationCount: 1 },
    ]);
    assert.equal(mapData.styles.get("objective-1")?.label, "1");
    assert.deepEqual(mapData.markersByMap.get("customs"), []);
    assert.deepEqual(mapData.markersByMap.get("woods"), []);
});

test("prefers daytime Factory when day and night aliases share a location", () => {
    const factory = { id: "factory-day", name: "Factory", normalizedName: "factory" };
    const nightFactory = { id: "factory-night", name: "Night Factory", normalizedName: "night-factory" };
    const factoryQuest = {
        ...quest,
        objectives: [{
            id: "factory-objective",
            type: "visit",
            description: "Visit Factory",
            optional: false,
            maps: [nightFactory, factory],
            locations: [
                { map: nightFactory, position: { x: 1, y: 2, z: 3 }, outline: [], source: "zone" },
                { map: factory, position: { x: 1, y: 2, z: 3 }, outline: [], source: "zone" },
            ],
        }],
    } as FullQuest;

    assert.deepEqual(getQuestDetailMaps(factoryQuest).map(({ key, name, locationCount }) => ({ key, name, locationCount })), [
        { key: "factory", name: "Factory", locationCount: 1 },
    ]);
    assert.equal(buildQuestDetailMarkers(factoryQuest, "factory").length, 1);
});
