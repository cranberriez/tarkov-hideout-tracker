import { NextResponse, type NextRequest } from "next/server";
import { modeHref, questPath } from "@/lib/entity-routes";
import { ACTIVE_GAME_MODE_COOKIE, DEFAULT_GAME_MODE, parseGameMode } from "@/lib/game-mode";
import { LEGACY_QUEST_QUERY_PARAM } from "@/features/quests/quest-routes";

/**
 * Old unprefixed data URLs (`/hideout`, `/quests/<id>`, `/quests?quest=<id>`, bookmarks,
 * shared links) redirect to their mode-scoped page. The matcher lists only those
 * paths, so prefixed pages and assets never run the proxy and stay CDN-cacheable.
 *
 * With a saved mode cookie the redirect is temporary (307) to that mode; without one
 * (crawlers, first visits) it is permanent (308) to the default mode. Neither response
 * may be cached by browsers or the CDN, since the target depends on the cookie.
 */
export function proxy(request: NextRequest) {
	const saved = request.cookies.get(ACTIVE_GAME_MODE_COOKIE)?.value;
	const mode = saved ? parseGameMode(saved) : DEFAULT_GAME_MODE;
	const url = request.nextUrl.clone();
	let path = url.pathname === "/" ? "/hideout" : url.pathname;
	const legacyQuestId = path === "/quests" ? url.searchParams.get(LEGACY_QUEST_QUERY_PARAM) : null;
	if (legacyQuestId) {
		path = questPath(legacyQuestId);
		url.searchParams.delete(LEGACY_QUEST_QUERY_PARAM);
	}
	url.pathname = modeHref(mode, path);
	const response = NextResponse.redirect(url, saved ? 307 : 308);
	response.headers.set("Cache-Control", "private, no-store");
	return response;
}

export const config = {
	// Static literals only (Next reads them at build time). Keep in sync with MODE_SCOPED_ROOTS.
	// Maps match a single key segment so public `/maps/icons/*` and `/maps/svg/*` assets are untouched.
	matcher: [
		"/",
		"/hideout/:path*",
		"/items/:path*",
		"/quests/:path*",
		"/games/:path*",
		"/uploader",
		"/maps",
		"/maps/:mapKey([a-z0-9-]+)",
	],
};
