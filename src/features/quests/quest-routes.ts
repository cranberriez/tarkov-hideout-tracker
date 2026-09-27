export const QUESTS_HREF = "/quests";

/** Legacy `/quests?quest=<id>` links; translated by the quests index route. */
export const LEGACY_QUEST_QUERY_PARAM = "quest";

export function questHref(questId: string, devQuery: string | null = null) {
    const href = `${QUESTS_HREF}/${encodeURIComponent(questId)}`;
    return devQuery ? `${href}?q=${encodeURIComponent(devQuery)}` : href;
}

/** Legacy `#quest-<id>` fragments never reach the server, so the client translates them. */
export function getLegacyQuestHashId(hash: string): string | null {
    const match = hash.match(/^#quest-(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
}
