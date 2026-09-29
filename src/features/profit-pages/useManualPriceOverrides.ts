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
			Object.entries(parsed)
				.filter(([, value]) => {
					if (!value || typeof value !== "object" || Array.isArray(value)) return false;
					const entry = value as ManualPriceOverride;
					return (
						[entry.buy, entry.sell].every(
							(price) => price === undefined || (typeof price === "number" && Number.isFinite(price) && price >= 0),
						) &&
						(entry.sellSource === undefined || entry.sellSource === "flea" || entry.sellSource === "trader")
					);
				})
				.map(([id, value]) => {
					const entry = { ...(value as ManualPriceOverride) };
					if (typeof entry.emptyValue !== "number" || !Number.isFinite(entry.emptyValue) || entry.emptyValue < 0)
						delete entry.emptyValue;
					return [id, entry];
				}),
		);
	} catch {
		return {};
	}
}
export function useManualPriceOverrides(gameMode: GameMode) {
	const [raw, update] = useStoredProfitValue(priceOverridesKey(gameMode));
	const overrides = useMemo(() => parsePriceOverrides(raw), [raw]);
	function setItemOverride(itemId: string, override: ManualPriceOverride) {
		update((current) => updatePriceOverride(current, itemId, override));
	}
	return { overrides, setItemOverride };
}

export function priceOverridesKey(gameMode: GameMode) {
	return `tarkov-profit-price-overrides-v1:${gameMode}`;
}

export function updatePriceOverride(raw: string | null, itemId: string, override: ManualPriceOverride) {
	const next = parsePriceOverrides(raw);
	const merged = mergePriceOverride(next[itemId], override);
	if (!merged) delete next[itemId];
	else next[itemId] = merged;
	return JSON.stringify(next);
}

/** Existing buy/sell editors must never accidentally remove a saved empty value. */
export function mergePriceOverride(current: ManualPriceOverride | undefined, override: ManualPriceOverride) {
	const merged = {
		...override,
		emptyValue: Object.hasOwn(override, "emptyValue") ? override.emptyValue : current?.emptyValue,
	};
	return merged.buy === undefined && merged.sell === undefined && merged.emptyValue === undefined ? undefined : merged;
}
