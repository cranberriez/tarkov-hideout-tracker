"use client";

import { useCallback } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";

export function parseBestScore(raw: string | null): number {
	if (!raw) return 0;
	try {
		const value = (JSON.parse(raw) as { best?: unknown }).best;
		return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
	} catch {
		return 0;
	}
}

/** A game's best score as `{ best }` under its own key: global, outside profiles, backups and resets. */
export function useBestScore(key: string) {
	const [raw, update] = useStoredProfitValue(key);
	const record = useCallback(
		(score: number) => update((current) => JSON.stringify({ best: Math.max(parseBestScore(current), score) })),
		[update],
	);
	return [parseBestScore(raw), record] as const;
}
