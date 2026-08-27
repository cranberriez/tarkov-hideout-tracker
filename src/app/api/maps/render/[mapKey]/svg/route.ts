import { getMapSvgUpstreamUrl } from "@/server/services/map-render-definitions";

const USER_AGENT = "TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ mapKey: string }> },
) {
    const { mapKey } = await params;
    const svgUrl = getMapSvgUpstreamUrl(mapKey);
    if (!svgUrl || !svgUrl.startsWith("https://assets.tarkov.dev/maps/svg/")) {
        return new Response("Unsupported map", { status: 404 });
    }

    const response = await fetch(svgUrl, {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 604800 },
    });
    if (!response.ok) return new Response("Map asset unavailable", { status: 502 });
    return new Response(await response.arrayBuffer(), {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
    });
}
