"use client";

import { LockKeyhole } from "lucide-react";
import type { LockReason } from "@/lib/price-calculation";
import { summarizeLockReasons, type LockChip } from "../utils/lock-summary";
import { useProfitPricingContext } from "./ProfitPricingContext";

/** Lock chips for one ingredient, omitting flea gates the profile banner already covers. */
export function useLockChips(reasons: readonly LockReason[]): LockChip[] {
	const context = useProfitPricingContext();
	return summarizeLockReasons(reasons, context.lockChipNames, { coveredFleaLevel: context.coveredFleaLevel });
}

/**
 * Small lock icon for an ingredient line on desktop. The row's requirements line
 * and its popup carry the full explanation; the title repeats it for this ingredient.
 */
export function LockIndicator({ chips, className = "" }: { chips: readonly LockChip[]; className?: string }) {
	const context = useProfitPricingContext();
	if (!chips.length) return null;
	const summary = chips
		.map((chip) =>
			chip.questId ? `Quest: ${context.taskUnlocksById?.[chip.questId]?.name ?? "details unavailable"}` : chip.label,
		)
		.join(" · ");
	const problem = chips.some((chip) => chip.tone === "problem");
	return (
		<span
			data-isolated-hover="true"
			role="img"
			title={summary}
			aria-label={`Locked: ${summary}`}
			className={`flex shrink-0 items-center ${problem ? "text-danger" : "text-warning"} ${className}`}
		>
			<LockKeyhole className="size-3.5" />
		</span>
	);
}
