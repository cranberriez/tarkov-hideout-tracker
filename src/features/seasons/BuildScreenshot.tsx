"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Camera, Link2, XIcon } from "lucide-react";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { MODIFIER_CARD_TINT } from "./modifier-tones";
import { builderTotals } from "./modifiers/builder";
import { formatPoints } from "./modifiers/types";
import { useModifierBuilder, type BuilderModifier } from "./ModifierBuilder";

const CHIP = {
	positive: "bg-modifier-picked-positive text-modifier-picked-foreground",
	negative: "bg-modifier-picked-negative text-modifier-picked-foreground",
} as const;

/** Mirrors the season page's modifier card: icon, name, points chip and effects, on the same tint. */
function Card({ modifier, compact }: { modifier: BuilderModifier; compact: boolean }) {
	const icon = compact ? 32 : 48;
	return (
		<li className={cn("flex min-w-0 gap-3 rounded-lg p-3", MODIFIER_CARD_TINT[modifier.kind])}>
			{modifier.icon ? (
				<Image
					src={modifier.icon}
					alt=""
					width={icon}
					height={icon}
					unoptimized
					className="shrink-0 opacity-90"
					style={{ width: icon, height: icon }}
				/>
			) : (
				<span aria-hidden className="shrink-0" style={{ width: icon, height: icon }} />
			)}
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex items-start gap-2">
					<h4 className="min-w-0 flex-1 pt-0.5 text-sm font-semibold uppercase tracking-wide">{modifier.name}</h4>
					<span
						className={cn(
							"shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums",
							CHIP[modifier.kind],
						)}
					>
						{formatPoints(modifier.points)}
					</span>
				</div>
				<ul className="list-disc space-y-0.5 pl-4 text-sm leading-5 text-foreground/85">
					{modifier.effects.map((effect) => (
						<li key={effect}>{effect}</li>
					))}
				</ul>
			</div>
		</li>
	);
}

/** Season title styling for the sheet, matching each season's key art. */
const SEASON_THEMES: Record<
	string,
	{ chipLabel: string; chip: string; first: string; second: string; accent: string }
> = {
	"season-1": {
		chipLabel: "Season 1",
		chip: "bg-kord text-kord-surface",
		first: "Kord",
		second: "Breach",
		accent: "text-kord",
	},
	"season-2": {
		chipLabel: "Season 2",
		chip: "bg-untar text-untar-surface",
		first: "Untar",
		second: "Control",
		accent: "text-untar",
	},
};

/** Printed on the sheet so screenshots point back to the site. */
const SITE_HOST = new URL(SITE_URL).host;

/**
 * Fixed design layouts for the sheet. The sheet always renders at one of these widths and is then
 * scaled as a whole to fit the screen, so it never scrolls and looks the same in every screenshot.
 */
const LAYOUTS = {
	wide: { width: 960, title: "text-3xl", compact: false },
	medium: { width: 720, title: "text-2xl", compact: false },
	// Phones are height-bound, so a wider design costs no extra shrink but gives names room.
	narrow: { width: 500, title: "text-xl", compact: true },
} as const;

/** Room kept around the sheet: side gutters, plus the floating close button above it. */
const STAGE_GUTTER_X = 32;
/** Matches the stage padding: pt-14 (room for the floating close button) + pb-4. */
const STAGE_GUTTER_Y = 72;

const subscribeToViewport = (listener: () => void) => {
	window.addEventListener("resize", listener);
	return () => window.removeEventListener("resize", listener);
};
const readViewport = () => `${window.innerWidth}x${window.innerHeight}`;

function useViewport() {
	const [width, height] = useSyncExternalStore(subscribeToViewport, readViewport, () => "1280x800")
		.split("x")
		.map(Number);
	return { width, height };
}

/** Opens a compact, screenshot-friendly sheet of the current build. */
export function BuildScreenshotButton() {
	const builder = useModifierBuilder();
	const [open, setOpen] = useState(false);
	const viewport = useViewport();
	const [sheetHeight, setSheetHeight] = useState(0);
	const observer = useRef<ResizeObserver | null>(null);
	// Measures the unscaled sheet (transforms don't affect offsetHeight) whenever it mounts or reflows.
	const measureSheet = useCallback((node: HTMLDivElement | null) => {
		observer.current?.disconnect();
		if (!node) return;
		setSheetHeight(node.offsetHeight);
		observer.current = new ResizeObserver(() => setSheetHeight(node.offsetHeight));
		observer.current.observe(node);
	}, []);
	if (!builder) return null;
	const { modifiers, selection, seasonId } = builder;
	const theme = SEASON_THEMES[seasonId] ?? SEASON_THEMES["season-2"];
	const totals = builderTotals(
		selection.selected,
		Object.fromEntries(modifiers.map((modifier) => [modifier.id, modifier.points])),
	);
	const sections = (["positive", "negative"] as const)
		.map((kind) => ({
			kind,
			picks: modifiers.filter((modifier) => modifier.kind === kind && selection.selected.has(modifier.id)),
			total: kind === "positive" ? `−${totals.spent}` : `+${totals.granted}`,
		}))
		.filter((section) => section.picks.length > 0);
	const layout = viewport.width >= 1024 ? LAYOUTS.wide : viewport.width >= 640 ? LAYOUTS.medium : LAYOUTS.narrow;
	const scale = Math.min(
		1,
		(viewport.width - STAGE_GUTTER_X) / layout.width,
		sheetHeight ? (viewport.height - STAGE_GUTTER_Y) / sheetHeight : 1,
	);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-md bg-surface-raised px-3 py-1 text-xs font-semibold transition-colors hover:bg-surface-raised/70"
				>
					<Camera aria-hidden className="size-3.5" />
					Screenshot
				</button>
			</DialogTrigger>
			{/* The content box is a transparent full-screen stage; clicking its empty area closes it. */}
			<DialogContent
				showCloseButton={false}
				onClick={(event) => {
					if (event.target === event.currentTarget) setOpen(false);
				}}
				className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 bg-transparent px-4 pb-4 pt-14 shadow-none"
			>
				<div className="relative" style={{ width: layout.width * scale, height: sheetHeight * scale }}>
					<DialogClose
						aria-label="Close"
						className="absolute bottom-full right-0 mb-3 flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-lg transition-colors hover:bg-surface-raised"
					>
						<XIcon aria-hidden className="size-4" />
					</DialogClose>
					<div
						ref={measureSheet}
						className="origin-top-left rounded-lg border border-border bg-card p-5 shadow-2xl"
						style={{ width: layout.width, transform: `scale(${scale})` }}
					>
						<DialogDescription className="sr-only">
							A compact view of your selected modifiers, sized for a screenshot.
						</DialogDescription>
						<div
							className={cn(
								"flex justify-between gap-x-6 gap-y-2",
								layout.compact ? "flex-col" : "items-start",
							)}
						>
							<DialogTitle
								className={cn(
									"flex min-w-0 items-center gap-3 font-black uppercase leading-none tracking-wide",
									layout.title,
								)}
							>
								<span className={cn("rounded-sm px-2 py-1 text-sm font-bold tracking-widest", theme.chip)}>
									{theme.chipLabel}
								</span>
								<span>
									{theme.first} <span className={theme.accent}>{theme.second}</span>
								</span>
							</DialogTitle>
							<p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/85">
								<Link2 aria-hidden className="size-3.5" />
								{SITE_HOST}/{seasonId}
							</p>
						</div>
						{sections.length === 0 ? (
							<p className="mt-3 text-xs text-foreground/85">No picks</p>
						) : (
							// Picks only: positives and negatives side by side; a lone side takes the full width.
							<div className={cn("mt-3 grid gap-4", sections.length === 2 && "grid-cols-2")}>
								{sections.map(({ kind, picks, total }) => (
									<section key={kind} className="min-w-0 space-y-1.5">
										<h3 className="flex items-baseline gap-2 text-xs font-bold uppercase tracking-[0.2em] text-foreground/85">
											{kind === "positive" ? "Positive" : "Negative"}
											<span
												className={cn(
													"text-sm tracking-normal tabular-nums",
													kind === "positive" ? "text-success" : "text-danger",
												)}
											>
												{total}
											</span>
										</h3>
										<ul className={cn("grid gap-2", sections.length === 1 && "grid-cols-2")}>
											{picks.map((modifier) => (
												<Card key={modifier.id} modifier={modifier} compact={layout.compact} />
											))}
										</ul>
									</section>
								))}
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
