import type { NextRequest } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
export { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

const MODES = new Set<TarkovJsonGameMode>(["regular", "pve", "pvp-season"]);

export function readPageDataMode(request: NextRequest): TarkovJsonGameMode | null {
    const mode = request.nextUrl.searchParams.get("mode");
    return mode && MODES.has(mode as TarkovJsonGameMode) ? mode as TarkovJsonGameMode : null;
}
