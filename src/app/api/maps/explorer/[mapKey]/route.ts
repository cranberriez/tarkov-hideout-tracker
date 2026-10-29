import { NextRequest, NextResponse } from "next/server";
import { getMapExplorerData } from "@/server/services/map-explorer-data";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { readModeParam } from "@/app/api/_lib/mode-params";

const MAP_KEY = /^[a-z0-9-]{1,64}$/;

/** One map's tarkov.dev document (translated, loot categorised) and its name lookups, for the Maps explorer. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ mapKey: string }> }) {
	const mode = readModeParam(request);
	if (!mode.ok) return mode.response;
	const { mapKey } = await params;
	const noStore = { headers: { "Cache-Control": CacheControl.noStore } };
	if (!MAP_KEY.test(mapKey)) return NextResponse.json({ error: "Unknown map" }, { status: 404, ...noStore });
	try {
		const payload = await getMapExplorerData(mode.mode, mapKey);
		if (!payload) return NextResponse.json({ error: "Unknown map" }, { status: 404, ...noStore });
		return NextResponse.json(payload, { headers: { "Cache-Control": CacheControl.mapExplorerData } });
	} catch (error) {
		console.error("Map explorer data failed", error);
		return NextResponse.json({ error: "Map data is unavailable right now" }, { status: 502, ...noStore });
	}
}
