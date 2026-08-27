import { NextResponse } from "next/server";
import { getMapRenderDefinition } from "@/server/services/map-render-definitions";

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
        { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
    );
}
