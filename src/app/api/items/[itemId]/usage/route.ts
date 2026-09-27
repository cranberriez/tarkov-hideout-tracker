import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "../_params";
import { getItemUsageView } from "@/server/db/item-views";
import { itemDatabaseErrorResponse } from "@/server/db/route-errors";
import { isCompleteItemUsageData } from "@/lib/utils/item-usage";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ itemId: string }> },
) {
    const params = await readItemRouteParams(request, context);
    if (!params.ok) return params.response;
    const { mode, itemId } = params;

    try {
        const response = await getItemUsageView(mode, itemId, request.nextUrl.searchParams.get("prices") !== "none");
        return NextResponse.json(response, {
            headers: {
                "Cache-Control": process.env.NODE_ENV === "development" || !isCompleteItemUsageData(response)
                    ? "no-store"
                    : "public, max-age=300, s-maxage=900, stale-while-revalidate=300",
            },
        });
    } catch (error) {
        return itemDatabaseErrorResponse(
            error,
            "Item usage is temporarily unavailable",
        );
    }
}
