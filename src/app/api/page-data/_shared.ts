import type { NextRequest } from "next/server";
import { isTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
export { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export function readPageDataMode(request: NextRequest): TarkovJsonGameMode | null {
    const mode = request.nextUrl.searchParams.get("mode");
    return isTarkovJsonGameMode(mode) ? mode : null;
}
