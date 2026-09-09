import { NextRequest, NextResponse } from "next/server";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";
import { getCurrentPageRepository, readPageDataMode } from "../_shared";

export async function GET(request: NextRequest) {
    const mode = readPageDataMode(request);
    if (!mode) return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
    try {
        const data = await getHideoutPageData(mode, await getCurrentPageRepository(mode), { includePrices: false });
        return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Hideout page data could not be loaded", error);
        return NextResponse.json({ error: "Hideout page data could not be loaded" }, { status: 503 });
    }
}
