import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// Manual cache invalidation for infrequently changing data (e.g. after a
// game patch changes stations or quests). Usage:
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/revalidate?tag=quests"
//
// Allowed tags:
//   item-data      - tracked item metadata and prices
//   hideout-data   - stations + tracked items
//   quests         - quest, trader data
const ALLOWED_TAGS = new Set(["item-data", "hideout-data", "quests"]);

export async function GET(req: NextRequest) {
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
    const auth = req.headers.get("authorization");

    if (!expected || !auth || auth !== expected) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const tag = req.nextUrl.searchParams.get("tag") ?? "";

    if (!ALLOWED_TAGS.has(tag)) {
        return NextResponse.json(
            { ok: false, error: `Invalid tag. Allowed: ${Array.from(ALLOWED_TAGS).join(", ")}` },
            { status: 400 }
        );
    }

    revalidateTag(tag, { expire: 0 });

    return NextResponse.json({ ok: true, revalidated: tag });
}
