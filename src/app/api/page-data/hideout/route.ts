import { NextRequest, NextResponse } from "next/server";
import { isCompleteHideoutPageData } from "@/lib/query/page-data";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";
import { getCurrentPageRepository, readPageDataMode } from "../_shared";

export async function GET(request: NextRequest) {
    const mode = readPageDataMode(request);
    if (!mode) return NextResponse.json({ error: "A supported game mode is required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    try {
        const data = await getHideoutPageData(mode, await getCurrentPageRepository(mode), { includePrices: false });
        return NextResponse.json(data, { headers: { "Cache-Control": isCompleteHideoutPageData(data)
            ? "public, max-age=300, s-maxage=3600"
            : "no-store" } });
    } catch (error) {
        console.error("Hideout page data could not be loaded", error);
        return NextResponse.json({ error: "Hideout page data could not be loaded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
}
