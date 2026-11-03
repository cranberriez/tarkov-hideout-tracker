import { GAME_MODE_CONFIG, gameModeFromSlug, type GameMode } from "./game-mode";

/**
 * Canonical routes for mode-scoped pages. Every data page lives under its game
 * mode's URL slug (`/pvp/hideout`, `/kord/quests/<id>`), so the server renders
 * one cacheable response per mode. IDs are stable Tarkov entity IDs.
 */

/** First path segments that only exist below a mode slug. */
export const MODE_SCOPED_ROOTS = ["hideout", "items", "quests", "maps", "games", "uploader"] as const;

function isModeScopedRoot(segment: string | undefined) {
	return MODE_SCOPED_ROOTS.includes(segment as (typeof MODE_SCOPED_ROOTS)[number]);
}

/** Splits `/pve/items` into `{ mode: "PVE", path: "/items" }`. Unprefixed paths have no mode. */
export function splitModePath(pathname: string): { mode: GameMode | null; path: string } {
	const [, first, ...rest] = pathname.split("/");
	const mode = gameModeFromSlug(first);
	if (!mode) return { mode: null, path: pathname };
	return { mode, path: `/${rest.join("/")}` };
}

/** Whether a mode-less path (`/items?x`) names a mode-scoped page. */
export function isModeScopedPath(path: string) {
	return isModeScopedRoot(path.split(/[/?#]/)[1]);
}

/**
 * Prefixes a mode-less path with the mode slug when it names a mode-scoped
 * page; other paths (settings, story, news) are returned unchanged.
 */
export function modeHref(mode: GameMode, path: string) {
	return isModeScopedPath(path) ? `/${GAME_MODE_CONFIG[mode].slug}${path}` : path;
}

/** The current path re-targeted to another mode, keeping the query string. */
export function switchModeHref(pathname: string, search: string, mode: GameMode) {
	const { path } = splitModePath(pathname);
	return `${modeHref(mode, path)}${search}`;
}

/** Mode-less entity paths, for {@link modeHref} or `ModeLink`. */
export function itemPath(itemId: string) {
	return `/items/${encodeURIComponent(itemId)}`;
}

export function questPath(questId: string) {
	return `/quests/${encodeURIComponent(questId)}`;
}

export function stationPath(stationId: string) {
	return `/hideout/stations/${encodeURIComponent(stationId)}`;
}

export function itemHref(mode: GameMode, itemId: string) {
	return modeHref(mode, itemPath(itemId));
}

export function questsHref(mode: GameMode) {
	return modeHref(mode, "/quests");
}

export function questHref(mode: GameMode, questId: string, devQuery: string | null = null) {
	const href = modeHref(mode, questPath(questId));
	return devQuery ? `${href}?q=${encodeURIComponent(devQuery)}` : href;
}

/** Opens a quest workspace panel on arrival; the workspace strips the parameter once applied. */
export const QUEST_VIEW_PARAM = "view";
export const QUEST_VIEWS = ["board", "visualizer"] as const;
export type QuestView = (typeof QUEST_VIEWS)[number];

/** Mode-less: nav entries are prefixed at render time with {@link modeHref}. */
export function questViewPath(view: QuestView) {
	return `/quests?${QUEST_VIEW_PARAM}=${view}`;
}

export function stationHref(mode: GameMode, stationId: string) {
	return modeHref(mode, stationPath(stationId));
}

export const PROFIT_PAGE_PATHS = {
	barter: "/items/barter-profits",
	craft: "/items/crafting-profits",
} as const;

export function profitRecipeHref(mode: GameMode, kind: keyof typeof PROFIT_PAGE_PATHS, recipeId?: string) {
	const href = modeHref(mode, PROFIT_PAGE_PATHS[kind]);
	return recipeId ? `${href}?recipe=${encodeURIComponent(recipeId)}` : href;
}
