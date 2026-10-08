"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, HelpCircle, Repeat, RotateCcw, ScrollText, ShoppingCart, UserRound, X } from "lucide-react";
import { ItemThumbnail } from "@/components/entities/item-thumbnail";
import { traderImageUrl, traderInfo } from "@/lib/data/traders";
import { cn } from "@/lib/utils";
import {
	MAX_QUESTIONS,
	type ClueItem,
	type ClueKind,
	type TraderClue,
	type TraderCluePools,
} from "./trader-alibi-model";
import { BackToGames } from "../BackToGames";
import { useTraderAlibiGame, type TraderAlibiEntry, type TraderAlibiRound } from "./useTraderAlibiGame";

const KIND_LABELS: Record<ClueKind, { label: string; short: string; Icon: typeof ScrollText }> = {
	objective: { label: "Quest objective", short: "Quest", Icon: ScrollText },
	barter: { label: "Barter", short: "Barter", Icon: Repeat },
	sold: { label: "Sold item", short: "Sold", Icon: ShoppingCart },
};

/** Flavour lines, varied per round; guesses and the clues themselves stay fixed. */
const LINES = {
	opener: [
		"Who's this?",
		"I hear you've been asking around.",
		"Make it quick.",
		"Careful what you ask, friend.",
		"You've got one shot at this.",
		"Speak.",
		"Didn't expect you to have this number.",
	],
	objective: ["Got any work for me?", "Need anything done?", "Any jobs going?", "What tasks have you got?"],
	barter: ["What are you trading?", "Got any barters?", "What'll you swap me?", "Any trades on the table?"],
	sold: ["What's for sale?", "What are you selling?", "What have you got in stock?", "Show me your wares."],
	wrong: [
		"Nope.",
		"Wrong guess.",
		"Not even close.",
		"Try again.",
		"Who? Never heard of them.",
		"Ha. No.",
		"Guess again.",
	],
	right: ["Yeah, you got me.", "Alright, it's me.", "Took you long enough.", "Fine. You caught me.", "Good guess."],
};
const CLUE_TYPING_MS = 700;
const GUESS_TYPING_MS = 450;

function line(lines: readonly string[], seed: number, index: number) {
	let hash = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
	hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
	hash = (hash ^ (hash >>> 13)) >>> 0;
	return lines[hash % lines.length];
}

function prefersReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatCount(count: number) {
	return Number.isInteger(count)
		? count.toLocaleString("en-US")
		: count.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function ClueItemChip({ entry }: { entry: ClueItem }) {
	return (
		<span className="inline-flex items-center gap-2">
			<ItemThumbnail item={entry.item} size={36} framed />
			<span className="text-sm text-foreground">
				{entry.count !== 1 && <span className="font-semibold tabular-nums">{formatCount(entry.count)}× </span>}
				{entry.item.name}
			</span>
		</span>
	);
}

function ClueBody({ clue }: { clue: TraderClue }) {
	if (clue.kind === "sold")
		return (
			<p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				Sells <ClueItemChip entry={{ item: clue.item, count: 1 }} />
			</p>
		);
	if (clue.kind === "barter")
		return (
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				{clue.inputs.map((input, inputIndex) => (
					<Fragment key={`${input.item.id}:${inputIndex}`}>
						{inputIndex > 0 && <span className="text-muted-foreground">+</span>}
						<ClueItemChip entry={input} />
					</Fragment>
				))}
				<ArrowRight size={18} className="text-muted-foreground" aria-label="for" />
				<ClueItemChip entry={clue.output} />
			</div>
		);
	return (
		<>
			{clue.handIn ? (
				<p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					Hand over <ClueItemChip entry={{ item: clue.handIn.item, count: clue.count }} />
					{clue.handIn.foundInRaid && <span className="font-semibold text-fir">Found in raid</span>}
				</p>
			) : (
				<p className="text-base text-foreground">
					{clue.text}
					{clue.count > 1 && (
						<span className="ml-2 font-semibold tabular-nums text-muted-foreground">×{formatCount(clue.count)}</span>
					)}
				</p>
			)}
			{clue.maps.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Map: {clue.maps.join(", ")}</p>}
		</>
	);
}

function OutgoingBubble({ children }: { children: ReactNode }) {
	return (
		<li className="max-w-[80%] animate-in self-end rounded-2xl rounded-br-md bg-brand px-4 py-2 text-sm font-medium text-inverse fade-in-0 slide-in-from-right-4 duration-200 motion-reduce:animate-none">
			{children}
		</li>
	);
}

/** A trader reply; the newest one shows a typing indicator first. */
function IncomingBubble({ fresh, typingMs, children }: { fresh: boolean; typingMs: number; children: ReactNode }) {
	const [typing, setTyping] = useState(() => fresh && !prefersReducedMotion());
	useEffect(() => {
		if (!typing) return;
		const timer = setTimeout(() => setTyping(false), typingMs);
		return () => clearTimeout(timer);
	}, [typing, typingMs]);
	return (
		<li className="flex max-w-[88%] animate-in items-end gap-2 self-start fade-in-0 slide-in-from-left-4 duration-200 motion-reduce:animate-none">
			<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted-foreground">
				<UserRound size={16} />
			</span>
			<div className="min-w-0 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-2.5">
				{typing ? (
					<span className="flex h-5 items-center gap-1" aria-label="Typing">
						{[0, 150, 300].map((delay) => (
							<span
								key={delay}
								className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
								style={{ animationDelay: `${delay}ms` }}
							/>
						))}
					</span>
				) : (
					<div className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">{children}</div>
				)}
			</div>
		</li>
	);
}

function Exchange({
	entry,
	index,
	round,
	fresh,
}: {
	entry: TraderAlibiEntry;
	index: number;
	round: TraderAlibiRound;
	fresh: boolean;
}) {
	if (entry.kind === "guess") {
		const correct = entry.traderId === round.traderId;
		return (
			<>
				<OutgoingBubble>Is this {traderInfo(entry.traderId).name}?</OutgoingBubble>
				<IncomingBubble fresh={fresh} typingMs={GUESS_TYPING_MS}>
					<p className="text-sm text-foreground">{line(correct ? LINES.right : LINES.wrong, round.seed, index)}</p>
				</IncomingBubble>
			</>
		);
	}
	const { label, Icon } = KIND_LABELS[entry.kind];
	return (
		<>
			<OutgoingBubble>{line(LINES[entry.kind], round.seed, index)}</OutgoingBubble>
			<IncomingBubble fresh={fresh} typingMs={CLUE_TYPING_MS}>
				<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
					<Icon size={14} />
					{label}
					{entry.kind !== "objective" && <span className="ml-1 text-subtle-foreground">Loyalty {entry.level}</span>}
				</p>
				<ClueBody clue={entry} />
			</IncomingBubble>
		</>
	);
}

/** Sizes the page to the viewport below the navbar, so the conversation scrolls instead of the page. */
function useFillViewport() {
	const ref = useRef<HTMLElement>(null);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const update = () =>
			element.style.setProperty("--game-top", `${element.getBoundingClientRect().top + window.scrollY}px`);
		update();
		const observer = new ResizeObserver(update);
		const nav = document.querySelector("[data-main-nav]");
		if (nav) observer.observe(nav);
		window.addEventListener("resize", update);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", update);
		};
	}, []);
	return ref;
}

/** Keeps a scroll container pinned to its newest content as messages arrive or finish typing. */
function useStickToBottom(conversation: string) {
	const scroller = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLOListElement>(null);
	useEffect(() => {
		const list = content.current;
		const container = scroller.current;
		if (!list || !container) return;
		const observer = new ResizeObserver(() =>
			container.scrollTo({ top: container.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" }),
		);
		observer.observe(list);
		return () => observer.disconnect();
	}, [conversation]);
	return { scroller, content };
}

/** Ask for a quest, barter or sold-item clue, then guess which trader it belongs to. */
export function TraderAlibiGame({ pools }: { pools: TraderCluePools }) {
	const { round, availableKinds, questionsLeft, canGuess, bestScore, bestBeforeRun, ask, guess, restart } =
		useTraderAlibiGame(pools);
	const traderIds = useMemo(() => [...pools.keys()], [pools]);
	const page = useFillViewport();
	const { scroller, content } = useStickToBottom(`${round?.run}:${round?.round}`);

	if (!round) {
		return (
			<main className="container mx-auto px-6 py-8 text-center text-muted-foreground">
				No trader clues are available in this mode.
			</main>
		);
	}

	const revealed = round.phase === "correct" || round.phase === "over";
	const hidden = traderInfo(round.traderId);
	return (
		<main ref={page} className="flex h-[calc(100dvh-var(--game-top,4rem))] min-h-[36rem] flex-col bg-background">
			<div className="container mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 px-4 py-3 md:gap-6 md:py-8">
				<header className="flex flex-col gap-1 md:gap-2">
					<BackToGames className="self-start" />
					<h1 className="sr-only text-3xl font-bold text-foreground md:not-sr-only">Trader Alibi</h1>
				</header>

				<section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 md:gap-4 md:p-6">
					<div
						className={cn(
							"relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-shadow/40 transition-colors duration-300 md:h-24 md:w-24",
							round.phase === "correct" ? "border-success" : round.phase === "over" ? "border-danger" : "border-border",
						)}
					>
						{revealed ? (
							// eslint-disable-next-line @next/next/no-img-element -- remote trader art is not optimized
							<img
								src={traderImageUrl(round.traderId)}
								alt={hidden.name}
								className="h-full w-full animate-in object-cover fade-in-0 zoom-in-90 duration-300 motion-reduce:animate-none"
							/>
						) : (
							<HelpCircle className="size-7 text-muted-foreground md:size-10" aria-label="Unknown trader" />
						)}
					</div>
					<div className="min-w-0 flex-1" aria-live="polite">
						{round.phase === "correct" ? (
							<>
								<p className="text-base font-bold text-success md:text-xl">It was {hidden.name}!</p>
								<p className="text-xs text-muted-foreground md:text-sm">+{round.earned} points</p>
							</>
						) : round.phase === "over" ? (
							<>
								<p className="text-base font-bold text-danger md:text-xl">It was {hidden.name}.</p>
								<p className="text-xs text-muted-foreground md:text-sm">Out of questions.</p>
							</>
						) : (
							<>
								<p className="text-base font-bold text-foreground md:text-xl">Who am I?</p>
								<p className="text-xs text-muted-foreground md:text-sm">
									{round.phase === "ask"
										? availableKinds.length
											? "Ask a question to get a clue."
											: "No clues left. Make your guess."
										: "Pick the trader."}
								</p>
							</>
						)}
					</div>
					<div className="flex shrink-0 flex-col items-end gap-2 text-right md:gap-2.5">
						<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
							Round <span className="tabular-nums text-foreground">{round.round}</span>
						</span>
						<div className="flex gap-1.5" aria-label={`${questionsLeft} of ${MAX_QUESTIONS} questions left`}>
							{Array.from({ length: MAX_QUESTIONS }, (_, index) => (
								<span
									key={index}
									className={cn(
										"h-3 w-3 rounded-full transition-colors md:h-3.5 md:w-3.5",
										index < MAX_QUESTIONS - questionsLeft ? "bg-danger" : "bg-highlight/20",
									)}
								/>
							))}
						</div>
						<p className="text-xs font-bold text-foreground md:text-sm">
							Score <span className="tabular-nums text-brand">{round.score}</span>
							<span className="mx-1.5 text-subtle-foreground">·</span>
							Best <span className="tabular-nums">{bestScore}</span>
						</p>
					</div>
				</section>

				<div
					ref={scroller}
					className="-my-3 min-h-28 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:thin] py-3 [mask-image:linear-gradient(to_bottom,transparent,black_1rem,black_calc(100%-1rem),transparent)]"
				>
					<ol
						ref={content}
						key={`${round.run}:${round.round}`}
						aria-label="Conversation"
						className="flex flex-col gap-3"
					>
						<IncomingBubble fresh={false} typingMs={0}>
							<p className="text-sm text-foreground">{line(LINES.opener, round.seed, -1)}</p>
						</IncomingBubble>
						{round.log.map((entry, index) => (
							<Exchange key={index} entry={entry} index={index} round={round} fresh={index === round.log.length - 1} />
						))}
					</ol>
				</div>

				{round.phase === "ask" && availableKinds.length > 0 && (
					<section aria-label="Ask a question" className="flex flex-wrap justify-center gap-2 md:gap-3">
						{(Object.keys(KIND_LABELS) as ClueKind[]).map((kind) => {
							const { label, short, Icon } = KIND_LABELS[kind];
							return (
								<button
									key={kind}
									type="button"
									disabled={!availableKinds.includes(kind)}
									onClick={() => ask(kind)}
									aria-label={`Ask for a ${label.toLowerCase()} clue`}
									className="flex items-center gap-1.5 rounded-full border-2 border-brand px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition-colors hover:bg-brand hover:text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-30 md:gap-2 md:px-5 md:py-2.5 md:text-sm"
								>
									<Icon className="size-3.5 md:size-[18px]" />
									<span className="md:hidden">{short}</span>
									<span className="hidden md:inline">{label}</span>
								</button>
							);
						})}
					</section>
				)}

				{/* One row of seven on phones: grid cells size the buttons and scale stands in for the width change. */}
				<section
					aria-label="Traders"
					className="grid shrink-0 grid-cols-7 items-end gap-1 md:flex md:flex-wrap md:justify-center md:gap-3"
				>
					{traderIds.map((id) => {
						const trader = traderInfo(id);
						const eliminated = round.eliminated.has(id);
						const answer = revealed && id === round.traderId;
						const active = canGuess && !eliminated;
						return (
							<button
								key={id}
								type="button"
								disabled={!active}
								onClick={() => guess(id)}
								aria-label={`Guess ${trader.name}`}
								className={cn(
									"group relative flex w-full origin-bottom flex-col items-center gap-0.5 rounded-lg border-2 p-1 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none md:gap-1 md:rounded-xl md:p-1.5 md:scale-100",
									active || answer ? "md:w-24" : "scale-[0.82] md:w-16",
									answer
										? round.phase === "correct"
											? "border-success bg-success-surface"
											: "border-danger bg-danger-surface"
										: "border-border bg-card",
									active && "hover:-translate-y-1 hover:border-brand hover:shadow-lg",
									!active && !answer && "opacity-50",
								)}
							>
								<span className="relative block aspect-square w-full overflow-hidden rounded-md md:rounded-lg">
									{/* eslint-disable-next-line @next/next/no-img-element -- remote trader art is not optimized */}
									<img
										src={traderImageUrl(id)}
										alt=""
										className={cn("h-full w-full object-cover", eliminated && "grayscale")}
									/>
									{eliminated && (
										<span className="absolute inset-0 flex items-center justify-center bg-background/50">
											<X strokeWidth={3} className="size-5 text-danger md:size-7" />
										</span>
									)}
									{answer && round.phase === "correct" && (
										<span className="absolute inset-0 flex items-center justify-center bg-background/40">
											<Check strokeWidth={3} className="size-6 text-success md:size-8" />
										</span>
									)}
								</span>
								<span className="w-full truncate text-center text-[10px] font-semibold text-foreground md:text-xs">
									{trader.name}
								</span>
							</button>
						);
					})}
				</section>

				{round.phase === "over" && (
					<section className="flex animate-in flex-col items-center gap-3 rounded-2xl bg-danger-surface p-6 text-center fade-in-0 zoom-in-95 duration-300 motion-reduce:animate-none">
						<h2 className="text-xl font-bold text-foreground">You scored {round.score}</h2>
						<p
							className={cn(
								"text-sm",
								round.score > bestBeforeRun ? "font-semibold text-success" : "text-muted-foreground",
							)}
						>
							{round.score > bestBeforeRun ? "New best score!" : `Best score: ${bestScore}`}
						</p>
						<button
							type="button"
							autoFocus
							onClick={restart}
							className="flex items-center gap-2 rounded-full bg-foreground px-6 py-3 font-semibold uppercase tracking-wide text-background transition-colors hover:bg-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
						>
							<RotateCcw size={18} />
							Play again
						</button>
					</section>
				)}
			</div>
		</main>
	);
}
