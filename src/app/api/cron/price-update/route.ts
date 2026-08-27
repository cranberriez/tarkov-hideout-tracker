import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refreshMarketPrices } from "@/server/services/tarkovData";

export async function GET(req: NextRequest) {
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
    const auth = req.headers.get("authorization");

    if (!expected || !auth || auth !== expected) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const [pvp, pve, kord] = await Promise.all([
            refreshMarketPrices("PVP"),
            refreshMarketPrices("PVE"),
            refreshMarketPrices("KORD"),
        ]);
        revalidateTag("market-prices", { expire: 0 });

        return NextResponse.json({ ok: true, results: [pvp, pve, kord] }, { status: 200 });
    } catch (error) {
        console.error("price-update cron failed", error);
        return new NextResponse("Price update failed", { status: 500 });
    }
}
