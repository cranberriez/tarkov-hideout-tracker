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

export const PROFIT_PAGE_HREFS = {
	barter: "/items/barter-profits",
	craft: "/items/crafting-profits",
} as const;

export function profitRecipeHref(kind: keyof typeof PROFIT_PAGE_HREFS, recipeId?: string) {
	const href = PROFIT_PAGE_HREFS[kind];
	return recipeId ? `${href}?recipe=${encodeURIComponent(recipeId)}` : href;
}
