import { Circle, CircleCheck, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tile } from "../lib/battle-pass-model";
import { rewardTarCoins } from "../lib/funding-model";
import type { RouteOption } from "../lib/route-options-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { Disclosure } from "./ui/Disclosure";
import { liftedControl, syncValue } from "./ui/field";
import { TarCoin } from "./ui/TarCoin";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const signedUsd = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${usd(Math.abs(cents))}`;
const signedCoins = (coins: number) => `${coins > 0 ? "+" : coins < 0 ? "−" : ""}${Math.abs(coins).toLocaleString()}`;
const tileName = (tile: Tile) => {
	const coins = rewardTarCoins(tile);
	return coins > 0 ? `${tile.displayName} ×${coins}` : tile.displayName;
};
const names = (tiles: Tile[]) => tiles.map(tileName).join(" and ");

/** The suggested route plus the alternatives that cost less or leave more TarCoins than it. */
export function RouteOptions() {
	const plan = useBattlePassPlanContext();
	const { alternatives: ready, adoptRoute, routePicked, adoptedIndex } = plan;
	if (typeof plan.result === "string" || plan.optionsStatus === "off") return null;
	const priced = plan.routeOptions;
	const suggestedIndex = priced?.suggestedIndex ?? 0;
	const suggested = priced?.options.find((option) => option.routeIndex === suggestedIndex);
	const activeIndex = adoptedIndex + 1;
	// An alternative that costs at least as much and leaves no more TarCoins is never worth picking.
	const others = (priced?.options ?? []).filter(
		(option) =>
			option.routeIndex !== suggestedIndex &&
			(option.routeIndex === activeIndex || option.cashDeltaCents < 0 || option.tarCoinsLeftDelta > 0),
	);
	const comparable = others.length > 0 || activeIndex !== suggestedIndex;
	if (ready && priced && (!suggested || !comparable)) return null;
	const cards = suggested ? [suggested, ...others] : [];
	const use = (option: RouteOption) => adoptRoute(option.routeIndex === 0 ? null : ready![option.routeIndex - 1].columns);

	const card = (option: RouteOption) => {
		const isSuggested = option.routeIndex === suggestedIndex;
		const active = option.routeIndex === activeIndex;
		const Check = active ? CircleCheck : Circle;
		return (
			<li
				key={option.routeIndex}
				className={cn(
					"flex items-start gap-2 rounded-lg p-3 text-xs",
					liftedControl,
					active && "bg-[color-mix(in_oklab,var(--brand)_4%,var(--surface-raised))]",
				)}
			>
				<Check className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} aria-hidden />
				<div className="min-w-0 flex-1 space-y-1">
					<p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
						{option.routeIndex === 0 ? "Fewest documents" : "Alternative route"}
						{isSuggested && (
							<span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
								Suggested route
							</span>
						)}
						{active && (
							<span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">Active</span>
						)}
					</p>
					{option.swaps.map((swap) => (
						<p key={swap.page} className="text-muted-foreground">
							Page {swap.page}: {names(swap.claim)}
							{swap.skip.length > 0 && <> instead of {names(swap.skip)}</>}
						</p>
					))}
					<p className="flex flex-wrap items-center gap-x-1 tabular-nums">
						{isSuggested ? (
							<>
								<span className="inline-flex items-center font-semibold">
									{option.tarCoinsLeft.toLocaleString()}
									<TarCoin />
								</span>
								<span className="text-muted-foreground">left · {usd(option.cashCents)}</span>
							</>
						) : (
							<>
								<span className={cn("inline-flex items-center font-semibold", option.tarCoinsLeftDelta > 0 && "text-success")}>
									{signedCoins(option.tarCoinsLeftDelta)}
									<TarCoin />
								</span>
								<span className="text-muted-foreground">left · {signedUsd(option.cashDeltaCents)}</span>
							</>
						)}
					</p>
				</div>
				{!active && (
					<button
						type="button"
						onClick={() => use(option)}
						className={cn(
							"h-7 shrink-0 cursor-pointer rounded-md px-2.5 text-xs font-medium text-brand focus-visible:outline-2 focus-visible:outline-brand",
							liftedControl,
						)}
					>
						Use this route
					</button>
				)}
			</li>
		);
	};

	return (
		<Disclosure
			title="Route options"
			icon={<Scale className="size-4 text-brand" aria-hidden />}
			syncing={!ready || !priced}
			meta={ready && priced ? (others.length ? `${others.length} to compare` : "Suggested route") : "Comparing routes…"}
		>
			{ready && priced && (
				<>
					<ol className={cn("grid gap-2 sm:grid-cols-2", syncValue)}>{cards.map(card)}</ol>
					{routePicked && activeIndex !== suggestedIndex && (
						<button
							type="button"
							onClick={plan.pickCheapestRoute}
							className="cursor-pointer text-xs text-brand underline-offset-2 hover:underline"
						>
							Back to suggested route
						</button>
					)}
				</>
			)}
		</Disclosure>
	);
}
