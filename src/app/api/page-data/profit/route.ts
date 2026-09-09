import { NextRequest, NextResponse } from "next/server";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { getCurrentPageRepository, readPageDataMode } from "../_shared";

export async function GET(request: NextRequest) {
    const mode = readPageDataMode(request);
    if (!mode) return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
    try {
        const data = await getProfitPageData(mode, await getCurrentPageRepository(mode));
        return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Profit page data could not be loaded", error);
        return NextResponse.json({ error: "Profit page data could not be loaded" }, { status: 503 });
    }
}
