import type { MapPoint3D } from "@/types";

export interface MapFloorExtent {
    height: [number, number];
    bounds?: Array<[[number, number], [number, number], string?]>;
}

export interface MapFloorDefinition {
    id: string;
    name: string;
    svgLayer: string;
    isBase: boolean;
    isDefaultVisible: boolean;
    position: "below" | "base" | "above";
    stackOrder: number;
    heightRange?: [number, number];
    extents: MapFloorExtent[];
}

export interface MapRenderDefinition {
    key: string;
    normalizedName: string;
    aliases: string[];
    bounds: [[number, number], [number, number]];
    svgBounds?: [[number, number], [number, number]];
    transform: [number, number, number, number];
    coordinateRotation: number;
    minZoom: number;
    maxZoom: number;
    svgPath: string;
    floors: MapFloorDefinition[];
    attribution: {
        author: string;
        authorLink: string;
        license: string;
        licenseLink: string;
    };
}

export interface ProjectedMapPoint {
    x: number;
    y: number;
    percentX: number;
    percentY: number;
}

export interface MapOverlayMarker {
    id: string;
    mapId: string;
    kind: "quest" | "extract" | "transit" | "goon";
    position: MapPoint3D;
    outlines?: MapPoint3D[][];
    label: string;
    title: string;
    descriptions: string[];
    color?: string;
    questId?: string;
    objectiveIds?: string[];
}
