"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, LockKeyhole } from "lucide-react";
import { QuestLink } from "@/components/entities/quest-link";
import { FloatingPortal, useFloatingPreview } from "@/components/ui/floating-preview";
import type { RecipeEvaluation } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { Trader } from "@/types/traders";
import type { ProfitStationSource } from "../types";
import { summarizeRecipeRequirements, type LockChip } from "../utils/lock-summary";
import { useProfitPricingContext } from "./ProfitPricingContext";
import { useCompactCards } from "./useCompactCards";

/**
 * One truncated line under the recipe output: source, then every requirement.
 * Hover, focus or click opens a list of all requirements; the list stays open
 * while the pointer is inside so quest links remain clickable. Compact cards
 * instead end the line with a Requirements link that expands the list inline.
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
	const compact = useCompactCards();
	const [inlineOpen, setInlineOpen] = useState(false);
	const preview = useFloatingPreview({
		placement: "bottom-start",
		openDelay: 250,
		closeDelay: 200,
		disabled: !locked || compact,
	});
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
					<span
						key={chip.key}
						className={`max-lg:hidden ${chip.tone === "problem" ? "text-danger" : "text-muted-foreground"}`}
					>
						<span className="text-muted-foreground/60"> · </span>
						{chipText(chip)}
					</span>
				))}
			</span>
		</>
	);
	// Fixed height below lg keeps compact cards at their estimated height.
	const lineClass = "flex w-full min-w-0 items-center gap-1.5 text-left text-[11px] leading-5 max-lg:h-9";
	const groups = requirements.groups.map((group) => (
		<div key={group.key} className="mt-2.5 first:mt-0">
			<p className="truncate font-medium text-foreground">{group.title}</p>
			<LockChipList chips={group.chips} className="mt-1" />
		</div>
	));
	if (!locked) return <span className={lineClass}>{summary}</span>;
	if (compact)
		return (
			<>
				<span className={lineClass}>
					{summary}
					<button
						type="button"
						aria-expanded={inlineOpen}
						onClick={() => setInlineOpen((value) => !value)}
						className="ml-auto flex h-full shrink-0 items-center gap-0.5 pl-2 font-medium text-foreground/90 underline decoration-foreground/40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand"
					>
						Requirements
						<ChevronDown aria-hidden className={`size-3.5 transition-transform ${inlineOpen ? "rotate-180" : ""}`} />
					</button>
				</span>
				{inlineOpen && (
					<div aria-label="Requirements" className="mb-1 rounded-sm bg-shadow/20 px-2.5 py-2 text-[11px]">
						{groups}
					</div>
				)}
			</>
		);
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
					{groups}
				</div>
			</FloatingPortal>
		</>
	);
}

/** Requirement chips as a list, with quest chips linking to the quest. */
export function LockChipList({ chips, className = "" }: { chips: readonly LockChip[]; className?: string }) {
	const context = useProfitPricingContext();
	return (
		<ul className={`space-y-1 ${className}`}>
			{chips.map((chip) => (
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
								name={context.taskUnlocksById?.[chip.questId]?.name || "Quest details unavailable"}
							/>
						</span>
					) : (
						<span>
							<span className={chip.tone === "problem" ? "text-danger" : "text-foreground/90"}>{chip.label}</span>
							{chip.detail && <span> · {chip.detail}</span>}
						</span>
					)}
				</li>
			))}
		</ul>
	);
}
