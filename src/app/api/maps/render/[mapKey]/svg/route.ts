import { getMapRenderDefinition } from "@/server/services/map-render-definitions";
import { applyMapSvgLayers } from "@/server/services/map-svg-layers";

const USER_AGENT = "TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ mapKey: string }> },
) {
    const { mapKey } = await params;
    const definition = getMapRenderDefinition(mapKey);
    const svgUrl = definition?.svgPath;
    if (!svgUrl || !svgUrl.startsWith("https://assets.tarkov.dev/maps/svg/")) {
        return new Response("Unsupported map", { status: 404 });
    }

    const response = await fetch(svgUrl, {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 604800 },
    });
    if (!response.ok) return new Response("Map asset unavailable", { status: 502 });
    const requestedFloorIds = new Set(new URL(request.url).searchParams.getAll("layer"));
    const validFloorIds = new Set(definition.floors.map((floor) => floor.id));
    const selectedFloorIds = new Set([...requestedFloorIds].filter((floorId) => validFloorIds.has(floorId)));
    definition.floors.filter((floor) => floor.isBase).forEach((floor) => selectedFloorIds.add(floor.id));
    const svg = applyMapSvgLayers(await response.text(), definition.floors, selectedFloorIds);
    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
    });
}
