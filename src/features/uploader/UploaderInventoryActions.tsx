"use client";

import { useState } from "react";
import { Check, PackagePlus } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useKappaStore } from "@/lib/stores/useKappaStore";
import { cn } from "@/lib/utils";
import type { SummaryRow } from "./summary-model";
import { planUploaderInventory, type SentCounts } from "./inventory-model";
import { sectionLabel } from "./UploaderSidebarHeader";

export function UploaderInventoryActions({
	rows,
	sent,
	kappaSent,
	onSent,
	onSetFir,
	disabled,
}: {
	rows: readonly SummaryRow[];
	sent: SentCounts;
	kappaSent: readonly string[];
	/** Inventory deltas and items checked off on the Kappa checklist. */
	onSent: (deltas: { itemId: string; have: number; haveFir: number }[], kappa: string[]) => void;
	onSetFir: () => void;
	disabled: boolean;
}) {
	const mode = useUserStore((state) => state.gameMode);
	const [message, setMessage] = useState("");
	const kept = planUploaderInventory(rows, sent, true, kappaSent);
	const all = planUploaderInventory(rows, sent, false, kappaSent);
	const apply = (keptOnly: boolean) => {
		const store = useUserStore.getState();
		if (disabled || store.gameMode !== mode) return;
		const plan = planUploaderInventory(rows, sent, keptOnly, kappaSent);
		if (plan.unknown || (!plan.deltas.length && !plan.kappa.length)) return;
		try {
			for (const delta of plan.deltas) store.addItemCounts(delta.itemId, delta.have, delta.haveFir);
			if (plan.kappa.length) useKappaStore.getState().completeItems(mode, plan.kappa);
			onSent(plan.deltas, plan.kappa);
			setMessage(
				[
					plan.units && `Added ${plan.units} ${plan.units === 1 ? "copy" : "copies"} to your inventory.`,
					plan.kappa.length &&
						`Checked off ${plan.kappa.length} ${plan.kappa.length === 1 ? "item" : "items"} on the Kappa checklist.`,
				]
					.filter(Boolean)
					.join(" "),
			);
		} catch {
			setMessage("Inventory could not be fully saved. Check your inventory before retrying.");
		}
	};
	const button = (label: string, plan: typeof kept, keptOnly: boolean, primary: boolean) => {
		const total = plan.units + plan.kappa.length;
		const done = !plan.unknown && total === 0 && (Object.keys(sent).length > 0 || kappaSent.length > 0);
		return (
			<button
				disabled={disabled || plan.unknown > 0 || total === 0}
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
				{total > 0 && <span className="tabular-nums opacity-80">{total}</span>}
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
				<div className="flex items-center justify-between gap-2 rounded-sm bg-fir/10 px-2 py-1.5">
					<p className="text-[11px] text-fir">
						{all.unknown} {all.unknown === 1 ? "copy needs" : "copies need"} a found-in-raid choice first.
					</p>
					<button onClick={onSetFir} className="shrink-0 text-[11px] font-semibold text-fir underline">
						Set FIR
					</button>
				</div>
			) : null}
			{message && (
				<p role="status" className="text-[11px] text-foreground">
					{message}
				</p>
			)}
		</section>
	);
}
