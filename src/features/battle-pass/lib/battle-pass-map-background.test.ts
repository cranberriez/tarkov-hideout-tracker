import assert from "node:assert/strict";
import test from "node:test";
import registrations from "../../../lib/data/battle-pass-map-backgrounds.json";
import { documentMaps, documentLocations } from "../../../lib/battle-pass-map-data";
import {
	isDocumentBasemapRegistrationValid,
	projectDocumentPoint,
	resolveDocumentBasemap,
	type DocumentBasemapRegistration,
} from "./battle-pass-map-background";

test("affine projection respects native pixels, including rotated and translated artwork", () => {
	assert.deepEqual(projectDocumentPoint({ x: 12, y: 5 }, [0, 2, -3, 0, 100, 20]), { x: 85, y: 44 });
});

test("every committed replacement has verified landmarks and matches its source canvas", () => {
	for (const registration of registrations.maps) {
		const map = documentMaps.find((entry) => entry.id === registration.mapId);
		assert.ok(map, registration.mapId);
		assert.equal(isDocumentBasemapRegistrationValid(map, registration), true, map.id);
		const background = resolveDocumentBasemap(map);
		assert.equal(background.usesReplacement, true);
		assert.equal(background.matchesDimensions(registration.width, registration.height), true);
		assert.equal(background.matchesDimensions(registration.width + 1, registration.height), false);
		for (const location of documentLocations.filter((entry) => entry.mapId === map.id)) {
			const projected = background.project(location);
			assert.ok(projected.x >= 0 && projected.x <= background.width, location.id);
			assert.ok(projected.y >= 0 && projected.y <= background.height, location.id);
		}
	}
});

test("unregistered artwork keeps document coordinates and image intact", () => {
	const factory = documentMaps.find((map) => map.id === "factory")!;
	const background = resolveDocumentBasemap(factory);
	assert.equal(background.usesReplacement, false);
	assert.equal(background.imageUrl, factory.imageUrl);
	assert.deepEqual(background.project({ x: 77, y: 322 }), { x: 77, y: 322 });
});

test("failed replacement falls back without modifying the source records", () => {
	const map = documentMaps.find((entry) => entry.id === registrations.maps[0].mapId)!;
	const original = JSON.stringify(map);
	const fallback = resolveDocumentBasemap(map, true);
	assert.equal(fallback.usesReplacement, false);
	assert.equal(fallback.imageUrl, map.imageUrl);
	assert.deepEqual(fallback.project({ x: 123, y: 456 }), { x: 123, y: 456 });
	assert.equal(JSON.stringify(map), original);
});

test("changed source dimensions, broken matrices, or inaccurate landmarks reject replacements", () => {
	const registration = registrations.maps[0] as DocumentBasemapRegistration;
	const map = documentMaps.find((entry) => entry.id === registration.mapId)!;
	assert.equal(isDocumentBasemapRegistrationValid({ ...map, width: map.width + 1 }, registration), false);
	assert.equal(isDocumentBasemapRegistrationValid(map, { ...registration, transform: [0, 0, 0, 0, 0, 0] }), false);
	assert.equal(isDocumentBasemapRegistrationValid(map, { ...registration, transform: [1, 0, 0, 1, 1, 0] }), false);
	assert.equal(isDocumentBasemapRegistrationValid(map, { ...registration, transform: [1, 0, 0, 1, NaN, 0] }), false);
});
