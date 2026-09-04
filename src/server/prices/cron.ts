import { NextRequest, NextResponse } from "next/server";
import type { TarkovDataMode } from "@/types/common";
import { getTursoClient } from "@/server/db/client";
import { getActiveDataReleaseId } from "@/server/db/release-config";
import { TursoPriceRefreshStore } from "./price-store";
import { refreshPriceMode } from "./refresh-prices";

export async function runPriceCron(
    request: NextRequest,
    modes: readonly TarkovDataMode[],
) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
        return NextResponse.json(
            { error: "CRON_SECRET is not configured" },
            { status: 503 },
        );
    }
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = new TursoPriceRefreshStore(getTursoClient());
    const summaries = [];
    try {
        for (const mode of modes) {
            summaries.push(await refreshPriceMode({
                mode,
                releaseId: getActiveDataReleaseId(mode),
                store,
            }));
        }
        return NextResponse.json({ summaries });
    } catch (error) {
        console.error("Scheduled price refresh failed", error);
        return NextResponse.json(
            { error: "Scheduled price refresh failed", summaries },
            { status: 500 },
        );
    }
}
