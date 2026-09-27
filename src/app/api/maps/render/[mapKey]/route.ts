import { NextResponse } from "next/server";
import { getMapRenderDefinition } from "@/server/services/map-render-definitions";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ mapKey: string }> },
) {
    const { mapKey } = await params;
    const definition = getMapRenderDefinition(mapKey);
    if (!definition) {
        return NextResponse.json({ error: "This map does not have a supported SVG definition." }, { status: 404 });
    }
    return NextResponse.json(
        { ...definition, svgPath: `/api/maps/render/${encodeURIComponent(mapKey)}/svg` },
        { headers: { "Cache-Control": CacheControl.mapData } },
    );
}
