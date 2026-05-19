import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshTarkovDevMarketPrices } from "@/server/services/tarkovDevMarket";

export async function GET(req: NextRequest) {
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
    const auth = req.headers.get("authorization");

    if (!expected || !auth || auth !== expected) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const [pvp, pve] = await Promise.all([
            refreshTarkovDevMarketPrices("PVP"),
            refreshTarkovDevMarketPrices("PVE"),
        ]);

        return NextResponse.json({ ok: true, results: [pvp, pve] }, { status: 200 });
    } catch (error) {
        console.error("price-update cron failed", error);
        return new NextResponse("Price update failed", { status: 500 });
    }
}
