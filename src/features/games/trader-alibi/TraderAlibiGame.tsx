"use client";

import { Fragment, useMemo } from "react";
import { ArrowRight, Check, HelpCircle, Repeat, RotateCcw, ScrollText, ShoppingCart, X } from "lucide-react";
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
import { useTraderAlibiGame } from "./useTraderAlibiGame";

const KIND_LABELS: Record<ClueKind, { label: string; Icon: typeof ScrollText }> = {
	objective: { label: "Quest objective", Icon: ScrollText },
	barter: { label: "Barter", Icon: Repeat },
	sold: { label: "Sold item", Icon: ShoppingCart },
};

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

function ClueCard({ clue, index }: { clue: TraderClue; index: number }) {
	const { label, Icon } = KIND_LABELS[clue.kind];
	return (
		<li className="flex animate-in gap-3 rounded-xl border border-border bg-card p-4 fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
			<div className="flex shrink-0 flex-col items-center gap-1 text-muted-foreground">
				<Icon size={20} />
				<span className="text-[10px] font-semibold uppercase tracking-wide">#{index + 1}</span>
			</div>
			<div className="min-w-0 flex-1">
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
					{label}
					{clue.kind !== "objective" && <span className="ml-2 text-subtle-foreground">Loyalty {clue.level}</span>}
				</p>
				{clue.kind === "objective" &&
					(clue.handIn ? (
						<p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
							Hand over <ClueItemChip entry={{ item: clue.handIn.item, count: clue.count }} />
							{clue.handIn.foundInRaid && <span className="font-semibold text-fir">Found in raid</span>}
						</p>
					) : (
						<p className="mt-1 text-base text-foreground">
							{clue.text}
							{clue.count > 1 && (
								<span className="ml-2 font-semibold tabular-nums text-muted-foreground">
									×{formatCount(clue.count)}
								</span>
							)}
						</p>
					))}
				{clue.kind === "objective" && clue.maps.length > 0 && (
					<p className="mt-1 text-xs text-muted-foreground">Map: {clue.maps.join(", ")}</p>
				)}
				{clue.kind === "sold" && (
					<p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
						Sells <ClueItemChip entry={{ item: clue.item, count: 1 }} />
					</p>
				)}
				{clue.kind === "barter" && (
					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
						{clue.inputs.map((input, inputIndex) => (
							<Fragment key={`${input.item.id}:${inputIndex}`}>
								{inputIndex > 0 && <span className="text-muted-foreground">+</span>}
								<ClueItemChip entry={input} />
							</Fragment>
						))}
						<ArrowRight size={18} className="text-muted-foreground" aria-label="for" />
						<ClueItemChip entry={clue.output} />
					</div>
				)}
			</div>
		</li>
	);
}

/** Ask for a quest, barter or sold-item clue, then guess which trader it belongs to. */
export function TraderAlibiGame({ pools }: { pools: TraderCluePools }) {
	const { round, availableKinds, questionsLeft, canGuess, bestScore, bestBeforeRun, ask, guess, restart } =
		useTraderAlibiGame(pools);
	const traderIds = useMemo(() => [...pools.keys()], [pools]);

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
		<main className="flex flex-1 flex-col bg-background">
			<div className="container mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 md:py-10">
				<BackToGames className="-mb-3 self-start" />
				<header className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
							Round {round.round}
						</p>
						<h1 className="text-2xl font-bold text-foreground md:text-3xl">Trader Alibi</h1>
					</div>
					<div className="flex gap-6 text-right text-sm font-bold text-foreground md:text-base">
						<p>
							Score <span className="tabular-nums text-brand">{round.score}</span>
						</p>
						<p>
							Best <span className="tabular-nums">{bestScore}</span>
						</p>
					</div>
				</header>

				<section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 md:p-6">
					<div
						className={cn(
							"relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-shadow/40 transition-colors duration-300 md:h-24 md:w-24",
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
							<HelpCircle size={40} className="text-muted-foreground" aria-label="Unknown trader" />
						)}
					</div>
					<div className="min-w-0 flex-1" aria-live="polite">
						{round.phase === "correct" ? (
							<>
								<p className="text-xl font-bold text-success">It was {hidden.name}!</p>
								<p className="text-sm text-muted-foreground">+{round.earned} points</p>
							</>
						) : round.phase === "over" ? (
							<>
								<p className="text-xl font-bold text-danger">It was {hidden.name}.</p>
								<p className="text-sm text-muted-foreground">Out of questions.</p>
							</>
						) : (
							<>
								<p className="text-xl font-bold text-foreground">Who am I?</p>
								<p className="text-sm text-muted-foreground">
									{round.phase === "ask"
										? availableKinds.length
											? "Ask a question to get a clue."
											: "No clues left. Make your guess."
										: "Pick the trader."}
								</p>
							</>
						)}
					</div>
					<div className="flex shrink-0 flex-col items-end gap-1">
						<span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Questions</span>
						<div className="flex gap-1" aria-label={`${questionsLeft} of ${MAX_QUESTIONS} questions left`}>
							{Array.from({ length: MAX_QUESTIONS }, (_, index) => (
								<span
									key={index}
									className={cn(
										"h-2.5 w-2.5 rounded-full transition-colors",
										index < MAX_QUESTIONS - questionsLeft ? "bg-danger" : "bg-highlight/20",
									)}
								/>
							))}
						</div>
					</div>
				</section>

				{round.phase === "ask" && availableKinds.length > 0 && (
					<section aria-label="Ask a question" className="flex flex-wrap justify-center gap-3">
						{(Object.keys(KIND_LABELS) as ClueKind[]).map((kind) => {
							const { label, Icon } = KIND_LABELS[kind];
							const available = availableKinds.includes(kind);
							return (
								<button
									key={kind}
									type="button"
									disabled={!available}
									onClick={() => ask(kind)}
									className="flex items-center gap-2 rounded-full border-2 border-brand px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-brand transition-colors hover:bg-brand hover:text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-30"
								>
									<Icon size={18} />
									{label}
								</button>
							);
						})}
					</section>
				)}

				{round.clues.length > 0 && (
					<ol className="flex flex-col gap-3">
						{round.clues.map((clue, index) => (
							<ClueCard key={index} clue={clue} index={index} />
						))}
					</ol>
				)}

				<section aria-label="Traders" className="mt-auto grid grid-cols-4 gap-3 md:grid-cols-8">
					{traderIds.map((id) => {
						const trader = traderInfo(id);
						const eliminated = round.eliminated.has(id);
						const answer = revealed && id === round.traderId;
						return (
							<button
								key={id}
								type="button"
								disabled={!canGuess || eliminated}
								onClick={() => guess(id)}
								aria-label={`Guess ${trader.name}`}
								className={cn(
									"group relative flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
									answer
										? round.phase === "correct"
											? "border-success bg-success-surface"
											: "border-danger bg-danger-surface"
										: "border-border bg-card",
									canGuess && !eliminated && "hover:-translate-y-0.5 hover:border-brand",
									(!canGuess || eliminated) && !answer && "opacity-50",
								)}
							>
								<span className="relative block aspect-square w-full overflow-hidden rounded-lg">
									{/* eslint-disable-next-line @next/next/no-img-element -- remote trader art is not optimized */}
									<img
										src={traderImageUrl(id)}
										alt=""
										className={cn("h-full w-full object-cover", eliminated && "grayscale")}
									/>
									{eliminated && (
										<span className="absolute inset-0 flex items-center justify-center bg-background/50">
											<X size={32} strokeWidth={3} className="text-danger" />
										</span>
									)}
									{answer && round.phase === "correct" && (
										<span className="absolute inset-0 flex items-center justify-center bg-background/40">
											<Check size={32} strokeWidth={3} className="text-success" />
										</span>
									)}
								</span>
								<span className="truncate text-xs font-semibold text-foreground">{trader.name}</span>
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
