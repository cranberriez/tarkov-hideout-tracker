import { NextRequest, NextResponse } from "next/server";
import { getItemPriceResponse } from "@/server/queries/getDeferredPrices";
import { parsePriceRequest } from "@/lib/query/price-contract";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const input = parsePriceRequest(request.nextUrl.searchParams);
	if (!input)
		return NextResponse.json(
			{ error: "A supported mode and 1–200 item IDs or checklist/recipes scope are required" },
			{
				status: 400,
				headers: { "Cache-Control": CacheControl.privateNoStore },
			},
		);
	try {
		return NextResponse.json(await getItemPriceResponse(input), {
			headers: { "Cache-Control": CacheControl.publicCdnHour },
		});
	} catch {
		return NextResponse.json(
			{ error: "Prices could not be loaded. Retry the request." },
			{
				status: 503,
				headers: { "Cache-Control": CacheControl.privateNoStore },
			},
		);
	}
}
