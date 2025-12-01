import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshTarkovMarketPrices } from "@/server/services/tarkovMarketBulk";

export async function GET(req: NextRequest) {
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
    const auth = req.headers.get("authorization");

    if (!expected || !auth || auth !== expected) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        await refreshTarkovMarketPrices("PVP");
        await refreshTarkovMarketPrices("PVE");

        return new NextResponse("OK", { status: 200 });
    } catch (error) {
        console.error("bulk-update cron failed", error);
        return new NextResponse("Bulk update failed", { status: 500 });
    }
}
