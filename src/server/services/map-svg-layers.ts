import type { MapFloorDefinition } from "@/features/maps/map-types";

function cssAttributeSelector(value: string) {
    return `[id="${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
}

export function applyMapSvgLayers(
    svg: string,
    floors: MapFloorDefinition[],
    selectedFloorIds: ReadonlySet<string>,
) {
    if (floors.length === 0 || selectedFloorIds.size === 0) return svg;
    const selectedFloors = floors.filter((floor) => selectedFloorIds.has(floor.id));
    const hasBelowLayer = selectedFloors.some((floor) => floor.position === "below");
    const baseOpacity = hasBelowLayer ? 0.12 : 1;
    const hiddenRule = floors.map((floor) => cssAttributeSelector(floor.svgLayer)).join(",");
    const visibleRules = selectedFloors.map((floor) => {
        const opacity = floor.isBase ? baseOpacity : 1;
        return `${cssAttributeSelector(floor.svgLayer)}{display:inline!important;visibility:visible!important;opacity:${opacity}!important}`;
    }).join("");
    const style = `<style id="tarkov-hideout-map-layers">${hiddenRule}{display:none!important}${visibleRules}</style>`;
    return svg.replace(/<svg\b[^>]*>/i, (openingTag) => `${openingTag}${style}`);
}
