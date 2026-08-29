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

test("keeps the base fully opaque when an upper floor is selected", () => {
    const upperFloors: MapFloorDefinition[] = [
        floors[0],
        { ...floors[1], id: "upper", name: "2nd Floor", svgLayer: "Second_Floor", position: "above" },
    ];
    const result = applyMapSvgLayers("<svg><g id=\"Ground_Level\"/><g id=\"Second_Floor\"/></svg>", upperFloors, new Set(["ground", "upper"]));
    assert.match(result, /\[id="Ground_Level"\].*opacity:1!important/);
});
