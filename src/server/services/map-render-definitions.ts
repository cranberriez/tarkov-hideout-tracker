import rawMaps from "../../lib/data/maps.json";
import type {
    MapFloorDefinition,
    MapFloorExtent,
    MapRenderDefinition,
} from "@/types/maps";

type UnknownRecord = Record<string, unknown>;

const SVG_LICENSE = "CC BY-NC-SA 4.0";
const SVG_LICENSE_LINK = "https://creativecommons.org/licenses/by-nc-sa/4.0/";

function isRecord(value: unknown): value is UnknownRecord {
    return !!value && typeof value === "object";
}

function numberTuple(value: unknown, length: 2): [number, number] | null;
function numberTuple(value: unknown, length: 4): [number, number, number, number] | null;
function numberTuple(value: unknown, length: 2 | 4) {
    if (!Array.isArray(value) || value.length !== length || value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
        return null;
    }
    return value as number[];
}

function toBounds(value: unknown): [[number, number], [number, number]] | null {
    if (!Array.isArray(value) || value.length !== 2) return null;
    const first = numberTuple(value[0], 2);
    const second = numberTuple(value[1], 2);
    return first && second ? [first, second] : null;
}

function toExtents(value: unknown): MapFloorExtent[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const height = numberTuple(entry.height, 2);
        if (!height) return [];
        const bounds = Array.isArray(entry.bounds)
            ? entry.bounds.flatMap((candidate) => {
                  if (!Array.isArray(candidate) || candidate.length < 2) return [];
                  const first = numberTuple(candidate[0], 2);
                  const second = numberTuple(candidate[1], 2);
                  if (!first || !second) return [];
                  return [[first, second, typeof candidate[2] === "string" ? candidate[2] : undefined] as [[number, number], [number, number], string?]];
              })
            : undefined;
        return [{ height, ...(bounds?.length ? { bounds } : {}) }];
    });
}

function reduceDefinition(group: UnknownRecord, candidate: UnknownRecord): MapRenderDefinition | null {
    const key = typeof candidate.key === "string" ? candidate.key : null;
    const normalizedName = typeof group.normalizedName === "string" ? group.normalizedName : null;
    const bounds = toBounds(candidate.bounds);
    const svgBounds = toBounds(candidate.svgBounds) ?? undefined;
    const transform = numberTuple(candidate.transform, 4);
    const svgPath = typeof candidate.svgPath === "string" ? candidate.svgPath : null;
    if (!key || !normalizedName || !bounds || !transform || !svgPath) return null;

    const baseLayer = typeof candidate.svgLayer === "string" ? candidate.svgLayer : "Ground_Level";
    const heightRange = numberTuple(candidate.heightRange, 2) ??
        numberTuple(candidate._heightRange, 2) ??
        undefined;
    const groundLowerBound = heightRange ? Math.min(...heightRange) : 0;
    const floors: MapFloorDefinition[] = [{
        id: baseLayer,
        name: "Ground",
        svgLayer: baseLayer,
        isBase: true,
        isDefaultVisible: true,
        position: "base",
        stackOrder: 0,
        heightRange,
        extents: heightRange ? [{ height: heightRange, bounds: [bounds] }] : [],
    }];
    if (Array.isArray(candidate.layers)) {
        for (const [layerIndex, rawLayer] of candidate.layers.entries()) {
            if (!isRecord(rawLayer) || typeof rawLayer.svgLayer !== "string") continue;
            const name = typeof rawLayer.name === "string" ? rawLayer.name : rawLayer.svgLayer;
            const extents = toExtents(rawLayer.extents);
            const minimumLayerHeight = Math.min(
                ...extents.map((extent) => Math.min(...extent.height)),
            );
            const isBelow = groundLowerBound <= -999
                ? minimumLayerHeight <= -999
                : minimumLayerHeight < groundLowerBound;
            floors.push({
                id: rawLayer.svgLayer,
                name,
                svgLayer: rawLayer.svgLayer,
                isBase: false,
                isDefaultVisible: rawLayer.show === true,
                position: isBelow ? "below" : "above",
                stackOrder: layerIndex + 1,
                extents,
            });
        }
    }

    return {
        key,
        normalizedName,
        aliases: Array.isArray(candidate.altMaps)
            ? candidate.altMaps.filter((alias): alias is string => typeof alias === "string")
            : [],
        bounds,
        svgBounds,
        transform,
        coordinateRotation: typeof candidate.coordinateRotation === "number" ? candidate.coordinateRotation : 0,
        minZoom: typeof candidate.minZoom === "number" ? candidate.minZoom : 1,
        maxZoom: typeof candidate.maxZoom === "number" ? candidate.maxZoom : 5,
        svgPath,
        floors,
        attribution: {
            author: typeof candidate.author === "string" ? candidate.author : "The Hideout map contributors",
            authorLink: typeof candidate.authorLink === "string" ? candidate.authorLink : "https://github.com/the-hideout/tarkov-dev-svg-maps/",
            license: SVG_LICENSE,
            licenseLink: SVG_LICENSE_LINK,
        },
    };
}

export function getMapRenderDefinition(mapKey: string): MapRenderDefinition | null {
    for (const rawGroup of rawMaps as unknown[]) {
        if (!isRecord(rawGroup) || !Array.isArray(rawGroup.maps)) continue;
        const candidate = rawGroup.maps.find((entry) => isRecord(entry) && entry.projection === "interactive");
        if (!isRecord(candidate)) continue;
        const definition = reduceDefinition(rawGroup, candidate);
        if (!definition) continue;
        if ([definition.key, definition.normalizedName, ...definition.aliases].includes(mapKey)) return definition;
    }
    return null;
}

export function getMapSvgUpstreamUrl(mapKey: string) {
    return getMapRenderDefinition(mapKey)?.svgPath ?? null;
}
