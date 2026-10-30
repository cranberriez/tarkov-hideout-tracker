"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { modeHref, splitModePath } from "./entity-routes";
import type { GameMode } from "./game-mode";
import { useUserStore } from "./stores/useUserStore";

/**
 * The game mode links should target: the URL's mode on mode-scoped pages,
 * otherwise the active profile's mode. `path` is the pathname without its mode
 * slug, for route comparisons; `href` builds a link for a mode-less path.
 */
export function useModeRoute() {
	const pathname = usePathname();
	const storeMode = useUserStore((state) => state.gameMode);
	const { mode: routeMode, path } = splitModePath(pathname);
	const mode: GameMode = routeMode ?? storeMode;
	const href = useCallback((target: string) => modeHref(mode, target), [mode]);
	return { mode, routeMode, path, href };
}
