import { NextResponse } from "next/server";
import { getMapNavigationMarkers } from "@/server/services/map-navigation-overlays";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ mapKey: string }> },
) {
    const { mapKey } = await params;
    const markers = await getMapNavigationMarkers(mapKey);
    if (!markers) {
        return NextResponse.json({ error: "This map does not have a supported SVG definition." }, { status: 404 });
    }
    return NextResponse.json(
        { markers },
        { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
    );
}
