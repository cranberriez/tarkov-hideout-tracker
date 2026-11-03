export type GameMode = "PVP" | "PVE" | "KORD";
export type TarkovJsonGameMode = "regular" | "pve" | "pvp-season";
/** Raid-mode tag written to the game's quest logs. */
export type RaidMode = "pvp" | "pve" | "kord";
export type GameModeSlug = "pvp" | "pve" | "kord";

export interface GameModeDefinition {
	/** Tarkov JSON / catalog dataset for this profile. */
	dataMode: TarkovJsonGameMode;
	/** URL segment for mode-scoped routes (`/pvp/hideout`). */
	slug: GameModeSlug;
	raidMode: RaidMode;
	label: string;
	questImportTitle: string;
	/** Seasonal rules are authoritative: reviewed hideout overrides do not apply. */
	seasonal: boolean;
	hasLightkeeper: boolean;
}

/** Single source for per-mode mappings and rules. Key order is the canonical mode order. */
export const GAME_MODE_CONFIG: Readonly<Record<GameMode, GameModeDefinition>> = {
	PVP: {
		dataMode: "regular",
		slug: "pvp",
		raidMode: "pvp",
		label: "PVP",
		questImportTitle: "PVP Quests",
		seasonal: false,
		hasLightkeeper: true,
	},
	PVE: {
		dataMode: "pve",
		slug: "pve",
		raidMode: "pve",
		label: "PVE",
		questImportTitle: "PVE Quests",
		seasonal: false,
		hasLightkeeper: true,
	},
	KORD: {
		dataMode: "pvp-season",
		slug: "kord",
		raidMode: "kord",
		label: "KORD",
		questImportTitle: "KORD Seasonal Quests",
		seasonal: true,
		hasLightkeeper: true,
	},
};

export const GAME_MODES = Object.keys(GAME_MODE_CONFIG) as readonly GameMode[];
export const TARKOV_JSON_GAME_MODES: readonly TarkovJsonGameMode[] = GAME_MODES.map(
	(mode) => GAME_MODE_CONFIG[mode].dataMode,
);
export const DEFAULT_GAME_MODE: GameMode = "PVP";
export const DEFAULT_TARKOV_JSON_GAME_MODE: TarkovJsonGameMode = GAME_MODE_CONFIG[DEFAULT_GAME_MODE].dataMode;
export const ACTIVE_GAME_MODE_COOKIE = "tarkov-active-game-mode";

export function gameModeSlug(mode: GameMode): GameModeSlug {
	return GAME_MODE_CONFIG[mode].slug;
}

/** Exact, lowercase URL slugs only; anything else is not a mode route. */
export function gameModeFromSlug(slug: string | null | undefined): GameMode | null {
	return GAME_MODES.find((mode) => GAME_MODE_CONFIG[mode].slug === slug) ?? null;
}

export function isGameMode(value: unknown): value is GameMode {
	return typeof value === "string" && Object.hasOwn(GAME_MODE_CONFIG, value);
}

export function isTarkovJsonGameMode(value: unknown): value is TarkovJsonGameMode {
	return TARKOV_JSON_GAME_MODES.includes(value as TarkovJsonGameMode);
}

export function toTarkovJsonGameMode(mode: GameMode): TarkovJsonGameMode {
	return GAME_MODE_CONFIG[mode].dataMode;
}

export function fromTarkovJsonGameMode(dataMode: TarkovJsonGameMode): GameMode {
	return GAME_MODES.find((mode) => GAME_MODE_CONFIG[mode].dataMode === dataMode) ?? DEFAULT_GAME_MODE;
}

export function getGameModeForDataMode(dataMode: TarkovJsonGameMode): GameModeDefinition {
	return GAME_MODE_CONFIG[fromTarkovJsonGameMode(dataMode)];
}

/** Accepts profile names or data-mode prefixes in any case; unknown values fall back to PVP. */
export function parseGameMode(value: string | null | undefined): GameMode {
	const normalized = value?.toUpperCase();
	return (
		GAME_MODES.find((mode) => mode === normalized || GAME_MODE_CONFIG[mode].dataMode.toUpperCase() === normalized) ??
		DEFAULT_GAME_MODE
	);
}

export function readActiveGameModeCookie(cookieHeader: string): GameMode | null {
	const prefix = `${ACTIVE_GAME_MODE_COOKIE}=`;
	const entry = cookieHeader
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(prefix));
	if (!entry) return null;

	return parseGameMode(decodeURIComponent(entry.slice(prefix.length)));
}

export function serializeActiveGameModeCookie(mode: GameMode): string {
	return `${ACTIVE_GAME_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}
