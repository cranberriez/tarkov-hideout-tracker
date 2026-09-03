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
//   item-data      - item catalog metadata and prices
//   hideout-data   - station requirements
//   quests         - quest, trader data
const INTERNAL_TAGS_BY_PUBLIC_TAG = {
    "item-data": [],
    "hideout-data": ["hideout-data"],
    quests: ["quests", "traders"],
} as const;

type PublicTag = keyof typeof INTERNAL_TAGS_BY_PUBLIC_TAG;

export async function GET(req: NextRequest) {
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
    const auth = req.headers.get("authorization");

    if (!expected || !auth || auth !== expected) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const tag = req.nextUrl.searchParams.get("tag") ?? "";

    if (!(tag in INTERNAL_TAGS_BY_PUBLIC_TAG)) {
        return NextResponse.json(
            {
                ok: false,
                error: `Invalid tag. Allowed: ${Object.keys(INTERNAL_TAGS_BY_PUBLIC_TAG).join(", ")}`,
            },
            { status: 400 }
        );
    }

    const internalTags = INTERNAL_TAGS_BY_PUBLIC_TAG[tag as PublicTag];
    for (const internalTag of internalTags) {
        revalidateTag(internalTag, { expire: 0 });
    }

    return NextResponse.json({ ok: true, revalidated: tag, internalTags });
}
