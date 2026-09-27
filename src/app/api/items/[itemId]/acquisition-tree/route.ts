import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "../_params";
import { getItemAcquisitionView } from "@/server/db/item-views";
import { itemDatabaseErrorResponse } from "@/server/db/route-errors";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ itemId: string }> },
) {
    const params = await readItemRouteParams(request, context);
    if (!params.ok) return params.response;
    const { mode, itemId } = params;

    try {
        const payload = await getItemAcquisitionView(
            mode,
            itemId,
            request.nextUrl.searchParams.get("prices") !== "none",
        );
        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": process.env.NODE_ENV === "development" || Object.values(payload.errors).some(Boolean)
                    ? "private, no-store"
                    : "public, max-age=300, s-maxage=900, stale-while-revalidate=300",
            },
        });
    } catch (error) {
        return itemDatabaseErrorResponse(
            error,
            "Acquisition routes are temporarily unavailable",
        );
    }
}
