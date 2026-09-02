import assert from "node:assert/strict";
import test from "node:test";
import type { MapFloorDefinition } from "@/features/maps/map-types";
import { applyMapSvgLayers } from "./map-svg-layers";

const floors: MapFloorDefinition[] = [
    { id: "ground", name: "Ground", svgLayer: "Ground_Level", isBase: true, isDefaultVisible: true, position: "base", stackOrder: 0, extents: [] },
    { id: "bunker", name: "Bunkers", svgLayer: "Bunkers", isBase: false, isDefaultVisible: false, position: "below", stackOrder: 1, extents: [] },
];

test("injects named SVG layer visibility and fades context below ground", () => {
    const result = applyMapSvgLayers("<svg><g id=\"Ground_Level\"/><g id=\"Bunkers\"/></svg>", floors, new Set(["ground", "bunker"]));
    assert.match(result, /\[id="Ground_Level"\].*opacity:0\.12!important/);
    assert.match(result, /\[id="Bunkers"\].*opacity:1!important/);
});

test("raises a selected underground layer above later ground and upper-floor artwork", () => {
    const shorelineFloors: MapFloorDefinition[] = [
        floors[0],
        { ...floors[1], id: "upper", name: "2nd Floor", svgLayer: "Second_Floor", position: "above" },
        { ...floors[1], id: "underground", name: "Underground", svgLayer: "Underground_Level" },
    ];
    const result = applyMapSvgLayers(
        "<svg><g id=\"Underground_Level\"><path id=\"tunnel\"/></g><g id=\"Ground_Level\"/><g id=\"Second_Floor\"/></svg>",
        shorelineFloors,
        new Set(["ground", "underground"]),
    );

    assert.ok(result.indexOf('id="Ground_Level"') < result.indexOf('id="Underground_Level"'));
    assert.ok(result.indexOf('id="Second_Floor"') < result.indexOf('id="Underground_Level"'));
    assert.match(result, /<g id="Underground_Level"><path id="tunnel"\/><\/g><\/svg>/);
});

test("keeps a raised layer inside its original transformed parent", () => {
    const result = applyMapSvgLayers(
        "<svg><g transform=\"scale(2)\"><g id=\"Bunkers\"/><g id=\"Ground_Level\"/></g></svg>",
        floors,
        new Set(["ground", "bunker"]),
    );

    assert.match(result, /<g transform="scale\(2\)"><g id="Ground_Level"\/><g id="Bunkers"\/><\/g><\/svg>/);
});

test("keeps the base fully opaque when an upper floor is selected", () => {
    const upperFloors: MapFloorDefinition[] = [
        floors[0],
        { ...floors[1], id: "upper", name: "2nd Floor", svgLayer: "Second_Floor", position: "above" },
    ];
    const result = applyMapSvgLayers("<svg><g id=\"Ground_Level\"/><g id=\"Second_Floor\"/></svg>", upperFloors, new Set(["ground", "upper"]));
    assert.match(result, /\[id="Ground_Level"\].*opacity:1!important/);
});
