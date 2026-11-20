"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { builderTotals } from "./modifiers/builder";
import { formatPoints } from "./modifiers/types";
import { useModifierBuilder, type BuilderModifier } from "./ModifierBuilder";

const TONE = {
	positive: { picked: "bg-success/18", chip: "bg-modifier-picked-positive text-modifier-picked-foreground" },
	negative: { picked: "bg-danger/18", chip: "bg-modifier-picked-negative text-modifier-picked-foreground" },
} as const;

function Tile({ modifier, picked }: { modifier: BuilderModifier; picked: boolean }) {
	return (
		<li
			className={cn(
				"flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5",
				picked ? TONE[modifier.kind].picked : "opacity-40",
			)}
		>
			{modifier.icon ? (
				<Image src={modifier.icon} alt="" width={24} height={24} unoptimized className="size-6 shrink-0" />
			) : (
				<span aria-hidden className="size-6 shrink-0" />
			)}
			<span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold uppercase leading-tight tracking-wide">
				{modifier.name}
			</span>
			{picked && (
				<span className={cn("shrink-0 rounded-full px-1.5 text-xs font-bold tabular-nums", TONE[modifier.kind].chip)}>
					{formatPoints(modifier.points)}
				</span>
			)}
		</li>
	);
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
	return (
		<div className="flex flex-col items-end leading-tight">
			<span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/85">{label}</span>
			<span className={cn("text-lg font-bold tabular-nums", className)}>{value}</span>
		</div>
	);
}

/** Opens a compact, screenshot-friendly sheet of the current build. */
export function BuildScreenshotButton() {
	const builder = useModifierBuilder();
	const [name, setName] = useState("");
	if (!builder) return null;
	const { modifiers, selection, seasonLabel } = builder;
	const totals = builderTotals(
		selection.selected,
		Object.fromEntries(modifiers.map((modifier) => [modifier.id, modifier.points])),
	);
	return (
		<Dialog>
			<DialogTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold transition-colors hover:bg-surface-raised/70"
				>
					<Camera aria-hidden className="size-3.5" />
					Screenshot
				</button>
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-y-auto p-5 sm:max-w-5xl">
				<DialogDescription className="sr-only">
					A compact view of your selected modifiers, sized for a screenshot.
				</DialogDescription>
				<div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3 pr-8">
					<div className="min-w-0">
						<DialogTitle className="text-xs font-semibold uppercase tracking-widest text-foreground/85">
							{seasonLabel}
						</DialogTitle>
						{/* Reads as a heading until clicked; empty shows the placeholder name "PMC". */}
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="PMC"
							aria-label="Name shown on the screenshot"
							maxLength={32}
							className="mt-1 w-full max-w-sm rounded-md border border-transparent bg-transparent px-1 -mx-1 text-2xl font-bold placeholder:text-foreground focus:border-border focus:outline-none"
						/>
					</div>
					<div className="flex gap-5">
						<Stat label="Granted" value={`+${totals.granted}`} />
						<Stat label="Spent" value={`−${totals.spent}`} />
						<Stat
							label="Net"
							value={totals.balance === 0 ? "0" : formatPoints(totals.balance)}
							className={totals.valid ? "text-success" : "text-danger"}
						/>
					</div>
				</div>
				{(["positive", "negative"] as const).map((kind) => (
					<section key={kind} className="mt-3 space-y-1.5">
						<h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/85">
							{kind === "positive" ? "Positive" : "Negative"}
						</h3>
						<ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
							{modifiers
								.filter((modifier) => modifier.kind === kind)
								.map((modifier) => (
									<Tile key={modifier.id} modifier={modifier} picked={selection.selected.has(modifier.id)} />
								))}
						</ul>
					</section>
				))}
			</DialogContent>
		</Dialog>
	);
}
