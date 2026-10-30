"use client";

import { useEffect } from "react";
import { readActiveGameModeCookie, serializeActiveGameModeCookie, type GameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";

/**
 * Keeps the active-mode cookie aligned with the hydrated local profile. The cookie
 * is only a client preference: the proxy uses it to send old unprefixed links to
 * the saved mode. Server rendering of mode-scoped pages never reads it.
 */
export function ActiveGameModeSync() {
	const gameMode = useUserStore((state) => state.gameMode);

	useEffect(() => {
		function syncCookie(mode: GameMode) {
			if (readActiveGameModeCookie(document.cookie) !== mode) document.cookie = serializeActiveGameModeCookie(mode);
		}

		if (useUserStore.persist.hasHydrated()) {
			// The render can still hold the pre-hydration default; read the hydrated owner.
			syncCookie(useUserStore.getState().gameMode);
			return;
		}

		return useUserStore.persist.onFinishHydration((state) => syncCookie(state.gameMode));
	}, [gameMode]);

	return null;
}
