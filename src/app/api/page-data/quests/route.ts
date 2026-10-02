import { NextRequest, NextResponse } from "next/server";
import { isCompleteQuestWorkspacePageData } from "@/lib/query/page-data";
import { isDev } from "@/lib/is-dev";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { DEV_QUEST_FIXTURES, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { getQuestWorkspacePageData } from "@/server/queries/getQuestWorkspacePageData";
import { getCurrentPageRepository } from "@/app/api/_lib/page-data-params";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const { mode } = modeParam;
	const showDevQuest =
		isDev && request.nextUrl.searchParams.get("q") === DEV_QUEST_QUERY;
	try {
		const data = await getQuestWorkspacePageData(mode, await getCurrentPageRepository(mode), {
			includePrices: false,
			showRemovedQuests: SHOW_REMOVED_QUESTS,
			displayQuestAdditions: showDevQuest ? DEV_QUEST_FIXTURES : [],
		});
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": isCompleteQuestWorkspacePageData(data) ? CacheControl.publicCdnHour : CacheControl.noStore,
			},
		});
	} catch (error) {
		console.error("Quest page data could not be loaded", error);
		return NextResponse.json(
			{ error: "Quest page data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
