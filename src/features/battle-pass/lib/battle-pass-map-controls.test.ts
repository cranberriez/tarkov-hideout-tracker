import assert from "node:assert/strict";
import test from "node:test";
import { documentLocations, documentMaps } from "../../../lib/battle-pass-map-data";
import {
	documentFloorOptions,
	filterDocumentLocations,
	documentMapCounts,
	locationFloorKey,
} from "./battle-pass-map-controls";

test("floor controls show all source floors and explicitly include unspecified locations", () => {
	for (const map of documentMaps) {
		const locations = documentLocations.filter((location) => location.mapId === map.id);
		const options = documentFloorOptions(map, locations);
		for (const floor of map.floors) assert.ok(options.some((option) => option.id === floor.id));
		if (locations.some((location) => !location.floor))
			assert.ok(options.some((option) => option.id === "unknown" && option.name === "Unspecified floor"));
	}
});

test("floor multiselect supports all, none and multiple floor combinations independently of types", () => {
	const map = documentMaps.find((map) => map.id === "factory")!;
	const locations = documentLocations.filter((location) => location.mapId === map.id);
	const floors = documentFloorOptions(map, locations).map((floor) => floor.id);
	assert.deepEqual(filterDocumentLocations(locations, [], []), locations);
	assert.deepEqual(filterDocumentLocations(locations, floors, []), []);
	const selected = floors.slice(0, 2);
	assert.deepEqual(
		filterDocumentLocations(
			locations,
			floors.filter((floor) => !selected.includes(floor)),
			[],
		),
		locations.filter((location) => selected.includes(locationFloorKey(location))),
	);
	assert.ok(
		filterDocumentLocations(locations, [], ["project"]).every((location) => location.documentKey !== "project"),
	);
});

test("possible spots count all locations while per-raid spawns come from source map counts", () => {
	for (const map of documentMaps) {
		const locations = documentLocations.filter((location) => location.mapId === map.id);
		for (const key of Object.keys(map.spawns) as (keyof typeof map.spawns)[]) {
			const counts = documentMapCounts(map, locations, key);
			assert.equal(counts.possibleSpots, locations.filter((location) => location.documentKey === key).length);
			assert.equal(counts.raidSpawns, map.id === "factory" ? 5 : 7);
		}
	}
});

test("unspecified floors require their own checked option", () => {
	const locations = documentLocations.filter((location) => location.mapId === "ground_zero");
	assert.ok(locations.length > 0);
	assert.deepEqual(filterDocumentLocations(locations, ["unknown"], []), []);
	assert.deepEqual(filterDocumentLocations(locations, [], []), locations);
});
