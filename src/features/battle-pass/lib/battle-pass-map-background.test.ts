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
	const map = documentMaps.find((entry) => entry.id === "interchange")!;
	const background = resolveDocumentBasemap(map);
	assert.equal(background.usesReplacement, false);
	assert.equal(background.imageUrl, map.imageUrl);
	assert.deepEqual(background.project({ x: 77, y: 322 }), { x: 77, y: 322 });
});

test("Customs manual calibration rejects any missing or changed source anchor and restores the original", () => {
	const map = documentMaps.find((entry) => entry.id === "customs")!;
	const registration = registrations.maps.find((entry) => entry.mapId === map.id) as DocumentBasemapRegistration;
	assert.ok(registration?.manualPositions);
	const locations = documentLocations.filter((entry) => entry.mapId === map.id);
	assert.equal(isDocumentBasemapRegistrationValid(map, registration), true);
	for (const location of locations) {
		const incomplete = registration.manualPositions.filter((position) => position.id !== location.id);
		assert.equal(
			isDocumentBasemapRegistrationValid(map, { ...registration, manualPositions: incomplete }),
			false,
			location.id,
		);
		for (const change of [
			{ x: location.x + 1 },
			{ y: location.y + 1 },
			{ floor: "changed-floor" },
			{ layer: "changed-layer" },
		]) {
			const changedLocations = locations.map((entry) => (entry.id === location.id ? { ...entry, ...change } : entry));
			assert.equal(isDocumentBasemapRegistrationValid(map, registration, changedLocations), false, location.id);
		}
	}
	for (const changedMap of [
		{ ...map, imageUrl: "https://example.com/changed-source.webp" },
		{ ...map, width: map.width + 1 },
		{ ...map, height: map.height + 1 },
	]) {
		assert.equal(isDocumentBasemapRegistrationValid(changedMap, registration), false);
		const background = resolveDocumentBasemap(changedMap);
		assert.equal(background.usesReplacement, false);
		assert.equal(background.imageUrl, changedMap.imageUrl);
		for (const location of locations) assert.deepEqual(background.project(location), { x: location.x, y: location.y });
	}
});

test("Customs preserves source records and places relocated floor insets on matching room plans", () => {
	const map = documentMaps.find((entry) => entry.id === "customs")!;
	const sourceSnapshot = JSON.stringify({ map, locations: documentLocations });
	const locations = documentLocations.filter((entry) => entry.mapId === map.id);
	const background = resolveDocumentBasemap(map);
	const original = resolveDocumentBasemap(map, true);
	assert.equal(background.usesReplacement, true);
	assert.deepEqual([background.width, background.height], [7680, 4025]);
	assert.equal(background.matchesDimensions(7680, 4025), true);
	assert.equal(background.matchesDimensions(4097, 2142), false);
	assert.equal(locations.length, 30);
	const roomRegions = [
		{ ids: ["financial-2-1-1-1", "project-2-1-1-1"], bounds: [3940, 87, 4203, 633] },
		{ ids: ["project-1-3-2-1"], bounds: [2083, 831, 2170, 905] },
		{
			ids: ["financial-2-2-2-1", "financial-2-2-2-2", "project-2-2-2-1", "project-2-2-2-2"],
			bounds: [5255, 260, 5332, 490],
		},
		{ ids: ["financial-3-1-2-1"], bounds: [6852, 2447, 6965, 2604] },
		{ ids: ["project-3-1-2-1"], bounds: [6852, 2447, 6965, 2604] },
		{ ids: ["financial-5-2-2-1"], bounds: [4920, 3780, 5012, 3847] },
		{ ids: ["project-5-2-2-1"], bounds: [4690, 3780, 4822, 3847] },
		{ ids: ["project-5-2-2-2"], bounds: [4920, 3330, 5012, 3398] },
		{ ids: ["financial-5-2-1-1"], bounds: [5310, 3330, 5440, 3400] },
		{ ids: ["financial-5-1-2-1", "project-5-1-2-1"], bounds: [6800, 3796, 6930, 3863] },
		{ ids: ["financial-5-1-3-1"], bounds: [7445, 3220, 7579, 3294] },
	];
	for (const {
		ids,
		bounds: [left, top, right, bottom],
	} of roomRegions) {
		for (const id of ids) {
			const location = locations.find((entry) => entry.id === id)!;
			const point = background.project(location);
			assert.ok(point.x >= left && point.x <= right && point.y >= top && point.y <= bottom, id);
		}
	}
	for (const location of locations) assert.deepEqual(original.project(location), { x: location.x, y: location.y });
	const shelf = background.project(locations.find((entry) => entry.id === "financial-5-1-2-1")!);
	const desk = background.project(locations.find((entry) => entry.id === "project-5-1-2-1")!);
	assert.ok(shelf.x > desk.x && shelf.y < desk.y);
	assert.ok(Math.hypot(shelf.x - desk.x, shelf.y - desk.y) > 0);
	assert.equal(original.imageUrl, map.imageUrl);
	assert.equal(original.usesReplacement, false);
	assert.equal(locations.filter((location) => !location.verified).length, 0);
	assert.throws(() => background.project({ id: "missing-id", x: 1, y: 2 }), /Missing calibrated document position/);
	assert.equal(JSON.stringify({ map, locations: documentLocations }), sourceSnapshot);
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
