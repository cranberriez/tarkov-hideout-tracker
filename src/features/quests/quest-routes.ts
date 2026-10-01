export { QUEST_VIEW_PARAM, QUEST_VIEWS, QUESTS_HREF, questHref, questViewHref } from "../../lib/entity-routes";
export type { QuestView } from "../../lib/entity-routes";

/** Legacy `/quests?quest=<id>` links; translated by the quests index route. */
export const LEGACY_QUEST_QUERY_PARAM = "quest";

/** Legacy `#quest-<id>` fragments never reach the server, so the client translates them. */
export function getLegacyQuestHashId(hash: string): string | null {
	const match = hash.match(/^#quest-(.+)$/);
	return match ? decodeURIComponent(match[1]) : null;
}
