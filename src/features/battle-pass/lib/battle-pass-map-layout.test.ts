import assert from "node:assert/strict";
import test from "node:test";
import {
	arrangeDocumentMarkers,
	documentMarkerScale,
	documentMarkerDimensions,
	DOCUMENT_MAP_UNGROUP_ZOOM,
} from "./battle-pass-map-layout";

test("overlapping markers retain source anchors, including at the viewport edge", () => {
	const points = [
		{ id: "a", x: 1, y: 1 },
		{ id: "b", x: 22, y: 1 },
	];
	const groups = arrangeDocumentMarkers(points, 1, { width: 100, height: 100 });
	assert.equal(groups.length, 2);
	groups.forEach((group, index) => {
		assert.equal(group.x, points[index].x);
		assert.equal(group.y, points[index].y);
	});
});

test("tight groups keep every ID and split as zoom separates source positions", () => {
	const points = [
		{ id: "a", x: 100, y: 100 },
		{ id: "b", x: 108, y: 100 },
	];
	const groups = arrangeDocumentMarkers(points);
	assert.equal(groups.length, 1);
	assert.deepEqual(groups[0].ids, ["a", "b"]);
	assert.equal(groups[0].x, 100);
	assert.equal(groups[0].y, 100);
	assert.equal(
		arrangeDocumentMarkers(
			points.map((p) => ({ ...p, x: p.x * 4, y: p.y * 4 })),
			4,
		).length,
		2,
	);
});

test("all groups split in the last 20% of zoom, including coincident anchors, and regroup on zoom out", () => {
	const points = Array.from({ length: 12 }, (_, i) => ({ id: String(i), x: 100, y: 100 }));
	assert.equal(arrangeDocumentMarkers(points, DOCUMENT_MAP_UNGROUP_ZOOM - 0.01).length, 1);
	for (const zoom of [DOCUMENT_MAP_UNGROUP_ZOOM, 8]) {
		assert.deepEqual(
			arrangeDocumentMarkers(points, zoom),
			points.map((point) => ({ ...point, ids: [point.id] })),
		);
	}
	assert.equal(arrangeDocumentMarkers(points, 1).length, 1);
});

test("disabling grouping keeps overlapping and coincident markers at source anchors at every zoom", () => {
	const points = [
		{ id: "a", x: 10, y: 10 },
		{ id: "b", x: 10, y: 10 },
		{ id: "c", x: 12, y: 10 },
		{ id: "offscreen", x: -1, y: 10 },
	];
	const bounds = { width: 100, height: 100 };
	for (const zoom of [1, 4, 8]) {
		assert.deepEqual(
			arrangeDocumentMarkers(points, zoom, bounds, true),
			points.slice(0, 3).map((point) => ({ ...point, ids: [point.id] })),
		);
	}
	assert.equal(arrangeDocumentMarkers(points, 1, bounds, false).length, 1);
});

test("larger bubbles merge sooner using their displayed footprint", () => {
	const points = [
		{ id: "a", x: 100, y: 100 },
		{ id: "b", x: 100, y: 100 },
		{ id: "c", x: 135, y: 100 },
		{ id: "d", x: 135, y: 100 },
	];
	assert.equal(arrangeDocumentMarkers(points, 1).length, 1);
	const separated = arrangeDocumentMarkers(
		points.map((point) => ({ ...point, x: point.x * 4 })),
		4,
	);
	assert.equal(separated.length, 2);
});

test("groups do not chain across distant anchors or collect offscreen locations", () => {
	const points = [
		{ id: "off", x: -1, y: 10 },
		{ id: "a", x: 1, y: 10 },
		{ id: "b", x: 10, y: 10 },
		{ id: "c", x: 60, y: 10 },
	];
	assert.deepEqual(
		arrangeDocumentMarkers(points, 1, { width: 100, height: 100 }).map((g) => g.ids),
		[["a", "b"], ["c"]],
	);
	assert.deepEqual(arrangeDocumentMarkers([]), []);
});

test("zoomed-out icons shrink smoothly and zoomed-in icons stop growing", () => {
	assert.equal(documentMarkerScale(1), 0.75);
	assert.ok(documentMarkerScale(2) > documentMarkerScale(1));
	assert.ok(documentMarkerScale(2) < documentMarkerScale(3));
	assert.equal(documentMarkerScale(8), 1);
});

test("overlapping artwork groups merge, retain a source anchor and split again with zoom", () => {
	const points = [
		{ id: "a", x: 100, y: 100 },
		{ id: "b", x: 100, y: 100 },
		{ id: "c", x: 120, y: 100 },
		{ id: "d", x: 120, y: 100 },
	];
	const merged = arrangeDocumentMarkers(points);
	assert.equal(merged.length, 1);
	assert.deepEqual(merged[0], { id: "a", x: 100, y: 100, ids: ["a", "b", "c", "d"] });
	const zoomed = points.map((point) => ({ ...point, x: point.x * 4, y: point.y * 4 }));
	assert.deepEqual(
		arrangeDocumentMarkers(zoomed, 4).map((g) => g.ids),
		[
			["a", "b"],
			["c", "d"],
		],
	);
	assert.deepEqual(arrangeDocumentMarkers(points), merged);
});

test("merging rechecks enlarged grids against earlier groups without losing member IDs", () => {
	const points = [
		{ id: "a", x: 100, y: 122 },
		{ id: "b", x: 100, y: 122 },
		{ id: "c", x: 100, y: 100 },
		{ id: "d", x: 100, y: 100 },
		{ id: "e", x: 120, y: 100 },
		{ id: "f", x: 120, y: 100 },
	];
	const groups = arrangeDocumentMarkers(points);
	assert.equal(groups.length, 1);
	assert.deepEqual(
		groups[0].ids,
		points.map((p) => p.id),
	);
	assert.equal(groups[0].y, 122);
});

test("bubble footprints match two- and three-column artwork grids", () => {
	assert.deepEqual(documentMarkerDimensions(1), { columns: 1, width: 34, height: 34 });
	assert.deepEqual(documentMarkerDimensions(4), { columns: 2, width: 72, height: 72 });
	assert.deepEqual(documentMarkerDimensions(5), { columns: 3, width: 102, height: 72 });
});
