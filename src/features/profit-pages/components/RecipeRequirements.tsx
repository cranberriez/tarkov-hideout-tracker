"use client";

import { useEffect, useId, useMemo } from "react";
import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { QuestLink } from "@/components/entities/quest-link";
import { FloatingPortal, useFloatingPreview } from "@/components/ui/floating-preview";
import type { RecipeEvaluation } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { Trader } from "@/types/traders";
import type { ProfitStationSource } from "../types";
import { summarizeRecipeRequirements, type LockChip } from "../utils/lock-summary";
import { useProfitPricingContext } from "./ProfitPricingContext";

/**
 * One truncated line under the recipe output: source, then every requirement.
 * Hover, focus or click opens a list of all requirements; the list stays open
 * while the pointer is inside so quest links remain clickable.
 */
export function RecipeRequirements({
	evaluation,
	source,
	itemById,
}: {
	evaluation: RecipeEvaluation;
	source?: Trader | ProfitStationSource;
	itemById: Readonly<Record<string, ItemSummary>>;
}) {
	const context = useProfitPricingContext();
	const popupId = useId();
	const requirements = useMemo(
		() =>
			summarizeRecipeRequirements(evaluation, {
				names: context.lockChipNames,
				options: { coveredFleaLevel: context.coveredFleaLevel },
				itemName: (itemId) => itemById[itemId]?.shortName ?? itemById[itemId]?.name ?? itemId,
			}),
		[context.coveredFleaLevel, context.lockChipNames, evaluation, itemById],
	);
	const locked = requirements.groups.length > 0;
	const preview = useFloatingPreview({ placement: "bottom-start", openDelay: 250, closeDelay: 200, disabled: !locked });
	const { open, hide } = preview;
	// Click-opened popups (touch, or a deliberate click) close on an outside press.
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (!(event.target as Element | null)?.closest(`[data-requirements="${popupId}"]`)) hide(0);
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [hide, open, popupId]);

	const questName = (questId: string) => context.taskUnlocksById?.[questId]?.name || "Quest details unavailable";
	const chipText = (chip: LockChip) => (chip.questId ? questName(chip.questId) : chip.label);
	const sourceLabel = evaluation.barter
		? `${source?.name ?? "Unknown trader"} LL${evaluation.barter.minTraderLevel}`
		: `${source?.name ?? "Unknown station"} ${evaluation.craft?.level ?? ""}`.trim();
	const summary = (
		<>
			{locked && (
				<LockKeyhole
					aria-hidden
					className={`size-3 shrink-0 ${requirements.hasProblem ? "text-danger" : "text-warning"}`}
				/>
			)}
			{source?.imageLink && (
				<Image
					src={source.imageLink}
					alt=""
					width={16}
					height={16}
					className="size-4 shrink-0 rounded-sm object-contain"
					unoptimized
				/>
			)}
			<span className="min-w-0 truncate">
				<span className="font-medium text-foreground/90">{sourceLabel}</span>
				{requirements.line.map((chip) => (
					<span key={chip.key} className={chip.tone === "problem" ? "text-danger" : "text-muted-foreground"}>
						<span className="text-muted-foreground/60"> · </span>
						{chipText(chip)}
					</span>
				))}
			</span>
		</>
	);
	const lineClass = "flex w-full min-w-0 items-center gap-1.5 text-left text-[11px] leading-5";
	if (!locked) return <span className={lineClass}>{summary}</span>;
	return (
		<>
			<button
				type="button"
				data-requirements={popupId}
				aria-haspopup="dialog"
				aria-expanded={open}
				{...preview.triggerProps}
				onPointerDown={undefined}
				onClick={() => (open ? hide(0) : preview.show(0))}
				className={`${lineClass} rounded-sm hover:bg-highlight/[0.05] focus-visible:outline-2 focus-visible:outline-brand`}
			>
				{summary}
			</button>
			<FloatingPortal
				open={open}
				floatingProps={preview.floatingProps}
				role="group"
				className="w-72 rounded-md border border-highlight/15 bg-[var(--background)] text-xs shadow-[0_18px_55px_color-mix(in_oklab,_var(--shadow)_80%,_transparent)]"
			>
				<div data-requirements={popupId} aria-label="Requirements" className="p-3">
					<p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Requirements</p>
					{requirements.groups.map((group) => (
						<div key={group.key} className="mt-2.5 first:mt-0">
							<p className="truncate font-medium text-foreground">{group.title}</p>
							<ul className="mt-1 space-y-1">
								{group.chips.map((chip) => (
									<li key={chip.key} className="flex items-start gap-1.5 text-muted-foreground">
										<LockKeyhole
											aria-hidden
											className={`mt-0.5 size-3 shrink-0 ${chip.tone === "problem" ? "text-danger" : "text-warning"}`}
										/>
										{chip.questId ? (
											<span>
												Complete{" "}
												<QuestLink
													className="text-foreground underline decoration-dotted hover:text-brand"
													questId={chip.questId}
													name={questName(chip.questId)}
												/>
											</span>
										) : (
											<span>
												<span className={chip.tone === "problem" ? "text-danger" : "text-foreground/90"}>
													{chip.label}
												</span>
												{chip.detail && <span> · {chip.detail}</span>}
											</span>
										)}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</FloatingPortal>
		</>
	);
}
