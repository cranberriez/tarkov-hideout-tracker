"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ItemImage } from "@/components/entities/item-image";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useManualPriceOverrides } from "@/features/profit-pages/useManualPriceOverrides";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import { getEmptySale, getEmptyValue } from "@/lib/price-calculation/empty-value";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";
import { formatRoubles } from "./power-format";

/** Shared profile price, edited locally until the user commits a valid value. */
export function EmptyFuelValue({ itemId, name, item }: { itemId: string; name: string; item?: ItemSummary }) {
	const mode = useUserStore((state) => state.gameMode);
	const stationLevels = useUserStore((state) => state.stationLevels);
	const traderLoyaltyLevels = useUserStore((state) => state.questTraderLoyaltyLevels);
	const { hideoutManagementSkillLevel } = useProfitOptions(mode);
	const { overrides, setItemOverride } = useManualPriceOverrides(mode);
	const value = getEmptyValue(itemId, overrides);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
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
	const save = () => {
		const amount = draft.trim() === "" ? undefined : Number(draft);
		if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
			setError(true);
			return;
		}
		setItemOverride(itemId, { ...overrides[itemId], emptyValue: amount });
		setEditing(false);
	};
	return (
		<Dialog
			open={editing}
			onOpenChange={(open) => {
				if (open) {
					setDraft(value === null ? "" : String(value));
					setError(false);
				}
				setEditing(open);
			}}
		>
			<DialogTrigger asChild>
				<Button
					size="xs"
					tone={value === null ? "neutral" : "info"}
					className="h-5 border-0 px-1.5 text-[9px] tracking-wide"
					aria-label={`Edit ${name} empty sell value`}
					title={`Empty sell value: ${value === null ? "Not set" : formatRoubles(value)}`}
				>
					EDIT
				</Button>
			</DialogTrigger>
			<DialogContent className="p-5 sm:max-w-sm">
				<DialogHeader className="text-left">
					<DialogTitle>Edit sell value</DialogTitle>
					<DialogDescription>What is this fuel can worth when empty?</DialogDescription>
				</DialogHeader>
				<div className="mt-5 flex items-center gap-3">
					<ItemImage item={item ?? { name }} size={48} framed />
					<p className="text-sm font-medium text-foreground">{name}</p>
				</div>
				<form
					className="mt-5"
					onSubmit={(event) => {
						event.preventDefault();
						save();
					}}
				>
					<label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
						Empty sell value (₽)
					</label>
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
						className="mt-1.5 h-11 w-full rounded border border-highlight/20 bg-background px-3 font-mono text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
					/>
					{error && (
						<p id={`${inputId}-error`} role="alert" className="mt-2 text-xs text-danger">
							Enter a non-negative amount.
						</p>
					)}
					<div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground" aria-live="polite">
						<span>Estimated flea tax</span>
						<span className="font-mono tabular-nums">
							{!validAmount ? "—" : sale?.fee == null ? "Unavailable" : `${sale.fee.toLocaleString()} ₽`}
						</span>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">Shared with crafts and barters.</p>
					<div className="mt-5 flex items-center justify-between gap-2">
						<Button
							variant="ghost"
							onClick={() => {
								setItemOverride(itemId, { ...overrides[itemId], emptyValue: undefined });
								setEditing(false);
							}}
						>
							<RotateCcw size={14} aria-hidden />
							Reset
						</Button>
						<Button type="submit" tone="brand" variant="solid">
							Save
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
