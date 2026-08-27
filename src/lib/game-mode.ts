export type GameMode = "PVP" | "PVE" | "KORD";
export type TarkovJsonGameMode = "regular" | "pve" | "pvp-season";

export const GAME_MODES: readonly GameMode[] = ["PVP", "PVE", "KORD"];

export function toTarkovJsonGameMode(mode: GameMode): TarkovJsonGameMode {
    if (mode === "PVE") return "pve";
    if (mode === "KORD") return "pvp-season";
    return "regular";
}

export function parseGameMode(value: string | null | undefined): GameMode {
    const normalized = value?.toUpperCase();
    if (normalized === "PVE") return "PVE";
    if (normalized === "KORD" || value === "pvp-season") return "KORD";
    return "PVP";
}
