import assert from "node:assert/strict";
import test from "node:test";
import { zoomViewAroundPoint } from "./map-view-transform";

test("keeps the map point under the cursor fixed while zooming", () => {
    const before = { scale: 2, x: 10, y: 20 };
    const focalPoint = { x: 100, y: 50 };
    const after = zoomViewAroundPoint(before, 1.5, focalPoint, 1, 5);

    assert.deepEqual(after, { scale: 3, x: -35, y: 5 });
    assert.equal((focalPoint.x - before.x) / before.scale, (focalPoint.x - after.x) / after.scale);
    assert.equal((focalPoint.y - before.y) / before.scale, (focalPoint.y - after.y) / after.scale);
});

test("clamps zoom while retaining the focal point", () => {
    const after = zoomViewAroundPoint({ scale: 4, x: 0, y: 0 }, 2, { x: 40, y: -20 }, 1, 5);
    assert.deepEqual(after, { scale: 5, x: -10, y: 5 });
});
