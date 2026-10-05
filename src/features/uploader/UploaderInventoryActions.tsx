"use client";

import { useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { SummaryRow } from "./summary-model";
import { planUploaderInventory } from "./inventory-model";

export function UploaderInventoryActions({ rows, disabled }: { rows: readonly SummaryRow[]; disabled: boolean }) {
	const counts = useUserStore((state) => state.itemCounts);
	const mode = useUserStore((state) => state.gameMode);
	const [message, setMessage] = useState("");
	const required = planUploaderInventory(rows, counts, true);
	const all = planUploaderInventory(rows, counts, false);
	const apply = (requiredOnly: boolean) => {
		const store = useUserStore.getState();
		if (disabled || store.gameMode !== mode) return;
		const plan = planUploaderInventory(rows, store.itemCounts, requiredOnly);
		if (plan.unknown || !plan.deltas.length) return;
		try {
			for (const delta of plan.deltas) store.addItemCounts(delta.itemId, delta.have, delta.haveFir);
			setMessage(`Inventory updated for ${plan.deltas.length} items. Saved counts were only increased.`);
		} catch {
			setMessage("Inventory could not be fully saved. Check your inventory before retrying.");
		}
	};
	return (
		<section className="mt-4 space-y-2 border-t border-border-color pt-3" aria-label="Send items to inventory">
			<h3 className="text-xs font-semibold text-foreground">Send to inventory</h3>
			<div className="grid grid-cols-2 gap-2">
				<button
					aria-label="Send required items to inventory"
					disabled={disabled || required.unknown > 0 || required.units === 0}
					onClick={() => apply(true)}
					className="w-full rounded border border-brand bg-brand px-3 py-2 text-xs font-semibold text-inverse disabled:opacity-40"
				>
					Required items
				</button>
				<button
					aria-label="Send all items to inventory"
					disabled={disabled || all.unknown > 0 || all.units === 0}
					onClick={() => apply(false)}
					className="w-full rounded border border-border-color px-3 py-2 text-xs text-foreground disabled:opacity-40"
				>
					All items
				</button>
			</div>
			<p className="text-[11px] text-muted-foreground">
				Raises saved counts to match the scan; no duplicate additions.
			</p>
			{all.unknown > 0 && (
				<p className="text-xs text-warning">
					Confirm FIR status for {all.unknown} units in review before sending all items.
				</p>
			)}
			{message && (
				<p role="status" className="text-xs text-foreground">
					{message}
				</p>
			)}
		</section>
	);
}
