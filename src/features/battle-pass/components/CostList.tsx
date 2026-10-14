"use client";
import { useBattlePassData } from "../BattlePassSeason";
import { Check } from "lucide-react";
import { swappedKey, type Costs } from "../lib/battle-pass-model";
import { DocumentChip } from "./ui/DocumentChip";
import { cn } from "@/lib/utils";
import styles from "../battle-pass.module.css";

export function CostList({
	costs,
	inventory,
	wide = false,
	previewEnabled = false,
	tileId,
	onSwap,
	swapLocked = false,
}: {
	costs: Costs;
	inventory: Costs;
	wide?: boolean;
	previewEnabled?: boolean;
	/** Set when `costs` is this reward's own cost, so swapped lines can be marked. */
	tileId?: string;
	/** Edit mode: swap the baseline line behind a chip to another document type. */
	onSwap?: (baseline: string, to: string) => void;
	/** Completed rewards already consumed their documents. */
	swapLocked?: boolean;
}) {
	const { documents, documentKeys, baselineCosts, costSwaps } = useBattlePassData();
	const shown = documents.filter((doc) => (costs[doc.key] ?? 0) > 0);
	// Current document type -> the snapshot line it replaces.
	const baselineOf = new Map(
		tileId
			? Object.keys(baselineCosts[tileId] ?? {}).map((key) => [swappedKey(key, costSwaps[tileId], documentKeys), key])
			: [],
	);
	const options = documents.filter((doc) => !(costs[doc.key] > 0));
	return (
		<div
			className={cn(
				styles.costGrid,
				"content-start",
				wide ? "grid-cols-6" : shown.length > 4 ? "grid-cols-3" : "grid-cols-4",
			)}
		>
			{shown.map((doc, i) => {
				const baseline = baselineOf.get(doc.key) ?? doc.key;
				return (
					<DocumentChip
						key={doc.key}
						doc={doc}
						original={baseline !== doc.key ? documents.find((entry) => entry.key === baseline)?.name : undefined}
						swap={onSwap && { options, baseline, locked: swapLocked, onSelect: (to) => onSwap(baseline, to) }}
						amount={costs[doc.key]}
						fulfilled={(inventory[doc.key] ?? 0) >= costs[doc.key]}
						partial={previewEnabled && (inventory[doc.key] ?? 0) > 0 && (inventory[doc.key] ?? 0) < costs[doc.key]}
						end={i >= Math.ceil(shown.length / 2)}
					/>
				);
			})}
			{shown.length === 0 && (
				<span className="flex items-center gap-1 text-xs text-success">
					<Check size={15} />
					Complete
				</span>
			)}
		</div>
	);
}
