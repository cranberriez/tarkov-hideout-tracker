import { NextRequest, NextResponse } from "next/server";
import { getDeferredPrices, getItemPriceResponse } from "@/server/queries/getDeferredPrices";
import { parsePriceRequest } from "@/lib/query/price-contract";
import { isTarkovJsonGameMode } from "@/lib/game-mode";
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

// Compatibility for clients that were opened before the GET transport deployed.
export async function POST(request: NextRequest) {
	let body;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid price request" }, { status: 400 });
	}
	const { mode, ids } = body ?? {};
	if (
		!isTarkovJsonGameMode(mode) ||
		!Array.isArray(ids) ||
		ids.length > 200 ||
		ids.some((id) => typeof id !== "string" || !/^[a-f0-9]{24}$/.test(id))
	) {
		return NextResponse.json({ error: "A supported mode and at most 200 item IDs are required" }, { status: 400 });
	}
	try {
		const prices = await getDeferredPrices(mode, [...new Set<string>(ids)]);
		return NextResponse.json({ prices }, { headers: { "Cache-Control": CacheControl.privateNoStore } });
	} catch {
		return NextResponse.json(
			{ error: "Prices could not be loaded. Retry or refresh the page." },
			{ status: 503, headers: { "Cache-Control": CacheControl.privateNoStore } },
		);
	}
}
