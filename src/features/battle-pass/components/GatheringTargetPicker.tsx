import { Circle, CircleCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RouteEntry } from "../lib/alternate-entries-model";
import { packTarCoins, type GatheringBreakpoint } from "../lib/gathering-savings-model";
import type { Tile } from "../lib/battle-pass-model";
import { rewardTarCoins } from "../lib/funding-model";
import { DAILY_HEADROOM, gatheringDailyCap } from "../lib/gathering-caps";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { liftedControl, syncValue } from "./ui/field";
import { TarCoin } from "./ui/TarCoin";
import { Toggle } from "./ui/Toggle";

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
	const { gathering: target, deadline, settings } = useBattlePassPlanContext();
	const [more, setMore] = useState(false);
	const { entries, activeEntry, suggested, baselineCents, pastSeason, selected } = target;
	const headroom = (
		<Toggle
			indicator
			className="w-fit"
			checked={settings.dailyHeadroom}
			onChange={settings.setDailyHeadroom}
			title={`Near the daily limit raids spawn far fewer documents. Plans each mode ${DAILY_HEADROOM} below its cap (PVE ${gatheringDailyCap("PVE", DAILY_HEADROOM)}, PVP ${gatheringDailyCap("PVP", DAILY_HEADROOM)}, seasonal ${gatheringDailyCap("seasonal", DAILY_HEADROOM)}). Changes days, not cost.`}
		>
			Leave {DAILY_HEADROOM} unplanned per day
		</Toggle>
	);
	// Restricted purchases fix the gathering: there is nothing to choose, only what it takes.
	if (target.purchases !== "cash") {
		const { restricted } = target;
		return (
			<section data-syncing={target.stale || undefined} className="group/sync w-full space-y-3">
				<h4 className="text-base font-semibold">Gathering target</h4>
				{target.error ? (
					<p role="status" className="text-xs text-warning">
						{target.error}
					</p>
				) : !restricted || !selected ? (
					<div
						className="h-[52px] animate-pulse rounded-lg bg-surface-raised/60"
						role="status"
						aria-label="Calculating gathering"
					/>
				) : restricted.options ? (
					<TarCoinOptions />
				) : (
					<div className={cn("space-y-1 rounded-lg bg-surface-raised/40 px-3 py-2.5 text-xs", syncValue)}>
						<p className="text-sm font-semibold">
							{selected.gathered > 0 ? `Gather ${selected.gathered}` : "No gathering needed"}
							{selected.gathered > 0 && (
								<span className="font-normal text-muted-foreground"> · {days(restricted.days)}</span>
							)}
						</p>
						{selected.gathered > 0 && (
							<p className="text-muted-foreground">
								{selected.windows.map((row) => `${row.profileLabel} ${row.quantity}`).join(", ")}
							</p>
						)}
						<p className="text-muted-foreground">
							{target.purchases === "none"
								? "Buying is off: gather what owned documents do not cover."
								: "TarCoins are not bought: gather until TarCoins you hold or earn cover the classified documents."}
						</p>
						{restricted.blocked > 0 && (
							<p role="alert" className="text-warning">
								{restricted.blocked} classified still {target.purchases === "none" ? "needed" : "need cash"}: gathering
								is off for some of the documents. Turn them on under Advanced or allow{" "}
								{target.purchases === "none" ? "buying classified" : "buying TarCoins"}.
							</p>
						)}
					</div>
				)}
				{headroom}
			</section>
		);
	}
	const { steps } = target;
	// No cash breakpoints: no gathering already pays the least, so the TarCoin steps (from no gathering) are the list.
	const cashList = baselineCents !== null && !!entries?.length;
	if (!cashList && !steps.length) {
		if (target.calculating || target.error)
			return (
				<section className="w-full space-y-3" aria-busy={!target.error || undefined}>
					<h4 className="text-base font-semibold">Gathering target</h4>
					{target.error ? (
						<p role="status" className="text-xs text-warning">
							{target.error}
						</p>
					) : (
						// Rows hold the list's space so it does not push the sections below down when it arrives.
						<div className="space-y-2" role="status" aria-label="Calculating gathering options">
							{[0, 1, 2, 3].map((row) => (
								<div key={row} className="h-[52px] animate-pulse rounded-lg bg-surface-raised/60" />
							))}
						</div>
					)}
				</section>
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
	// TarCoin steps keep the first (no gathering without a cash list), the last and the chosen one in view.
	const pinnedSteps = steps.filter(
		(step, index) => (!cashList && index === 0) || index === steps.length - 1 || step === selected,
	);
	// Hiding only one or two options is not worth a button.
	const hidden = [
		...entries.filter((entry) => !pinned.includes(entry)),
		...steps.filter((step) => !pinnedSteps.includes(step)),
	];
	const rest = hidden.length > MAX_REVEALED_INLINE ? hidden : [];
	const shown = more || !rest.length ? entries : pinned;
	const shownSteps = more || !rest.length ? steps : pinnedSteps;
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
					"group animate-in fade-in duration-200 motion-reduce:animate-none flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 text-left text-xs focus-visible:outline-2 focus-visible:outline-brand sm:col-span-full sm:grid sm:items-center sm:[grid-template-columns:subgrid]",
					liftedControl,
					active &&
						"bg-[color-mix(in_oklab,var(--brand)_4%,var(--surface-raised))] hover:bg-[color-mix(in_oklab,var(--brand)_7%,var(--surface-raised))]",
				)}
			>
				<Check
					className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")}
					aria-hidden
				/>
				<span className="min-w-0 space-y-0.5 max-sm:basis-[calc(100%-1.75rem)]">
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
					{entry && entry.gathered > 0 && (
						<span className="block text-muted-foreground">
							{entry.windows.map((row) => `${row.profileLabel} ${row.quantity}`).join(", ") +
								` · ${days(entry.parallelWindows)}`}
						</span>
					)}
					{alternate && entry.swaps.length > 0 && (
						<span className="block text-muted-foreground">{swapText(entry.swaps)}</span>
					)}
				</span>
				<span className="tabular-nums max-sm:ml-7">Pay {usd(entry ? entry.cashCents : (baselineCents ?? 0))}</span>
				<span className="tabular-nums text-success">{entry ? `save ${usd(entry.savingsCents)}` : ""}</span>
				<span className="inline-flex items-center gap-0.5 tabular-nums text-muted-foreground sm:justify-end">
					{coinsLeft !== null && (
						<>
							<TarCoin />
							{coinsLeft.toLocaleString()} left
						</>
					)}
				</span>
			</button>
		);
	};
	return (
		<section data-syncing={target.stale || undefined} className="group/sync w-full space-y-3">
			<h4 className="text-base font-semibold">Gathering target</h4>
			{target.error && (
				<p role="status" className="text-xs text-warning">
					{target.error}
				</p>
			)}
			<div
				className={cn("grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]", syncValue)}
				role="radiogroup"
				aria-label="Gathering target"
			>
				{cashList && card(undefined)}
				{cashList && shown.map(card)}
				{shownSteps.map((step) => (
					<StepRow
						key={`step:${step.gathered}`}
						option={step}
						active={step.gathered === 0 ? !activeEntry : step === selected}
						cashAllowed
						onSelect={() => (step.gathered === 0 ? target.selectEntry(0, 0) : target.select(step.gathered))}
					/>
				))}
				{pastSeason && (
					<div
						role="radio"
						aria-checked
						aria-disabled
						className="flex w-full items-start gap-2 rounded-lg bg-warning/[0.07] p-3 text-left text-xs sm:col-span-full"
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
							"h-8 justify-self-start rounded-md px-3 sm:col-span-full text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand",
							liftedControl,
						)}
					>
						{more ? "Show fewer" : `${rest.length} more options`}
					</button>
				)}
			</div>
			{headroom}
		</section>
	);
}

/** One gathering amount and what it buys. Purchase details show only when the amount buys something;
 * `cashAllowed` false marks amounts that still need cash as unavailable. */
function StepRow({
	option,
	active,
	onSelect,
	cashAllowed,
}: {
	option: GatheringBreakpoint;
	active: boolean;
	onSelect: () => void;
	cashAllowed: boolean;
}) {
	const { deadline } = useBattlePassPlanContext();
	const needsCash = option.cashCents > 0;
	const disabled = needsCash && !cashAllowed;
	const late = option.parallelWindows > deadline.daysLeft;
	const bought = option.plan.totalDocuments;
	const spent = packTarCoins(option.plan);
	const purchases = bought > 0 || needsCash;
	const Check = active ? CircleCheck : Circle;
	return (
		<button
			type="button"
			role="radio"
			aria-checked={active}
			disabled={disabled}
			title={disabled ? "Needs TarCoins bought with cash, which is off." : undefined}
			onClick={onSelect}
			className={cn(
				"group animate-in fade-in duration-200 motion-reduce:animate-none flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 text-left text-xs focus-visible:outline-2 focus-visible:outline-brand sm:col-span-full sm:grid sm:items-center sm:[grid-template-columns:subgrid]",
				liftedControl,
				disabled && "pointer-events-none opacity-50",
				active &&
					"bg-[color-mix(in_oklab,var(--brand)_4%,var(--surface-raised))] hover:bg-[color-mix(in_oklab,var(--brand)_7%,var(--surface-raised))]",
			)}
		>
			<Check
				className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")}
				aria-hidden
			/>
			<span className="min-w-0 space-y-0.5 max-sm:basis-[calc(100%-1.75rem)]">
				<span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
					{option.gathered > 0 ? `Gather ${option.gathered}` : "No gathering"}
					{late && (
						<span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
							Past season end
						</span>
					)}
				</span>
				{option.gathered > 0 && (
					<span className="block text-muted-foreground">
						{option.windows.map((entry) => `${entry.profileLabel} ${entry.quantity}`).join(", ") +
							` · ${days(option.parallelWindows)}`}
					</span>
				)}
			</span>
			<span className={cn("tabular-nums max-sm:ml-7", bought > 0 ? "text-classified" : "text-success")}>
				{bought > 0 ? `Buy ${bought} classified` : purchases ? "" : "No purchases"}
			</span>
			<span className={cn("inline-flex items-center gap-0.5 tabular-nums", disabled && "text-warning")}>
				{needsCash ? (
					`${cashAllowed ? "Pay" : "Needs"} ${usd(option.cashCents)}`
				) : spent > 0 ? (
					<>
						<TarCoin />
						{spent.toLocaleString()} spent
					</>
				) : null}
			</span>
			<span className="inline-flex items-center gap-0.5 tabular-nums text-muted-foreground sm:justify-end">
				{purchases && (
					<>
						<TarCoin />
						{option.plan.balanceTarCoins.toLocaleString()} left
					</>
				)}
			</span>
		</button>
	);
}

/** Without cash purchases: no gathering up to gathering everything, each step
 * buying fewer classified with TarCoins. Options that would still need cash are shown but disabled. */
function TarCoinOptions() {
	const { gathering: target } = useBattlePassPlanContext();
	const [more, setMore] = useState(false);
	const { restricted, selected } = target;
	const options = restricted!.options!;
	const firstFree = options.find((option) => option.cashCents === 0);
	const pinned = options.filter(
		(option, index) => index === 0 || option === firstFree || option === selected || index === options.length - 1,
	);
	const hidden = options.length - pinned.length;
	const rest = hidden > MAX_REVEALED_INLINE;
	const shown = more || !rest ? options : pinned;
	return (
		<div className="space-y-2">
			<div
				className={cn("grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]", syncValue)}
				role="radiogroup"
				aria-label="Gathering target"
			>
				{shown.map((option) => (
					<StepRow
						key={option.gathered}
						option={option}
						active={option === selected}
						cashAllowed={false}
						onSelect={() => target.select(option.gathered)}
					/>
				))}
				{rest && (
					<button
						type="button"
						aria-expanded={more}
						onClick={() => setMore(!more)}
						className={cn(
							"h-8 justify-self-start rounded-md px-3 sm:col-span-full text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand",
							liftedControl,
						)}
					>
						{more ? "Show fewer" : `${hidden} more options`}
					</button>
				)}
			</div>
			{restricted!.blocked > 0 && (
				<p role="alert" className="text-xs text-warning">
					{restricted!.blocked} classified still need cash: gathering is off for some of the documents. Turn them on
					under Advanced or allow buying TarCoins.
				</p>
			)}
		</div>
	);
}
