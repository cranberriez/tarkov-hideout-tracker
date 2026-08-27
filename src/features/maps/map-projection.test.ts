import assert from "node:assert/strict";
import test from "node:test";
import { worldToMapPoint } from "./map-projection";

test("projects the x/z plane with Tarkov.dev's inverted vertical transform", () => {
    const point = worldToMapPoint(
        { x: 25, y: 999, z: 50 },
        { bounds: [[0, 0], [100, 200]], transform: [1, 0, 1, 0], coordinateRotation: 0 },
    );
    assert.deepEqual(point, { x: 25, y: -50, percentX: 25, percentY: 75 });
});

test("applies Factory's 90-degree rotation before its transform", () => {
    const point = worldToMapPoint(
        { x: 10, y: 4, z: 20 },
        {
            bounds: [[77, -64.5], [-65.5, 67.4]],
            transform: [1.629, 119.9, 1.629, 139.3],
            coordinateRotation: 90,
        },
    );
    assert.ok(Math.abs(point.x - 87.32) < 0.000001);
    assert.ok(Math.abs(point.y - 123.01) < 0.000001);
    assert.ok(point.percentX >= 0 && point.percentX <= 100);
    assert.ok(point.percentY >= 0 && point.percentY <= 100);
});
