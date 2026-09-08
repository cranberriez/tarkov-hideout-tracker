"use client";
import { useMemo } from "react";
import type { GameMode } from "@/lib/game-mode";
import type { ManualPriceOverride, ManualPriceOverrides } from "@/lib/price-calculation";
import { useStoredProfitValue } from "./useStoredProfitValue";
export function parsePriceOverrides(raw: string | null): ManualPriceOverrides {
	try {
		const parsed: unknown = JSON.parse(raw ?? "{}");
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed).filter(([, value]) => {
				if (!value || typeof value !== "object" || Array.isArray(value)) return false;
				const entry = value as ManualPriceOverride;
				return (
					[entry.buy, entry.sell].every((price) => price === undefined || (typeof price === "number" && Number.isFinite(price) && price >= 0)) &&
					(entry.sellSource === undefined || entry.sellSource === "flea" || entry.sellSource === "trader")
				);
			}),
		);
	} catch {
		return {};
	}
}
export function useManualPriceOverrides(gameMode: GameMode) {
	const [raw, update] = useStoredProfitValue(`tarkov-profit-price-overrides-v1:${gameMode}`);
	const overrides = useMemo(() => parsePriceOverrides(raw), [raw]);
	function setItemOverride(itemId: string, override: ManualPriceOverride) {
		update((current) => {
			const next = parsePriceOverrides(current);
			if (override.buy === undefined && override.sell === undefined) delete next[itemId];
			else next[itemId] = override;
			return JSON.stringify(next);
		});
	}
	return { overrides, setItemOverride };
}
