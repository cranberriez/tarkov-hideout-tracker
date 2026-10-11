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
	const map = documentMaps.find((entry) => entry.id === "customs")!;
	const background = resolveDocumentBasemap(map);
	assert.equal(background.usesReplacement, false);
	assert.equal(background.imageUrl, map.imageUrl);
	assert.deepEqual(background.project({ x: 77, y: 322 }), { x: 77, y: 322 });
});

test("manual calibration rejects incomplete, duplicate, stale, and out-of-bounds positions", () => {
	const map = documentMaps.find((entry) => entry.id === "factory")!;
	const locations = documentLocations.filter((entry) => entry.mapId === map.id);
	const registration: DocumentBasemapRegistration = {
		mapId: map.id,
		imageUrl: "https://example.com/manual.jpg",
		width: 2000,
		height: 1000,
		sourceWidth: map.width,
		sourceHeight: map.height,
		sourceImageUrl: map.imageUrl,
		sourceUrl: map.sourceUrl,
		author: "test",
		authorUrl: null,
		license: map.license,
		manualPositions: locations.map((location) => ({
			id: location.id,
			source: { x: location.x, y: location.y, floor: location.floor, layer: location.layer },
			target: { x: location.x + 1000, y: location.y },
			note: "Manually matched room",
		})),
		verification: {
			note: "Separate floor panels",
			landmarks: [
				{ label: "Office", source: { x: 57, y: 240 }, target: { x: 100, y: 100 } },
				{ label: "Platform", source: { x: 197, y: 542 }, target: { x: 200, y: 200 } },
				{ label: "Keycard room", source: { x: 104, y: 540 }, target: { x: 300, y: 300 } },
			],
		},
	};
	assert.equal(isDocumentBasemapRegistrationValid(map, registration), true);
	const positions = registration.manualPositions!;
	for (const replacement of [
		positions.slice(1),
		[positions[0], ...positions.slice(0, -1)],
		[{ ...positions[0], id: "stale-id" }, ...positions.slice(1)],
		[{ ...positions[0], source: { ...positions[0].source, x: positions[0].source.x + 1 } }, ...positions.slice(1)],
		[{ ...positions[0], source: { ...positions[0].source, floor: "B1" } }, ...positions.slice(1)],
		[{ ...positions[0], source: { ...positions[0].source, layer: "other" } }, ...positions.slice(1)],
		[{ ...positions[0], target: { x: 2001, y: 100 } }, ...positions.slice(1)],
		[{ ...positions[0], target: { x: NaN, y: 100 } }, ...positions.slice(1)],
	])
		assert.equal(isDocumentBasemapRegistrationValid(map, { ...registration, manualPositions: replacement }), false);
	assert.equal(isDocumentBasemapRegistrationValid(map, { ...registration, sourceImageUrl: "changed.webp" }), false);
	assert.equal(isDocumentBasemapRegistrationValid({ ...map, height: map.height + 1 }, registration), false);
	assert.equal(isDocumentBasemapRegistrationValid(map, { ...registration, transform: [1, 0, 0, 1, 0, 0] }), false);
	assert.equal(
		isDocumentBasemapRegistrationValid(
			map,
			registration,
			locations.map((location, index) => (index ? location : { ...location, y: location.y + 1 })),
		),
		false,
	);
});

test("Factory projects all floors onto separate panels and original fallback restores native anchors", () => {
	const map = documentMaps.find((entry) => entry.id === "factory")!;
	const snapshot = JSON.stringify(documentLocations);
	const background = resolveDocumentBasemap(map);
	const original = resolveDocumentBasemap(map, true);
	assert.equal(background.usesReplacement, true);
	assert.equal(background.width, 6720);
	const locations = documentLocations.filter((entry) => entry.mapId === map.id);
	assert.equal(locations.length, 30);
	const panelRanges = { "3F": [0, 1640], "2F": [1640, 3260], "1F": [3260, 4980], B1: [4980, 6720] };
	for (const location of locations) {
		const point = background.project(location);
		const [left, right] = panelRanges[location.floor as keyof typeof panelRanges];
		assert.ok(point.x >= left && point.x < right, location.id);
		assert.deepEqual(original.project(location), { x: location.x, y: location.y });
	}
	assert.equal(locations.filter((location) => !location.verified).length, 5);
	assert.equal(original.imageUrl, map.imageUrl);
	assert.equal(original.usesReplacement, false);
	assert.throws(() => background.project({ x: 1, y: 2 }), /Missing calibrated document position/);
	assert.throws(() => background.project({ id: "missing-id", x: 1, y: 2 }), /Missing calibrated document position/);
	assert.equal(JSON.stringify(documentLocations), snapshot);
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
