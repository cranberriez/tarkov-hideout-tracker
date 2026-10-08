"use client";

import { useCallback, useMemo } from "react";
import type { GameMode } from "@/lib/game-mode";
import { parsePinnedCrafts as parsePinnedIds } from "@/features/profit-pages/usePinnedCrafts";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";

/** Pinned market item IDs for one profile, in pin order; their own key, outside backups and resets. */
export function useMarketPins(gameMode: GameMode) {
	const [raw, update] = useStoredProfitValue(`tarkov-market-pinned-items-v1:${gameMode}`);
	const pinnedIds = useMemo(() => Object.keys(parsePinnedIds(raw)), [raw]);
	const togglePin = useCallback(
		(itemId: string) =>
			update((current) => {
				const pins = parsePinnedIds(current);
				if (pins[itemId]) delete pins[itemId];
				else pins[itemId] = true;
				return JSON.stringify(Object.keys(pins));
			}),
		[update],
	);
	return { pinnedIds, togglePin };
}
