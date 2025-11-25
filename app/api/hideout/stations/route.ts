import { NextResponse } from "next/server";
import { getHideoutStations } from "@/app/server/services/hideout";

const SIX_HOURS_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=21600",
    "CDN-Cache-Control": "public, s-maxage=21600",
};

export async function GET() {
    try {
        const stations = await getHideoutStations();
        return NextResponse.json(
            {
                data: { stations },
                updatedAt: Date.now(),
            },
            {
                headers: SIX_HOURS_CACHE_HEADERS,
            }
        );
    } catch (error) {
        console.error("/api/hideout/stations unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
