import { NextRequest, NextResponse } from "next/server";
import { getItemChecklistPageData } from "@/server/queries/getItemChecklistPageData";
import { getCurrentPageRepository, readPageDataMode } from "../_shared";

export async function GET(request: NextRequest) {
    const mode = readPageDataMode(request);
    if (!mode) return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
    try {
        const data = await getItemChecklistPageData(mode, await getCurrentPageRepository(mode), { includePrices: false });
        return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Items page data could not be loaded", error);
        return NextResponse.json({ error: "Items page data could not be loaded" }, { status: 503 });
    }
}
