"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toTarkovJsonGameMode, type GameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
export { gameDataKey, removeGameDataScope } from "./scope";
import { removeGameDataScope } from "./scope";

function subscribeToHydration(notify: () => void) {
	return useUserStore.persist.onFinishHydration(notify);
}

export function useUserStoreHydrated(): boolean {
	return useSyncExternalStore(subscribeToHydration, () => useUserStore.persist.hasHydrated(), () => false);
}

export function useGameDataEnabled(mode: TarkovJsonGameMode): boolean {
	const hydrated = useUserStoreHydrated();
	const activeMode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	return hydrated && activeMode === mode;
}

export function GameDataScopeLifecycle() {
	const client = useQueryClient();
	const hydrated = useUserStoreHydrated();
	const gameMode: GameMode = useUserStore((state) => state.gameMode);
	const mode = toTarkovJsonGameMode(gameMode);
	const previousMode = useRef<TarkovJsonGameMode | null>(null);

	useEffect(() => {
		if (!hydrated) return;
		const oldMode = previousMode.current;
		previousMode.current = mode;
		if (oldMode && oldMode !== mode) void removeGameDataScope(client, oldMode);
	}, [client, hydrated, mode]);

	return null;
}
