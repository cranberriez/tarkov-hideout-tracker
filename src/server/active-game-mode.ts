import { cookies } from "next/headers";
import { parseGameMode, toTarkovJsonGameMode, type GameMode } from "@/lib/game-mode";

export const ACTIVE_GAME_MODE_COOKIE = "tarkov-active-game-mode";

export async function getActiveGameMode(): Promise<GameMode> {
    const cookieStore = await cookies();
    return parseGameMode(cookieStore.get(ACTIVE_GAME_MODE_COOKIE)?.value);
}

export async function getActiveTarkovJsonGameMode() {
    return toTarkovJsonGameMode(await getActiveGameMode());
}
