import type { MapPoint3D } from "@/types";
import type { MapFloorDefinition, MapRenderDefinition } from "./map-types";

export interface MapFloorMatch {
    floor: MapFloorDefinition;
    extentLabel?: string;
    specificity: number;
}

function isWithinRange(value: number, [first, second]: [number, number]) {
    return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function matchExtent(position: MapPoint3D, floor: MapFloorDefinition) {
    return floor.extents.flatMap((extent) => {
        if (!isWithinRange(position.y, extent.height)) return [];
        if (!extent.bounds?.length) return [{ extentLabel: undefined, specificity: 0 }];
        return extent.bounds.flatMap(([first, second, label]) => {
            const matches = isWithinRange(position.x, [first[0], second[0]]) &&
                isWithinRange(position.z, [first[1], second[1]]);
            if (!matches) return [];
            const area = Math.abs(first[0] - second[0]) * Math.abs(first[1] - second[1]);
            return [{ extentLabel: label, specificity: area > 0 ? 1 / area : Number.MAX_SAFE_INTEGER }];
        });
    });
}

export function resolveMapFloors(
    position: MapPoint3D,
    definition: Pick<MapRenderDefinition, "floors">,
): MapFloorMatch[] {
    const matches = definition.floors.flatMap((floor) =>
        matchExtent(position, floor).map((match) => ({ floor, ...match })),
    );
    const nonBaseMatches = matches.filter(({ floor }) => !floor.isBase);
    const resolved = nonBaseMatches.length > 0
        ? nonBaseMatches
        : matches.filter(({ floor }) => floor.isBase);
    if (resolved.length > 0) {
        return resolved.sort((left, right) =>
            right.specificity - left.specificity || left.floor.stackOrder - right.floor.stackOrder,
        );
    }
    const base = definition.floors.find((floor) => floor.isBase);
    return base ? [{ floor: base, specificity: 0 }] : [];
}

export function getFloorRepresentativeHeight(floor: MapFloorDefinition) {
    const values = floor.extents.flatMap((extent) => extent.height)
        .filter((value) => Math.abs(value) < 999);
    if (values.length > 0) return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (floor.position === "above") return Number.MAX_SAFE_INTEGER;
    if (floor.position === "below") return Number.MIN_SAFE_INTEGER;
    return 0;
}

export function orderMapFloorsTopToBottom(floors: MapFloorDefinition[]) {
    const positionRank = { above: 2, base: 1, below: 0 };
    return floors.slice().sort((left, right) =>
        positionRank[right.position] - positionRank[left.position] ||
        getFloorRepresentativeHeight(right) - getFloorRepresentativeHeight(left) ||
        right.stackOrder - left.stackOrder,
    );
}
