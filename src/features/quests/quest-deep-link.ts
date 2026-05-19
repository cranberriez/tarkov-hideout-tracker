export const QUEST_QUERY_PARAM = "quest";

export function getQuestDeepLinkId(location: Pick<Location, "hash" | "search">): string | null {
    const queryQuestId = new URLSearchParams(location.search).get(QUEST_QUERY_PARAM);
    if (queryQuestId) return queryQuestId;

    const hashMatch = location.hash.match(/^#quest-(.+)$/);
    return hashMatch?.[1] ?? null;
}

export function getQuestDeepLinkHref(questId: string) {
    return `/quests?${QUEST_QUERY_PARAM}=${encodeURIComponent(questId)}`;
}

export function clearQuestDeepLink() {
    const url = new URL(window.location.href);
    url.searchParams.delete(QUEST_QUERY_PARAM);
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
