"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { itemImageUrl } from "@/lib/utils/item-images";
import type { HigherLowerItem } from "@/types/contracts";
import { countUpValue, type HigherLowerGuess } from "./higher-lower-model";
import { CLOSE_MS, REVEAL_MS, SLIDE_MS, useHigherLowerGame, type HigherLowerRound } from "./useHigherLowerGame";

const INTRO_SPLIT_MS = 700;
const REVEALED_PHASES = new Set<HigherLowerRound["phase"]>(["reveal", "result", "slide", "over", "closing"]);

const rouble = new Intl.NumberFormat("en-US");

function formatValue(value: number) {
	return `${rouble.format(value)} ₽`;
}

const SOURCE_LABELS: Record<HigherLowerItem["source"], { label: string; className: string }> = {
	flea: { label: "7-day flea median", className: "text-acquisition-flea" },
	trader: { label: "Trader price", className: "text-acquisition-trader" },
	parts: { label: "Estimated from parts", className: "text-acquisition-craft" },
};

/** Counts from zero to the value over the reveal, in few-percent steps that slow near the end. */
function CountUp({ value }: { value: number }) {
	const [shown, setShown] = useState(() => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? value : 0));
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const duration = REVEAL_MS - 150;
		let frame = 0;
		const start = performance.now();
		const tick = (now: number) => {
			const progress = (now - start) / duration;
			setShown(countUpValue(value, progress));
			if (progress < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [value]);
	return <>{formatValue(shown)}</>;
}

type PanelView = "known" | "challenger" | "upcoming";

function GameButton({
	guess,
	onGuess,
	disabled,
}: {
	guess: HigherLowerGuess;
	onGuess?: (guess: HigherLowerGuess) => void;
	disabled: boolean;
}) {
	const Icon = guess === "higher" ? ChevronUp : ChevronDown;
	return (
		<button
			type="button"
			onClick={() => onGuess?.(guess)}
			disabled={disabled}
			aria-keyshortcuts={guess === "higher" ? "ArrowUp" : "ArrowDown"}
			className="flex w-36 items-center justify-center gap-2 rounded-full border-2 border-foreground/80 bg-background/30 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm md:w-44 md:px-6 md:py-3 md:text-base transition-colors hover:border-brand hover:bg-brand hover:text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none"
		>
			{guess === "higher" ? "Higher" : "Lower"}
			<Icon size={20} strokeWidth={2.5} />
		</button>
	);
}

function ItemPanel({
	item,
	view,
	revealed = false,
	correct = null,
	intro = false,
	onGuess,
}: {
	item: HigherLowerItem | null;
	view: PanelView;
	/** Start of a run: the known item fills the board, then shrinks to its half as the challenger slides in. */
	intro?: boolean;
	revealed?: boolean;
	/** Set once the count-up finishes, coloring the challenger's value. */
	correct?: boolean | null;
	onGuess?: (guess: HigherLowerGuess) => void;
}) {
	const basis = cn(
		"shrink-0 transition-[flex-basis] ease-in-out motion-reduce:transition-none",
		intro ? "basis-2/3" : "basis-1/3",
	);
	if (!item) return <div className={cn("relative bg-background", basis)} aria-hidden />;
	const image = itemImageUrl(item, "512");
	const source = SOURCE_LABELS[item.source];
	const interactive = view === "challenger" && !revealed;
	const valueTone = view === "known" || correct === null ? "text-foreground" : correct ? "text-success" : "text-danger";
	return (
		<section
			aria-hidden={view === "upcoming" || undefined}
			inert={view === "upcoming"}
			aria-label={
				view === "known" ? `${item.name}, known value` : view === "challenger" ? `${item.name}, guess` : undefined
			}
			className={cn(
				"relative flex items-center justify-center overflow-hidden",
				basis,
				intro && "animate-in fade-in-0 duration-500 motion-reduce:animate-none",
			)}
			style={{ transitionDuration: `${INTRO_SPLIT_MS}ms` }}
		>
			{/* eslint-disable-next-line @next/next/no-img-element -- blurred backdrop of the remote item art */}
			<img
				src={image}
				alt=""
				aria-hidden
				className="absolute inset-0 h-full w-full scale-150 object-cover opacity-60 blur-3xl"
			/>
			<div className="absolute inset-0 bg-linear-to-b from-background/50 via-background/70 to-background/95" />
			<div className="relative flex w-full max-w-xl flex-col items-center gap-3 px-6 text-center md:gap-4">
				{/* eslint-disable-next-line @next/next/no-img-element -- remote item art is not optimized */}
				<img
					src={image}
					alt={item.name}
					className="h-[18vh] max-h-80 w-auto max-w-full object-contain drop-shadow-2xl md:h-[34vh]"
				/>
				<h2 className="text-xl font-bold leading-tight text-foreground md:text-3xl">“{item.name}”</h2>
				{view === "known" || revealed ? (
					<p
						className={cn(
							"text-4xl font-extrabold tabular-nums tracking-tight transition-colors duration-500 md:text-6xl",
							valueTone,
							intro && "animate-in fade-in-0 zoom-in-75 fill-mode-both delay-300 motion-reduce:animate-none",
						)}
					>
						{view === "known" ? formatValue(item.value) : <CountUp value={item.value} />}
					</p>
				) : (
					<div className="flex items-center gap-2 md:flex-col md:gap-3">
						<GameButton guess="higher" onGuess={onGuess} disabled={!interactive} />
						<GameButton guess="lower" onGuess={onGuess} disabled={!interactive} />
					</div>
				)}
				<p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", source.className)}>{source.label}</p>
			</div>
		</section>
	);
}

/** The seam badge: VS, then ✓ or ✗ for the answer; when the run ends it expands into the game-over card. */
function CenterBadge({
	round,
	bestStreak,
	bestBeforeRun,
	onRestart,
}: {
	round: HigherLowerRound;
	bestStreak: number;
	bestBeforeRun: number;
	onRestart: () => void;
}) {
	// The card stays while Play again fades the board out.
	const over = round.phase === "over" || round.phase === "closing";
	const result = round.phase === "result" || round.phase === "slide" || over ? round.correct : null;
	const newBest = round.streak > bestBeforeRun;
	return (
		<div
			role={over ? "group" : undefined}
			aria-labelledby={over ? "higher-lower-over" : undefined}
			aria-hidden={over ? undefined : true}
			className={cn(
				"absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden border-4 border-background shadow-2xl transition-[width,height,border-radius,background-color,scale] duration-500 ease-out motion-reduce:transition-none",
				round.phase === "intro" && "scale-0",
				round.phase === "guess" && round.streak === 0 && "delay-300",
				over
					? cn("h-80 w-72 rounded-3xl", round.correct ? "bg-success-surface" : "bg-danger-surface")
					: cn(
							"pointer-events-none h-16 w-16 rounded-[50%] md:h-20 md:w-20",
							result === null && "bg-card text-foreground",
							result === true && "bg-success text-inverse",
							result === false && "bg-danger text-inverse",
						),
			)}
		>
			<div
				className={cn(
					"absolute inset-0 flex items-center justify-center text-lg font-extrabold transition-opacity duration-150 md:text-xl",
					over && "opacity-0",
				)}
			>
				{result === true ? (
					<Check size={36} strokeWidth={3} />
				) : result === false ? (
					<X size={36} strokeWidth={3} />
				) : (
					"VS"
				)}
			</div>
			{over && (
				<div className="relative flex h-full flex-col items-center justify-center gap-3 p-6 text-center animate-in fade-in-0 zoom-in-95 fill-mode-both delay-300 duration-300 motion-reduce:animate-none">
					<p
						className={cn(
							"text-xs font-semibold uppercase tracking-[0.2em]",
							round.correct ? "text-muted-foreground" : "text-danger",
						)}
					>
						{round.correct ? "Out of items" : "Wrong call"}
					</p>
					<h2 id="higher-lower-over" className="text-xl font-bold text-foreground">
						You scored
					</h2>
					<p className="text-6xl font-extrabold tabular-nums text-foreground">{round.streak}</p>
					<p className={cn("text-sm", newBest ? "font-semibold text-success" : "text-muted-foreground")}>
						{newBest ? "New best streak!" : `Best streak: ${bestStreak}`}
					</p>
					<button
						type="button"
						autoFocus
						disabled={round.phase === "closing"}
						onClick={onRestart}
						className="mt-1 flex items-center gap-2 rounded-full bg-foreground px-6 py-3 font-semibold uppercase tracking-wide text-background transition-colors hover:bg-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
					>
						<RotateCcw size={18} />
						Play again
					</button>
				</div>
			)}
		</div>
	);
}

function isTypingTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

/** Full-bleed split board: the known item, the challenger to guess and, off-screen, the preloaded next item. */
export function HigherLowerGame({ items }: { items: HigherLowerItem[] }) {
	const { round, bestStreak, bestBeforeRun, guess, restart } = useHigherLowerGame(items);
	const phase = round?.phase;

	useEffect(() => {
		if (phase !== "guess") return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
			if (event.key === "ArrowUp") guess("higher");
			else if (event.key === "ArrowDown") guess("lower");
			else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [phase, guess]);

	if (!round) {
		return (
			<main className="container mx-auto px-6 py-8 text-center text-muted-foreground">
				Not enough priced items are available to play in this mode.
			</main>
		);
	}

	const sliding = round.phase === "slide";
	const revealed = REVEALED_PHASES.has(round.phase);
	return (
		<main className="relative isolate flex min-h-[560px] flex-1 overflow-hidden bg-background">
			<h1 className="sr-only">Higher or Lower</h1>
			<div
				key={round.run}
				className={cn(
					"absolute inset-0 transition-opacity ease-out motion-reduce:transition-none",
					round.phase === "closing" && "opacity-0",
				)}
				style={{ transitionDuration: `${CLOSE_MS}ms` }}
			>
				<div
					className={cn(
						"absolute inset-x-0 top-0 flex h-[150%] w-full flex-col md:h-full md:w-[150%] md:flex-row",
						sliding && "-translate-y-1/3 md:translate-y-0 md:-translate-x-1/3",
					)}
					style={
						sliding
							? {
									transitionProperty: "translate",
									transitionDuration: `${SLIDE_MS}ms`,
									transitionTimingFunction: "ease-in-out",
								}
							: undefined
					}
				>
					<ItemPanel key={round.baseline.id} item={round.baseline} view="known" intro={round.phase === "intro"} />
					<ItemPanel
						key={round.challenger.id}
						item={round.challenger}
						view="challenger"
						revealed={revealed}
						correct={round.phase === "reveal" ? null : round.correct}
						onGuess={guess}
					/>
					<ItemPanel key={round.upcoming?.id ?? "empty"} item={round.upcoming} view="upcoming" />
				</div>
				<CenterBadge round={round} bestStreak={bestStreak} bestBeforeRun={bestBeforeRun} onRestart={restart} />
			</div>
			<p className="sr-only" aria-live="polite">
				{round.phase === "result" || round.phase === "over"
					? `${round.correct ? "Correct" : "Wrong"}: ${round.challenger.name} is worth ${formatValue(round.challenger.value)}.`
					: ""}
			</p>
			<p className="absolute bottom-4 left-5 z-10 text-sm font-bold text-foreground md:bottom-6 md:left-8 md:text-lg">
				Best streak: <span className="tabular-nums">{bestStreak}</span>
			</p>
			<p className="absolute bottom-4 right-5 z-10 text-sm font-bold text-foreground md:bottom-6 md:right-8 md:text-lg">
				Streak: <span className="tabular-nums">{round.streak}</span>
			</p>
		</main>
	);
}
