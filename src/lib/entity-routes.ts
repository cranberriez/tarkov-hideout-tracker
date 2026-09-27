/** Canonical detail routes for shared entity links. IDs are stable Tarkov entity IDs. */
export const QUESTS_HREF = "/quests";

export function itemHref(itemId: string) {
    return `/items/${encodeURIComponent(itemId)}`;
}

export function questHref(questId: string, devQuery: string | null = null) {
    const href = `${QUESTS_HREF}/${encodeURIComponent(questId)}`;
    return devQuery ? `${href}?q=${encodeURIComponent(devQuery)}` : href;
}

export function stationHref(stationId: string) {
    return `/hideout/stations/${encodeURIComponent(stationId)}`;
}
