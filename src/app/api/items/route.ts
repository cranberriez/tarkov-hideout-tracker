import { NextResponse } from "next/server";
import { getHideoutRequiredItems } from "@/server/services/items";

const SIX_HOURS_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=21600",
    "CDN-Cache-Control": "public, s-maxage=21600",
};

export async function GET() {
    try {
        const body = await getHideoutRequiredItems();
        return NextResponse.json(body, {
            headers: SIX_HOURS_CACHE_HEADERS,
        });
    } catch (error) {
        console.error("/api/items unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
