import assert from "node:assert/strict";
import test from "node:test";
import { arrangeDocumentMarkers } from "./battle-pass-map-layout";

test("coincident spawns get distinct readable positions without moving their source anchors", () => {
	const points = Array.from({ length: 12 }, (_, i) => ({ id: String(i), x: 100, y: 100 }));
	const offsets = arrangeDocumentMarkers(points);
	assert.deepEqual(offsets[0], { id: "0", x: 0, y: 0 });
	for (let i = 0; i < offsets.length; i++)
		for (let j = i + 1; j < offsets.length; j++)
			assert.ok(Math.hypot(offsets[i].x - offsets[j].x, offsets[i].y - offsets[j].y) >= 38);
	assert.equal(points[1].x, 100);
});

test("separated spawns retain their original positions", () => {
	assert.deepEqual(
		arrangeDocumentMarkers([
			{ id: "a", x: 0, y: 0 },
			{ id: "b", x: 100, y: 100 },
		]),
		[
			{ id: "a", x: 0, y: 0 },
			{ id: "b", x: 0, y: 0 },
		],
	);
});
test("dense mobile edge markers move inward while preserving offscreen anchors", () => {
	const bounds = { width: 390, height: 450, padding: 24 };
	const points = [
		{ id: "offscreen", x: 410, y: 100 },
		...Array.from({ length: 20 }, (_, index) => ({ id: String(index), x: 382, y: 100 })),
	];
	const offsets = arrangeDocumentMarkers(points, 38, bounds);
	assert.deepEqual(offsets[0], { id: "offscreen", x: 0, y: 0 });
	const positions = offsets
		.slice(1)
		.map((offset, index) => ({ x: points[index + 1].x + offset.x, y: points[index + 1].y + offset.y }));
	for (const position of positions) {
		assert.ok(position.x >= 24 && position.x <= 366);
		assert.ok(position.y >= 24 && position.y <= 426);
	}
	for (let i = 0; i < positions.length; i++)
		for (let j = i + 1; j < positions.length; j++)
			assert.ok(Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y) >= 38);
	assert.equal(points[1].x, 382);
});
