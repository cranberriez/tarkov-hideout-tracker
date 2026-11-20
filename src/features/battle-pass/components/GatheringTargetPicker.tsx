import { Circle, CircleCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RouteEntry } from "../lib/alternate-entries-model";
import type { Tile } from "../lib/battle-pass-model";
import { rewardTarCoins } from "../lib/funding-model";
import { GATHERING_DAILY_CAPS } from "../lib/gathering-caps";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { liftedControl, syncValue } from "./ui/field";
import { TarCoin } from "./ui/TarCoin";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
const tileName = (tile: Tile) => {
	const coins = rewardTarCoins(tile);
	return coins > 0 ? `${tile.displayName} ×${coins}` : tile.displayName;
};
const names = (tiles: Tile[]) => tiles.map(tileName).join(" and ");
/** Legend text for an alternate route: per page, what it skips and what it claims instead. */
const swapText = (swaps: RouteEntry["swaps"]) =>
	swaps
		.map((swap) => `Pg.${swap.page}: ${swap.skip.length ? `${names(swap.skip)} → ` : "+ "}${names(swap.claim)}`)
		.join("; ");
const same = (a: { routeIndex: number; gathered: number } | undefined, b: { routeIndex: number; gathered: number }) =>
	!!a && a.routeIndex === b.routeIndex && a.gathered === b.gathered;
/** Entries shown before "More": the first few, plus the suggested and chosen ones. */
const VISIBLE = 2;
/** At most this many extra options are shown directly instead of behind "More". */
const MAX_REVEALED_INLINE = 2;

/** Choose how much to gather and on which route: no gathering, or a fewest-documents or alternate-route entry. */
export function GatheringTargetPicker() {
	const { gathering: target, deadline } = useBattlePassPlanContext();
	const [more, setMore] = useState(false);
	const { entries, activeEntry, suggested, baselineCents, pastSeason, selected } = target;
	if (baselineCents === null || !entries?.length) {
		if (target.calculating || target.error)
			return (
				<p role="status" className="text-xs text-muted-foreground">
					{target.error ?? "Calculating gathering options…"}
				</p>
			);
		return null;
	}
	const altRoutes = [...new Set(entries.filter((entry) => entry.routeIndex > 0).map((entry) => entry.routeIndex))].sort(
		(a, b) => a - b,
	);
	const altNumber = (routeIndex: number) => altRoutes.indexOf(routeIndex) + 1;
	/** The alternate with the largest saving against its plain neighbors; ties gather fewer documents, then keep more TarCoins. */
	const beats = (a: RouteEntry, b: RouteEntry) =>
		a.versus!.cashDeltaCents - b.versus!.cashDeltaCents ||
		a.versus!.gatheredDelta - b.versus!.gatheredDelta ||
		b.versus!.tarCoinsLeftDelta - a.versus!.tarCoinsLeftDelta;
	const best = entries
		.filter((entry) => entry.routeIndex > 0)
		.reduce<RouteEntry | undefined>((top, entry) => (!top || beats(entry, top) < 0 ? entry : top), undefined);
	// Compact view: the first few fewest-documents entries, the suggested and chosen ones, and the best
	// alternate's entries that sit beside a shown one. Other alternates wait behind "More".
	const plain = entries.filter((entry) => entry.routeIndex === 0);
	const pinnedPlain = new Set(
		plain.filter((entry, index) => index < VISIBLE || same(suggested, entry) || same(activeEntry, entry)),
	);
	const pinned = entries.filter(
		(entry) =>
			same(suggested, entry) ||
			same(activeEntry, entry) ||
			(entry.routeIndex === 0
				? pinnedPlain.has(entry)
				: entry.routeIndex === best?.routeIndex &&
					(entry.versus!.neighborGathered === 0 ||
						[...pinnedPlain].some((point) => point.gathered === entry.versus!.neighborGathered))),
	);
	// Hiding only one or two options is not worth a button.
	const hidden = entries.filter((entry) => !pinned.includes(entry));
	const rest = hidden.length > MAX_REVEALED_INLINE ? hidden : [];
	const shown = more || !rest.length ? entries : pinned;
	const card = (entry: RouteEntry | undefined) => {
		// A saved target past the season end stays the choice; the plan gathers what fits.
		const active = entry ? same(activeEntry, entry) && !pastSeason : !activeEntry;
		const Check = active ? CircleCheck : Circle;
		const coinsLeft = entry ? entry.tarCoinsLeft : target.baselineTarCoinsLeft;
		const alternate = !!entry && entry.routeIndex > 0;
		return (
			<button
				key={entry ? `${entry.routeIndex}:${entry.gathered}` : "none"}
				type="button"
				role="radio"
				aria-checked={active}
				onClick={() => (entry ? target.selectEntry(entry.routeIndex, entry.gathered) : target.selectEntry(0, 0))}
				className={cn(
					"group flex w-full items-start gap-2 rounded-lg p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-brand",
					liftedControl,
					active &&
						"bg-[color-mix(in_oklab,var(--brand)_4%,var(--surface-raised))] hover:bg-[color-mix(in_oklab,var(--brand)_7%,var(--surface-raised))]",
				)}
			>
				<Check
					className={cn(
						"mt-0.5 size-4 shrink-0",
						active ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
					)}
					aria-hidden
				/>
				<span className="min-w-0 flex-1 space-y-1">
					<span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
						{entry && entry.gathered > 0 ? `Gather ${entry.gathered}` : "No gathering"}
						{alternate && (
							<span className="font-medium text-muted-foreground">· Alt {altNumber(entry.routeIndex)}</span>
						)}
						{entry && same(suggested, entry) && (
							<span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
								Suggested route
							</span>
						)}
					</span>
					<span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
						<span>
							Pay {usd(entry ? entry.cashCents : baselineCents)}
							{entry && <span className="text-success"> · save {usd(entry.savingsCents)}</span>}
						</span>
						{coinsLeft !== null && (
							<span className="inline-flex items-center gap-0.5 text-muted-foreground">
								<TarCoin />
								{coinsLeft.toLocaleString()} left
							</span>
						)}
					</span>
					{entry && entry.gathered > 0 && (
						<span className="block text-muted-foreground">
							{entry.windows.map((row) => `${row.profileLabel} ${row.quantity}`).join(", ") +
								` · ${days(entry.parallelWindows)}`}
						</span>
					)}
					{alternate && entry.swaps.length > 0 && (
						<span className="mt-1.5 block text-muted-foreground">{swapText(entry.swaps)}</span>
					)}
				</span>
			</button>
		);
	};
	return (
		<section data-syncing={target.stale || undefined} className="group/sync w-full space-y-3">
			<div className="space-y-1.5">
				<h4 className="text-base font-semibold">Gathering target</h4>
				<p className="text-xs text-muted-foreground">
					Daily caps: PVE {GATHERING_DAILY_CAPS.PVE}, PVP {GATHERING_DAILY_CAPS.PVP}, Seasonal{" "}
					{GATHERING_DAILY_CAPS.seasonal}
					{Number.isFinite(deadline.daysLeft) && ` · ${days(deadline.daysLeft)} left`}
				</p>
			</div>
			{target.error && (
				<p role="status" className="text-xs text-warning">
					{target.error}
				</p>
			)}
			<div
				className={cn("grid grid-cols-2 gap-2 lg:grid-cols-3", syncValue)}
				role="radiogroup"
				aria-label="Gathering target"
			>
				{card(undefined)}
				{shown.map(card)}
				{pastSeason && (
					<div
						role="radio"
						aria-checked
						aria-disabled
						className="flex w-full items-start gap-2 rounded-lg bg-warning/[0.07] p-3 text-left text-xs"
					>
						<CircleCheck className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
						<span className="min-w-0 space-y-1">
							<span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
								Gather {pastSeason.gathered}
								<span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
									Past season end
								</span>
							</span>
							<span className="block text-muted-foreground">
								Needs {days(pastSeason.days)}, {days(deadline.daysLeft)} left. Gathers {selected?.gathered ?? 0} in
								time; the rest is bought.
							</span>
						</span>
					</div>
				)}
				{rest.length > 0 && (
					<button
						type="button"
						aria-expanded={more}
						onClick={() => setMore(!more)}
						className={cn(
							"h-8 self-center justify-self-start rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand",
							liftedControl,
						)}
					>
						{more ? "Show fewer" : `${rest.length} more options`}
					</button>
				)}
			</div>
		</section>
	);
}
