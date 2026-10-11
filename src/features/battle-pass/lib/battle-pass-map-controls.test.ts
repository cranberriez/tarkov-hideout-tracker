import assert from "node:assert/strict";
import test from "node:test";
import { documentLocations, documentMaps } from "../../../lib/battle-pass-map-data";
import { filterDocumentLocations, documentMapCounts } from "./battle-pass-map-controls";

test("document filters include every floor, including unspecified floors", () => {
	for (const map of documentMaps) {
		const locations = documentLocations.filter((location) => location.mapId === map.id);
		assert.deepEqual(filterDocumentLocations(locations, []), locations);
		for (const key of Object.keys(map.spawns)) {
			assert.deepEqual(
				filterDocumentLocations(locations, [key]),
				locations.filter((location) => location.documentKey !== key),
			);
		}
	}
});

test("lock filter removes key-required locations and composes with document-type filters", () => {
	assert.ok(documentLocations.some((location) => location.key));
	const unlocked = filterDocumentLocations(documentLocations, [], true);
	assert.deepEqual(
		unlocked,
		documentLocations.filter((location) => !location.key),
	);
	const hiddenKey = unlocked[0].documentKey;
	assert.deepEqual(
		filterDocumentLocations(documentLocations, [hiddenKey], true),
		unlocked.filter((location) => location.documentKey !== hiddenKey),
	);
	assert.deepEqual(filterDocumentLocations(documentLocations, [], false), documentLocations);
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
