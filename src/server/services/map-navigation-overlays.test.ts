import assert from "node:assert/strict";
import test from "node:test";
import { getMapNavigationMarkers } from "./map-navigation-overlays";

test("planner navigation markers include only PMC extracts and transits", async () => {
    const markers = await getMapNavigationMarkers("customs");
    assert.ok(markers);

    const extracts = markers.filter((marker) => marker.kind === "extract");
    const transits = markers.filter((marker) => marker.kind === "transit");
    assert.ok(extracts.length > 0);
    assert.ok(transits.length > 0);
    assert.ok(extracts.every((marker) => marker.color === "#54d66a"));
    assert.ok(extracts.every((marker) => marker.descriptions.includes("PMC extract")));
    assert.ok(transits.every((marker) => marker.color === "#f59e0b"));
    assert.ok(markers.every((marker) => marker.label.length > 0));
});

test("unsupported maps do not expose navigation markers", async () => {
    assert.equal(await getMapNavigationMarkers("not-a-map"), null);
});
