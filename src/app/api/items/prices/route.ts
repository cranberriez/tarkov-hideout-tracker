import { NextRequest, NextResponse } from "next/server";
import { getDeferredPrices } from "@/server/queries/getDeferredPrices";

export async function POST(request: NextRequest) {
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid price request" }, { status: 400 }); }
    const { mode, ids } = body ?? {};
    if (!["regular", "pve", "pvp-season"].includes(mode) ||
        !Array.isArray(ids) || ids.length > 200 || ids.some((id) => typeof id !== "string" || !/^[a-f0-9]{24}$/.test(id))) {
        return NextResponse.json({ error: "A supported mode and at most 200 item IDs are required" }, { status: 400 });
    }
    try {
        const prices = await getDeferredPrices(mode, [...new Set<string>(ids)]);
        return NextResponse.json({ prices }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        return NextResponse.json({ error: "Prices could not be loaded. Retry or refresh the page." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
}
