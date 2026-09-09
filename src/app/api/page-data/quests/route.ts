import { NextRequest, NextResponse } from "next/server";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { DEV_QUEST_FIXTURES, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { getQuestWorkspacePageData } from "@/server/queries/getQuestWorkspacePageData";
import { getCurrentPageRepository, readPageDataMode } from "../_shared";

export async function GET(request: NextRequest) {
    const mode = readPageDataMode(request);
    if (!mode) return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
    const showDevQuest = process.env.NODE_ENV === "development" && request.nextUrl.searchParams.get("q") === DEV_QUEST_QUERY;
    try {
        const data = await getQuestWorkspacePageData(mode, await getCurrentPageRepository(mode), {
            includePrices: false,
            showRemovedQuests: SHOW_REMOVED_QUESTS,
            displayQuestAdditions: showDevQuest ? DEV_QUEST_FIXTURES : [],
        });
        return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Quest page data could not be loaded", error);
        return NextResponse.json({ error: "Quest page data could not be loaded" }, { status: 503 });
    }
}
