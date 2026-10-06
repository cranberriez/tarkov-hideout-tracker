"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useManualPriceOverrides } from "@/features/profit-pages/useManualPriceOverrides";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import { getEmptySale, getEmptyValue } from "@/lib/price-calculation/empty-value";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";

/** Shared profile sale price for an empty fuel can, edited locally until the user commits a valid value. */
export function EmptyFuelValue({ itemId, item }: { itemId: string; item?: ItemSummary }) {
	const mode = useUserStore((state) => state.gameMode);
	const stationLevels = useUserStore((state) => state.stationLevels);
	const traderLoyaltyLevels = useUserStore((state) => state.questTraderLoyaltyLevels);
	const { hideoutManagementSkillLevel } = useProfitOptions(mode);
	const { overrides, setItemOverride } = useManualPriceOverrides(mode);
	const value = getEmptyValue(itemId, overrides);
	const [draft, setDraft] = useState(value === null ? "" : String(value));
	const [error, setError] = useState(false);
	const inputId = useId();
	const draftAmount = draft.trim() === "" ? null : Number(draft);
	const validAmount = draftAmount !== null && Number.isFinite(draftAmount) && draftAmount >= 0;
	const sale = validAmount
		? getEmptySale(
				item,
				{ [itemId]: { emptyValue: draftAmount } },
				{ stationLevels, traderLoyaltyLevels, hideoutManagementSkillLevel },
			)
		: null;
	const dirty = draft.trim() !== (value === null ? "" : String(value));
	const save = () => {
		const amount = draft.trim() === "" ? undefined : Number(draft);
		if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
			setError(true);
			return;
		}
		setItemOverride(itemId, { ...overrides[itemId], emptyValue: amount });
	};
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			<label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
				Empty sale price (₽)
			</label>
			<div className="mt-1.5 flex items-center gap-2">
				<input
					id={inputId}
					aria-invalid={error}
					aria-describedby={error ? `${inputId}-error` : undefined}
					inputMode="decimal"
					placeholder="Not set"
					value={draft}
					onChange={(event) => {
						setDraft(event.target.value);
						setError(false);
					}}
					className="h-9 min-w-0 flex-1 rounded border border-highlight/20 bg-background px-3 font-mono text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
				/>
				<Button type="submit" size="sm" tone="brand" variant="solid" disabled={!dirty}>
					Save
				</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					disabled={value === null && draft === ""}
					aria-label="Clear empty sale price"
					onClick={() => {
						setItemOverride(itemId, { ...overrides[itemId], emptyValue: undefined });
						setDraft("");
						setError(false);
					}}
				>
					<RotateCcw size={14} aria-hidden />
					Reset
				</Button>
			</div>
			{error && (
				<p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-danger">
					Enter a non-negative amount.
				</p>
			)}
			<p className="mt-1.5 flex justify-between gap-3 text-[11px] text-muted-foreground" aria-live="polite">
				<span>Estimated flea tax</span>
				<span className="font-mono tabular-nums">
					{!validAmount ? "—" : sale?.fee == null ? "Unavailable" : `${sale.fee.toLocaleString()} ₽`}
				</span>
			</p>
		</form>
	);
}
