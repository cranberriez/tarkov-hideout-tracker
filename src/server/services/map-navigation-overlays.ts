import type { MapOverlayMarker } from "@/types/maps";
import { getMapRenderDefinition } from "./map-render-definitions";

interface NavigationPoint {
    x: number;
    y: number;
    z: number;
}

interface NavigationExtract {
    id: string;
    name: string;
    faction: string;
    position: NavigationPoint;
    outline?: NavigationPoint[];
}

interface NavigationTransit {
    id: string;
    name: string;
    destinationMapName: string;
    position: NavigationPoint;
    outline?: NavigationPoint[];
}

interface MapNavigationChunk {
    map: {
        id: string;
        name: string;
        normalizedName: string;
    };
    extracts: NavigationExtract[];
    transits: NavigationTransit[];
}

const navigationLoaders: Record<string, () => Promise<{ default: MapNavigationChunk }>> = {
    "customs": () => import("../../lib/data/map-overlays/extracts/customs.json"),
    "factory": () => import("../../lib/data/map-overlays/extracts/factory.json"),
    "ground-zero": () => import("../../lib/data/map-overlays/extracts/ground-zero.json"),
    "interchange": () => import("../../lib/data/map-overlays/extracts/interchange.json"),
    "lighthouse": () => import("../../lib/data/map-overlays/extracts/lighthouse.json"),
    "reserve": () => import("../../lib/data/map-overlays/extracts/reserve.json"),
    "shoreline": () => import("../../lib/data/map-overlays/extracts/shoreline.json"),
    "streets-of-tarkov": () => import("../../lib/data/map-overlays/extracts/streets-of-tarkov.json"),
    "terminal": () => import("../../lib/data/map-overlays/extracts/terminal.json"),
    "woods": () => import("../../lib/data/map-overlays/extracts/woods.json"),
};

export async function getMapNavigationMarkers(mapKey: string): Promise<MapOverlayMarker[] | null> {
    const definition = getMapRenderDefinition(mapKey);
    if (!definition) return null;
    const load = navigationLoaders[definition.normalizedName];
    if (!load) return [];
    const { default: chunk } = await load();

    const extracts: MapOverlayMarker[] = chunk.extracts
        .filter((extract) => extract.faction === "pmc")
        .map((extract) => ({
            id: `extract:${chunk.map.id}:${extract.id}`,
            mapId: chunk.map.id,
            kind: "extract",
            position: extract.position,
            outlines: extract.outline?.length ? [extract.outline] : [],
            label: extract.name,
            title: extract.name,
            descriptions: ["PMC extract"],
            color: "#54d66a",
        }));
    const transits: MapOverlayMarker[] = chunk.transits.map((transit) => ({
        id: `transit:${chunk.map.id}:${transit.id}`,
        mapId: chunk.map.id,
        kind: "transit",
        position: transit.position,
        outlines: transit.outline?.length ? [transit.outline] : [],
        label: transit.name,
        title: transit.name,
        descriptions: [`Transit to ${transit.destinationMapName}`],
        color: "#f59e0b",
    }));

    return [...extracts, ...transits];
}
