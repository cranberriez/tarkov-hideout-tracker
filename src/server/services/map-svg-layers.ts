import type { MapFloorDefinition } from "@/features/maps/map-types";

function cssAttributeSelector(value: string) {
    return `[id="${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
}

interface SvgElementRange {
    id?: string;
    start: number;
    closeStart: number;
    end: number;
    parent: SvgElementRange | null;
}

function findTagEnd(svg: string, start: number) {
    let quote: "\"" | "'" | null = null;
    for (let index = start + 1; index < svg.length; index += 1) {
        const character = svg[index];
        if (quote) {
            if (character === quote) quote = null;
        } else if (character === "\"" || character === "'") {
            quote = character;
        } else if (character === ">") {
            return index;
        }
    }
    return -1;
}

function getSvgElementRanges(svg: string) {
    const ranges: SvgElementRange[] = [];
    const stack: SvgElementRange[] = [];
    let cursor = 0;

    while (cursor < svg.length) {
        const start = svg.indexOf("<", cursor);
        if (start < 0) break;
        if (svg.startsWith("<!--", start)) {
            const end = svg.indexOf("-->", start + 4);
            cursor = end < 0 ? svg.length : end + 3;
            continue;
        }
        if (svg.startsWith("<![CDATA[", start)) {
            const end = svg.indexOf("]]>", start + 9);
            cursor = end < 0 ? svg.length : end + 3;
            continue;
        }

        const tagEnd = findTagEnd(svg, start);
        if (tagEnd < 0) break;
        const tag = svg.slice(start + 1, tagEnd).trim();
        cursor = tagEnd + 1;
        if (!tag || tag.startsWith("?") || tag.startsWith("!")) continue;

        if (tag.startsWith("/")) {
            const range = stack.pop();
            if (!range) continue;
            range.closeStart = start;
            range.end = tagEnd + 1;
            ranges.push(range);
            continue;
        }

        const idMatch = tag.match(/\bid\s*=\s*(["'])(.*?)\1/);
        const range: SvgElementRange = {
            id: idMatch?.[2],
            start,
            closeStart: tagEnd + 1,
            end: tagEnd + 1,
            parent: stack.at(-1) ?? null,
        };
        if (tag.endsWith("/")) {
            ranges.push(range);
        } else {
            stack.push(range);
        }
    }

    return ranges;
}

function raiseSelectedFloorLayers(
    svg: string,
    floors: MapFloorDefinition[],
    selectedFloorIds: ReadonlySet<string>,
) {
    const selectedLayerIds = new Set(floors
        .filter((floor) => !floor.isBase && selectedFloorIds.has(floor.id))
        .map((floor) => floor.svgLayer));
    if (selectedLayerIds.size === 0) return svg;

    const ranges = getSvgElementRanges(svg);
    const selectedRanges = ranges.filter((range) => range.id && selectedLayerIds.has(range.id));
    const rangesByParent = new Map<SvgElementRange, SvgElementRange[]>();
    selectedRanges.forEach((range) => {
        if (!range.parent) return;
        const siblings = rangesByParent.get(range.parent) ?? [];
        siblings.push(range);
        rangesByParent.set(range.parent, siblings);
    });

    const edits: Array<{ start: number; end: number; replacement: string }> = [];
    rangesByParent.forEach((siblings, parent) => {
        siblings.sort((left, right) => left.start - right.start);
        const raisedLayers = siblings.map((range) => svg.slice(range.start, range.end)).join("");
        siblings.forEach((range) => edits.push({ start: range.start, end: range.end, replacement: "" }));
        edits.push({ start: parent.closeStart, end: parent.closeStart, replacement: raisedLayers });
    });

    return edits
        .sort((left, right) => right.start - left.start || right.end - left.end)
        .reduce((result, edit) =>
            `${result.slice(0, edit.start)}${edit.replacement}${result.slice(edit.end)}`,
        svg);
}

export function applyMapSvgLayers(
    svg: string,
    floors: MapFloorDefinition[],
    selectedFloorIds: ReadonlySet<string>,
) {
    if (floors.length === 0 || selectedFloorIds.size === 0) return svg;
    const layeredSvg = raiseSelectedFloorLayers(svg, floors, selectedFloorIds);
    const selectedFloors = floors.filter((floor) => selectedFloorIds.has(floor.id));
    const hasBelowLayer = selectedFloors.some((floor) => floor.position === "below");
    const baseOpacity = hasBelowLayer ? 0.12 : 1;
    const hiddenRule = floors.map((floor) => cssAttributeSelector(floor.svgLayer)).join(",");
    const visibleRules = selectedFloors.map((floor) => {
        const opacity = floor.isBase ? baseOpacity : 1;
        return `${cssAttributeSelector(floor.svgLayer)}{display:inline!important;visibility:visible!important;opacity:${opacity}!important}`;
    }).join("");
    const style = `<style id="tarkov-hideout-map-layers">${hiddenRule}{display:none!important}${visibleRules}</style>`;
    return layeredSvg.replace(/<svg\b[^>]*>/i, (openingTag) => `${openingTag}${style}`);
}
