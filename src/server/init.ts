import { NextResponse } from "next/server";
import { redis } from "@/server/redis";

export const POST = async () => {
    // Fetch data from Redis
    const result = await redis.get("itemCatalog", "item");

    // Return the result in the response
    return new NextResponse(JSON.stringify({ result }), { status: 200 });
};
