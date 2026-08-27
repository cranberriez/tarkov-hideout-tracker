import assert from "node:assert/strict";
import test from "node:test";
import { getMapRenderDefinition } from "./map-render-definitions";

test("reduces a supported map to its compact SVG rendering contract", () => {
    const definition = getMapRenderDefinition("customs");
    assert.ok(definition);
    assert.equal(definition.svgPath, "https://assets.tarkov.dev/maps/svg/Customs.svg");
    assert.deepEqual(definition.transform, [0.239, 168.65, 0.239, 136.35]);
    assert.equal("tilePath" in definition, false);
});

test("resolves configured aliases and rejects maps without SVG artwork", () => {
    assert.equal(getMapRenderDefinition("night-factory")?.key, "factory");
    assert.equal(getMapRenderDefinition("the-lab"), null);
    assert.equal(getMapRenderDefinition("icebreaker"), null);
});
