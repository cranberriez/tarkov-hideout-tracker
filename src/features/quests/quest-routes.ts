import { splitModePath } from "../../lib/entity-routes";
import type { GameMode } from "../../lib/game-mode";
import { decodeRouteParam } from "../../lib/utils/route-param";

export { QUEST_VIEW_PARAM, QUEST_VIEWS, questHref, questsHref } from "../../lib/entity-routes";
export type { QuestView } from "../../lib/entity-routes";

/** Legacy `/quests?quest=<id>` links; redirected by the proxy to the saved mode. */
export const LEGACY_QUEST_QUERY_PARAM = "quest";

/** Legacy `#quest-<id>` fragments never reach the server, so the client translates them. */
export function getLegacyQuestHashId(hash: string): string | null {
	const match = hash.match(/^#quest-(.+)$/);
	return match ? decodeURIComponent(match[1]) : null;
}

/** The quest a workspace URL selects (`/<mode>/quests/<id>`), or null for the index and other pages. */
export function selectedQuestIdFromPath(pathname: string): string | null {
	const match = splitModePath(pathname).path.match(/^\/quests\/([^/]+)\/?$/);
	return match ? decodeRouteParam(match[1]) : null;
}

/** Whether a same-origin URL is a quest workspace page (index or quest) in `mode`. */
export function isQuestWorkspaceUrl(url: URL, mode: GameMode): boolean {
	const { mode: urlMode, path } = splitModePath(url.pathname);
	return urlMode === mode && /^\/quests(?:\/[^/]+)?\/?$/.test(path);
}
