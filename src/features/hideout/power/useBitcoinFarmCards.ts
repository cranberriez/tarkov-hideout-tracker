"use client";

import { useCallback } from "react";
import type { GameMode } from "@/lib/game-mode";
import { useStoredProfitValue } from "../../profit-pages/useStoredProfitValue";

export function parseCardCount(raw: string | null): number {
	const value = Number(raw);
	return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * Installed graphics cards for the active profile, in its own mode-scoped key (`PVP`, `PVE`,
 * `KORD`). The stored count is not clamped; callers cap it to the slots at the built level.
 */
export function useBitcoinFarmCards(gameMode: GameMode) {
	const [raw, update] = useStoredProfitValue(`tarkov-bitcoin-farm-cards-v1:${gameMode}`);
	const setCards = useCallback((count: number) => update(() => String(parseCardCount(String(count)))), [update]);
	return [parseCardCount(raw), setCards] as const;
}
