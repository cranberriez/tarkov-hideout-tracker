"use client";

import { useState } from "react";
import { Check, PackagePlus } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import type { SummaryRow } from "./summary-model";
import { planUploaderInventory, type SentCounts } from "./inventory-model";
import { sectionLabel } from "./UploaderSidebarHeader";

export function UploaderInventoryActions({
	rows,
	sent,
	onSent,
	disabled,
}: {
	rows: readonly SummaryRow[];
	sent: SentCounts;
	onSent: (deltas: { itemId: string; have: number; haveFir: number }[]) => void;
	disabled: boolean;
}) {
	const mode = useUserStore((state) => state.gameMode);
	const [message, setMessage] = useState("");
	const kept = planUploaderInventory(rows, sent, true);
	const all = planUploaderInventory(rows, sent, false);
	const apply = (keptOnly: boolean) => {
		const store = useUserStore.getState();
		if (disabled || store.gameMode !== mode) return;
		const plan = planUploaderInventory(rows, sent, keptOnly);
		if (plan.unknown || !plan.deltas.length) return;
		try {
			for (const delta of plan.deltas) store.addItemCounts(delta.itemId, delta.have, delta.haveFir);
			onSent(plan.deltas);
			setMessage(`Added ${plan.units} ${plan.units === 1 ? "copy" : "copies"} to your inventory.`);
		} catch {
			setMessage("Inventory could not be fully saved. Check your inventory before retrying.");
		}
	};
	const button = (label: string, plan: typeof kept, keptOnly: boolean, primary: boolean) => {
		const done = !plan.unknown && plan.units === 0 && Object.keys(sent).length > 0;
		return (
			<button
				disabled={disabled || plan.unknown > 0 || plan.units === 0}
				onClick={() => apply(keptOnly)}
				className={cn(
					"flex items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40",
					primary
						? "border-brand bg-brand text-inverse hover:bg-brand-hover"
						: "border-highlight/10 bg-shadow/20 text-foreground hover:border-highlight/30",
				)}
			>
				{done ? <Check size={13} aria-hidden="true" /> : <PackagePlus size={13} aria-hidden="true" />}
				{label}
				{plan.units > 0 && <span className="tabular-nums opacity-80">{plan.units}</span>}
			</button>
		);
	};
	return (
		<section className="space-y-2" aria-label="Add items to inventory">
			<h2 className={sectionLabel}>Add to inventory</h2>
			<div className="grid grid-cols-2 gap-2">
				{button("Kept only", kept, true, true)}
				{button("Everything", all, false, false)}
			</div>
			{all.unknown > 0 ? (
				<p className="text-[11px] text-warning">Confirm FIR for {all.unknown} copies in review before adding them.</p>
			) : (
				<p className="text-[11px] text-subtle-foreground">Adds this scan on top of your saved counts, once.</p>
			)}
			{message && (
				<p role="status" className="text-[11px] text-foreground">
					{message}
				</p>
			)}
		</section>
	);
}
