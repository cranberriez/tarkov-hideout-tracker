import assert from "node:assert/strict";
import test from "node:test";
import { arrangeDocumentMarkers } from "./battle-pass-map-layout";

test("crowded spawns switch to tiny glyphs without displacing already separated anchors", () => {
	const points = [
		{ id: "a", x: 100, y: 100 },
		{ id: "b", x: 124, y: 100 },
		{ id: "c", x: 300, y: 100 },
	];
	assert.deepEqual(arrangeDocumentMarkers(points), [
		{ id: "a", x: 0, y: 0, compact: true },
		{ id: "b", x: 0, y: 0, compact: true },
		{ id: "c", x: 0, y: 0, compact: false },
	]);
});

test("true coincidences use compact spacing and small deterministic offsets without changing source anchors", () => {
	const points = Array.from({ length: 12 }, (_, i) => ({ id: String(i), x: 100, y: 100 }));
	const offsets = arrangeDocumentMarkers(points);
	assert.deepEqual(offsets[0], { id: "0", x: 0, y: 0, compact: true });
	for (let i = 0; i < offsets.length; i++) {
		assert.equal(offsets[i].compact, true);
		assert.ok(Math.hypot(offsets[i].x, offsets[i].y) <= 48);
		for (let j = i + 1; j < offsets.length; j++)
			assert.ok(Math.hypot(offsets[i].x - offsets[j].x, offsets[i].y - offsets[j].y) >= 15.999);
	}
	assert.deepEqual(arrangeDocumentMarkers(points), offsets);
	assert.equal(points[1].x, 100);
});

test("zoomed screen geometry restores artwork as nearby spawns separate", () => {
	const points = [
		{ id: "a", x: 100, y: 100 },
		{ id: "b", x: 120, y: 100 },
	];
	assert.ok(arrangeDocumentMarkers(points).every((point) => point.compact));
	const zoomed = points.map((point) => ({ ...point, x: point.x * 3, y: point.y * 3 }));
	assert.deepEqual(arrangeDocumentMarkers(zoomed), [
		{ id: "a", x: 0, y: 0, compact: false },
		{ id: "b", x: 0, y: 0, compact: false },
	]);
});

test("separated spawns keep full artwork at their original positions", () => {
	assert.deepEqual(
		arrangeDocumentMarkers([
			{ id: "a", x: 0, y: 0 },
			{ id: "b", x: 100, y: 100 },
		]),
		[
			{ id: "a", x: 0, y: 0, compact: false },
			{ id: "b", x: 0, y: 0, compact: false },
		],
	);
});

test("dense mobile edge glyphs stay inside small bounds while offscreen anchors remain untouched", () => {
	const bounds = { width: 390, height: 450, padding: 24 };
	const points = [
		{ id: "offscreen", x: 410, y: 100 },
		...Array.from({ length: 20 }, (_, i) => ({ id: String(i), x: 382, y: 100 })),
	];
	const offsets = arrangeDocumentMarkers(points, 38, bounds);
	assert.deepEqual(offsets[0], { id: "offscreen", x: 0, y: 0, compact: false });
	const positions = offsets
		.slice(1)
		.map((offset, index) => ({ x: points[index + 1].x + offset.x, y: points[index + 1].y + offset.y }));
	for (const point of positions) {
		assert.ok(point.x >= 8 && point.x <= 382);
		assert.ok(point.y >= 8 && point.y <= 442);
	}
	for (let i = 0; i < positions.length; i++)
		for (let j = i + 1; j < positions.length; j++)
			assert.ok(Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y) >= 15.999);
	assert.equal(points[1].x, 382);
});

test("offscreen neighbors do not shrink visible artwork", () => {
	assert.deepEqual(
		arrangeDocumentMarkers(
			[
				{ id: "offscreen", x: -10, y: 50 },
				{ id: "visible", x: 10, y: 50 },
			],
			38,
			{ width: 300, height: 200, padding: 24 },
		),
		[
			{ id: "offscreen", x: 0, y: 0, compact: false },
			{ id: "visible", x: 14, y: 0, compact: false },
		],
	);
});
