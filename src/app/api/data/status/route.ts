import { NextRequest, NextResponse } from "next/server";
import type { TarkovDataMode } from "@/types/common";
import { getDataStatus } from "@/server/queries/getDataStatus";

const MODES = new Set<TarkovDataMode>(["regular", "pve", "pvp-season"]);

export async function GET(request: NextRequest) {
    const requestedMode = request.nextUrl.searchParams.get("mode");
    if (!requestedMode || !MODES.has(requestedMode as TarkovDataMode)) {
        return NextResponse.json(
            { error: "A supported game mode is required" },
            { status: 400 },
        );
    }

    const payload = await getDataStatus(requestedMode as TarkovDataMode);
    return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, no-store" },
    });
}
