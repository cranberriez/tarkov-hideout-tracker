import { NextResponse } from "next/server";
import type { ItemsPricesPayload, TimedResponse } from "@/app/types";

// TODO: inject Redis client and Tarkov.dev GraphQL client
// const redis = ...
// const tarkovClient = ...

const CACHE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const REDIS_KEY = "items:prices:v1";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    const requestedIds = idsParam
        ? idsParam
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
        : undefined;

    // Placeholder implementation returning an empty payload with current timestamp.
    // Replace this with: determine ID set -> check Redis -> maybe fetch Tarkov.dev -> normalize -> cache.

    const payload: ItemsPricesPayload = {};

    const body: TimedResponse<ItemsPricesPayload> = {
        data: payload,
        updatedAt: Date.now(),
    };

    return NextResponse.json(body, { status: 200 });
}
