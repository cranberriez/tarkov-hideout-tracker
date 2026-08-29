import assert from "node:assert/strict";
import test from "node:test";
import type { MapRenderDefinition } from "./map-types";
import { orderMapFloorsTopToBottom, resolveMapFloors } from "./map-floor-resolution";

const definition = {
    floors: [
        { id: "ground", name: "Ground", svgLayer: "Ground", isBase: true, isDefaultVisible: true, position: "base", stackOrder: 0, heightRange: [-5, 10], extents: [{ height: [-5, 10] }] },
        { id: "upper", name: "2nd Floor", svgLayer: "Upper", isBase: false, isDefaultVisible: false, position: "above", stackOrder: 1, extents: [{ height: [10, 20], bounds: [[[0, 0], [100, 100], "mall"]] }] },
        { id: "bunker", name: "Bunkers", svgLayer: "Bunker", isBase: false, isDefaultVisible: false, position: "below", stackOrder: 2, extents: [{ height: [-20, -5], bounds: [[[0, 0], [100, 100], "command bunker"]] }] },
    ],
} satisfies Pick<MapRenderDefinition, "floors">;

test("resolves upper and underground local extents from XYZ", () => {
    assert.equal(resolveMapFloors({ x: 50, y: 15, z: 50 }, definition)[0]?.floor.id, "upper");
    assert.equal(resolveMapFloors({ x: 50, y: -10, z: 50 }, definition)[0]?.floor.id, "bunker");
});

test("falls back to the base layer outside configured local bounds", () => {
    assert.equal(resolveMapFloors({ x: 150, y: 15, z: 50 }, definition)[0]?.floor.id, "ground");
});

test("orders upper floors above fixed ground and underground floors below it", () => {
    assert.deepEqual(
        orderMapFloorsTopToBottom(definition.floors).map((floor) => floor.id),
        ["upper", "ground", "bunker"],
    );
});
