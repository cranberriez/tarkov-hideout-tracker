import { NextRequest, NextResponse } from "next/server";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { DEV_QUEST_FIXTURES, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { isDev } from "@/lib/is-dev";
import { getQuestDetailsData } from "@/server/queries/getQuestDetailsData";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { readModeParam } from "@/app/api/_lib/mode-params";

const MAX_QUEST_IDS = 50;
const MAX_QUEST_ID_LENGTH = 128;

function badRequest(error: string) {
	return NextResponse.json({ error }, { status: 400, headers: { "Cache-Control": CacheControl.noStore } });
}

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const rawIds = request.nextUrl.searchParams.get("ids");
	if (!rawIds) return badRequest("At least one quest ID is required");
	const splitIds = rawIds.split(",").map((id) => id.trim());
	if (splitIds.some((id) => id.length === 0)) return badRequest("Quest IDs cannot be empty");
	if (splitIds.some((id) => id.length > MAX_QUEST_ID_LENGTH)) return badRequest("Quest ID is too long");
	const ids = [...new Set(splitIds)].sort();
	if (ids.length > MAX_QUEST_IDS) return badRequest(`At most ${MAX_QUEST_IDS} quest IDs may be requested`);
	const showDevQuest = isDev && request.nextUrl.searchParams.get("q") === DEV_QUEST_QUERY;

	try {
		const data = await getQuestDetailsData(modeParam.mode, ids, undefined, {
			showRemovedQuests: SHOW_REMOVED_QUESTS,
			displayQuestAdditions: showDevQuest ? DEV_QUEST_FIXTURES : [],
		});
		const complete =
			data.errors.quests === null &&
			data.errors.items === null &&
			data.unresolvedQuestIds.length === 0 &&
			data.unresolvedItemIds.length === 0;
		return NextResponse.json(data, {
			headers: { "Cache-Control": ids.length === 1 && complete ? CacheControl.publicCdnHour : CacheControl.noStore },
		});
	} catch (error) {
		console.error("Quest details could not be loaded", error);
		return NextResponse.json(
			{ error: "Quest details could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
