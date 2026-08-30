export type GameMode = "PVP" | "PVE" | "KORD";
export type TarkovJsonGameMode = "regular" | "pve" | "pvp-season";

export const GAME_MODES: readonly GameMode[] = ["PVP", "PVE", "KORD"];
export const ACTIVE_GAME_MODE_COOKIE = "tarkov-active-game-mode";

export function toTarkovJsonGameMode(mode: GameMode): TarkovJsonGameMode {
    if (mode === "PVE") return "pve";
    if (mode === "KORD") return "pvp-season";
    return "regular";
}

export function parseGameMode(value: string | null | undefined): GameMode {
    const normalized = value?.toUpperCase();
    if (normalized === "PVE") return "PVE";
    if (normalized === "KORD" || normalized === "PVP-SEASON") return "KORD";
    return "PVP";
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
