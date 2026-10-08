"use client";

import { Check, RotateCcw, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { itemImageUrl } from "@/lib/utils/item-images";
import type { ItemSummary } from "@/types/items";
import type { ItemNeed, SaveReason } from "../../items/demand/item-demand-model";
import { useDoINeedItGame } from "./useDoINeedItGame";

function reasonText(reason: SaveReason) {
	const count = reason.count > 1 ? ` ×${reason.count}` : "";
	return `${reason.kind === "quest" ? `Quest: ${reason.label}` : reason.label}${count}${reason.firCount ? " (FIR)" : ""}`;
}

function NeedReasons({ need }: { need: ItemNeed | undefined }) {
	if (!need?.reasons.length) return null;
	const [first, ...rest] = need.reasons;
	return (
		<p className="text-[11px] leading-snug text-success">
			{reasonText(first)}
			{rest.length > 0 && <span className="text-muted-foreground"> +{rest.length} more</span>}
		</p>
	);
}

function ItemTile({
	item,
	index,
	need,
	needed,
	picked,
	revealed,
	disabled,
	onPick,
}: {
	item: ItemSummary;
	index: number;
	need: ItemNeed | undefined;
	needed: boolean;
	picked: boolean;
	revealed: boolean;
	disabled: boolean;
	onPick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onPick}
			disabled={disabled}
			aria-label={`Pick ${item.name}`}
			style={{ animationDelay: `${index * 45}ms` }}
			className={cn(
				"relative flex w-36 animate-in flex-col items-center gap-2 rounded-xl border-2 bg-card p-3 text-center transition-all duration-300 fade-in-0 zoom-in-90 fill-mode-both focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:animate-none md:w-44",
				!revealed && "border-border hover:-translate-y-1 hover:border-brand",
				revealed && needed && "border-success bg-success-surface",
				revealed && !needed && (picked ? "border-danger bg-danger-surface" : "border-border opacity-45"),
				disabled && "cursor-default",
			)}
		>
			{revealed && picked && (
				<span
					className={cn(
						"absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-inverse shadow-lg",
						needed ? "bg-success" : "bg-danger",
					)}
				>
					{needed ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
				</span>
			)}
			{/* eslint-disable-next-line @next/next/no-img-element -- remote item art is not optimized */}
			<img src={itemImageUrl(item, "512")} alt="" className="h-20 w-full object-contain drop-shadow-xl md:h-28" />
			<span className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{item.name}</span>
			{revealed && needed && <NeedReasons need={need} />}
		</button>
	);
}

/** A shrinking grid of items: pick one the active profile still needs; same-category decoys fill the rest. */
export function DoINeedItGame({
	catalog,
	needs,
	personal,
}: {
	catalog: readonly ItemSummary[];
	needs: ReadonlyMap<string, ItemNeed>;
	/** Needs come from the player's own progress and inventory rather than the whole game. */
	personal: boolean;
}) {
	const { state, neededCount, bestStreak, bestBeforeRun, pick, restart } = useDoINeedItGame(catalog, needs);

	if (!state) {
		return (
			<main className="container mx-auto px-6 py-8 text-center text-muted-foreground">
				Nothing on your list needs items right now. Come back when you have quests or hideout upgrades left.
			</main>
		);
	}

	const revealed = state.phase !== "pick";
	const ended = state.phase === "over" || state.phase === "complete";
	return (
		<main className="flex flex-1 flex-col bg-background">
			<div className="container mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:py-10">
				<header className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Round {state.round + 1}</p>
						<h1 className="text-2xl font-bold text-foreground md:text-3xl">Do I Need It?</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{personal
								? "Based on your remaining quests, hideout upgrades and inventory."
								: "Needed by any quest or hideout upgrade. Finish setup to make it about your own progress."}
						</p>
					</div>
					<div className="flex gap-6 text-right text-sm font-bold text-foreground md:text-base">
						<p>
							Streak <span className="tabular-nums text-brand">{state.streak}</span>
						</p>
						<p>
							Best <span className="tabular-nums">{bestStreak}</span>
						</p>
					</div>
				</header>

				<p className="text-center text-lg font-semibold text-foreground" aria-live="polite">
					{state.phase === "pick"
						? `Pick an item you still need. ${neededCount} ${neededCount === 1 ? "is" : "are"} needed.`
						: state.phase === "correct"
							? "Needed!"
							: state.phase === "complete"
								? "You found everything you need."
								: "You don't need that one."}
				</p>

				<div key={`${state.run}:${state.round}`} className="flex flex-wrap content-center justify-center gap-3 md:gap-4">
					{state.items.map((item, index) => (
						<ItemTile
							key={item.id}
							item={item}
							index={index}
							need={needs.get(item.id)}
							needed={state.needed.has(item.id)}
							picked={state.picked === item.id}
							revealed={revealed}
							disabled={state.phase !== "pick"}
							onPick={() => pick(item.id)}
						/>
					))}
				</div>

				{ended && (
					<section
						className={cn(
							"mx-auto flex w-full max-w-sm animate-in flex-col items-center gap-3 rounded-2xl p-6 text-center fade-in-0 zoom-in-95 fill-mode-both delay-500 duration-300 motion-reduce:animate-none",
							state.phase === "complete" ? "bg-success-surface" : "bg-danger-surface",
						)}
					>
						{state.phase === "complete" && <Trophy size={28} className="text-success" />}
						<h2 className="text-xl font-bold text-foreground">You scored {state.streak}</h2>
						<p
							className={cn(
								"text-sm",
								state.streak > bestBeforeRun ? "font-semibold text-success" : "text-muted-foreground",
							)}
						>
							{state.streak > bestBeforeRun ? "New best streak!" : `Best streak: ${bestStreak}`}
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
