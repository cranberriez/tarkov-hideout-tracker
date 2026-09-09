import { NextRequest, NextResponse } from "next/server";
import { isCompleteKappaChecklistPageData } from "@/lib/query/page-data";
import { getKappaChecklistPageData } from "@/server/queries/getKappaChecklistPageData";
import { getCurrentPageRepository, readPageDataMode } from "../_shared";

export async function GET(request: NextRequest) {
    const mode = readPageDataMode(request);
    if (!mode) return NextResponse.json({ error: "A supported game mode is required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    try {
        const data = await getKappaChecklistPageData(mode, await getCurrentPageRepository(mode), { includePrices: false });
        return NextResponse.json(data, { headers: { "Cache-Control": isCompleteKappaChecklistPageData(data)
            ? "public, max-age=300, s-maxage=3600"
            : "no-store" } });
    } catch (error) {
        console.error("Kappa page data could not be loaded", error);
        return NextResponse.json({ error: "Kappa page data could not be loaded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
}
