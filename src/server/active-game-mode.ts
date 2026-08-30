import { cookies } from "next/headers";
import {
    ACTIVE_GAME_MODE_COOKIE,
    parseGameMode,
    toTarkovJsonGameMode,
    type GameMode,
} from "@/lib/game-mode";

export { ACTIVE_GAME_MODE_COOKIE };

export async function getActiveGameMode(): Promise<GameMode> {
    const cookieStore = await cookies();
    return parseGameMode(cookieStore.get(ACTIVE_GAME_MODE_COOKIE)?.value);
}

export async function getActiveTarkovJsonGameMode() {
    return toTarkovJsonGameMode(await getActiveGameMode());
}
