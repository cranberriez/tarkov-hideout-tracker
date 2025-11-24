import { NextResponse } from "next/server";
import type { HideoutStationsPayload, TimedResponse } from "@/app/types";

// TODO: inject Redis client and Tarkov.dev GraphQL client
// const redis = ...
// const tarkovClient = ...

const CACHE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const REDIS_KEY = "hideout:stations:v1";

export async function GET() {
    // Placeholder implementation returning an empty payload with current timestamp.
    // Replace this with: check Redis -> maybe fetch Tarkov.dev -> normalize -> cache.

    const payload: HideoutStationsPayload = {
        stations: [],
    };

    const body: TimedResponse<HideoutStationsPayload> = {
        data: payload,
        updatedAt: Date.now(),
    };

    return NextResponse.json(body, { status: 200 });
}
