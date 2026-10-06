"use client";

import { useCallback, useMemo } from "react";
import type { GameMode } from "@/lib/game-mode";
import { useStoredProfitValue } from "../../profit-pages/useStoredProfitValue";

/** Saved acquisition route key per fuel tank item ID; anything malformed reads as "no choice". */
export function parseFuelRouteChoices(raw: string | null): Record<string, string> {
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "string"));
	} catch {
		return {};
	}
}

/**
 * Chosen acquisition route per fuel tank for the active profile, in its own mode-scoped key
 * (`PVP`, `PVE`, `KORD`). Only routes the user picked are stored; the rest follow the recommendation.
 */
export function useFuelRouteChoices(gameMode: GameMode) {
	const [raw, update] = useStoredProfitValue(`tarkov-fuel-routes-v1:${gameMode}`);
	const choices = useMemo(() => parseFuelRouteChoices(raw), [raw]);
	const setChoice = useCallback(
		(tankId: string, routeKey: string | undefined) =>
			update((current) => {
				const next = { ...parseFuelRouteChoices(current) };
				if (routeKey === undefined) delete next[tankId];
				else next[tankId] = routeKey;
				return JSON.stringify(next);
			}),
		[update],
	);
	return [choices, setChoice] as const;
}
