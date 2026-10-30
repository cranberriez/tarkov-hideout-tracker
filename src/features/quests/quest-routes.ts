export { QUEST_VIEW_PARAM, QUEST_VIEWS, questHref, questsHref } from "../../lib/entity-routes";
export type { QuestView } from "../../lib/entity-routes";

/** Legacy `/quests?quest=<id>` links; redirected by the proxy to the saved mode. */
export const LEGACY_QUEST_QUERY_PARAM = "quest";

/** Legacy `#quest-<id>` fragments never reach the server, so the client translates them. */
export function getLegacyQuestHashId(hash: string): string | null {
	const match = hash.match(/^#quest-(.+)$/);
	return match ? decodeURIComponent(match[1]) : null;
}
