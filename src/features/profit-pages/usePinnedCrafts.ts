"use client";
import { useMemo } from "react";
import type { GameMode } from "@/lib/game-mode";
import { useStoredProfitValue } from "./useStoredProfitValue";
export function parsePinnedCrafts(raw: string | null): Record<string, true> {
	try {
		const value: unknown = JSON.parse(raw ?? "[]");
		return Array.isArray(value) ? Object.fromEntries(value.filter((id): id is string => typeof id === "string").map((id) => [id, true])) : {};
	} catch {
		return {};
	}
}
export function usePinnedCrafts(gameMode: GameMode) {
	const [raw, update] = useStoredProfitValue(`tarkov-profit-pinned-crafts-v1:${gameMode}`);
	const pinnedCrafts = useMemo(() => parsePinnedCrafts(raw), [raw]);
	function togglePinnedCraft(craftId: string) {
		update((current) => {
			const pins = parsePinnedCrafts(current);
			if (pins[craftId]) delete pins[craftId];
			else pins[craftId] = true;
			return JSON.stringify(Object.keys(pins));
		});
	}
	return { pinnedCrafts, togglePinnedCraft };
}
