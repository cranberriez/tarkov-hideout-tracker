import { Button } from "@/components/ui/button";
import { useId, useState } from "react";
import { useBattlePassData } from "../BattlePassSeason";
import { DocumentIcon } from "./ui/DocumentIcon";
import { documentDisplayName } from "../lib/battle-pass-display";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { ChevronDown, CircleAlert } from "lucide-react";
import { BALANCED_MODE } from "../lib/owner-preference-model";
import { cn } from "@/lib/utils";
import { syncValue } from "./ui/field";
import { TarCoin } from "./ui/TarCoin";

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

/** Warns when the gathering target or the cash-free finish needs more days than the season has left. */
function DeadlineWarning() {
	const { gathering, deadline, settings, modePreviews, modeCashFree } = useBattlePassPlanContext();
	const { pastSeason } = gathering;
	const { cashFreeDays, daysLeft } = deadline;
	if (!pastSeason && cashFreeDays === null) return null;
	// Suggest Balanced when it gathers faster or pays less than the current choice.
	const index = modePreviews?.modes.findIndex((mode) => mode.profileKey === BALANCED_MODE) ?? -1;
	const balanced = index >= 0 ? modePreviews!.modes[index] : undefined;
	const balancedCashFree = index >= 0 ? modeCashFree?.[index + 1] : undefined;
	const currentCashFree = modeCashFree?.[0];
	const helps =
		!!balanced &&
		!!modePreviews &&
		(balanced.preview.cashCents < modePreviews.current.cashCents ||
			balanced.preview.days < modePreviews.current.days ||
			(balancedCashFree != null && currentCashFree != null && balancedCashFree < currentCashFree));
	return (
		<div role="alert" className="flex items-start gap-2 rounded-lg bg-warning/[0.07] px-3 py-2.5 text-xs">
			<CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
			<div className="min-w-0 space-y-1">
				<p className="font-medium text-warning">
					{daysLeft === 0 ? "The season ends today." : `${days(daysLeft)} left in the season.`}
				</p>
				{pastSeason && (
					<p>
						Gathering {pastSeason.gathered} needs {days(pastSeason.days)}. The plan gathers{" "}
						{gathering.selected?.gathered ?? 0} in time and buys the rest.
					</p>
				)}
				{cashFreeDays !== null && <p>A cash-free finish needs {days(cashFreeDays)}.</p>}
				{helps && settings.preferredMode !== BALANCED_MODE && (
					<p className="flex flex-wrap items-center gap-x-2">
						Balanced spreads gathering so the modes finish together.
						<Button size="xs" variant="ghost" tone="brand" onClick={() => settings.setPreferredMode(BALANCED_MODE)}>
							Use Balanced
						</Button>
					</p>
				)}
			</div>
		</div>
	);
}

export function RouteSummary() {
	const typesId = useId();
	const [showTypes, setShowTypes] = useState(false);
	const { route: shownRoute, gathering, leftover, deadline } = useBattlePassPlanContext();
	const route = shownRoute!;
	const plan = gathering.cashFree;
	const { documents } = useBattlePassData();
	const byType = new Map<string, number>();
	for (const claim of route.claims)
		for (const [key, count] of Object.entries(claim.cost)) byType.set(key, (byType.get(key) ?? 0) + count);
	const ordinary = Object.values(route.stock).reduce((sum, count) => sum + count, 0);
	const owned = ordinary + route.classifiedUsed;
	const total = owned + route.additionalClassified;
	const percent = total ? Math.round((100 * owned) / total) : 0;
	const firstShortfall = route.claims.findIndex((claim) => !claim.possibleNow || claim.classifiedUsed > 0);
	const ordinaryClaims = firstShortfall < 0 ? route.claims.length : firstShortfall;
	return (
		<div className="space-y-2">
			<DeadlineWarning />
			<dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
				<div className="col-span-2 flex flex-col gap-4 rounded-lg bg-brand/[0.07] p-4 lg:row-span-2">
					<div className="flex items-start justify-between gap-2">
						<dt className="text-sm font-medium text-muted-foreground">Documents needed</dt>
						{total > 0 && (
							<Button
								size="xs"
								variant="ghost"
								tone="brand"
								className="-mt-1 -mr-2"
								aria-expanded={showTypes}
								aria-controls={typesId}
								onClick={() => setShowTypes((open) => !open)}
							>
								By type
								<ChevronDown className={cn("size-3.5 transition-transform", showTypes && "rotate-180")} aria-hidden />
							</Button>
						)}
					</div>
					{total > 0 && (
						<dd id={typesId} hidden={!showTypes} className={syncValue}>
							<ul className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
								{[...byType].map(([key, count]) => (
									<li key={key} className="flex items-center gap-1.5">
										<DocumentIcon documentKey={key} className="size-5 shrink-0" />
										<strong className="tabular-nums">{count}</strong>
										{documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key)}
									</li>
								))}
							</ul>
						</dd>
					)}
					<dd className={cn("mt-auto space-y-3", syncValue)}>
						<span className="block text-4xl font-semibold leading-none tracking-tight tabular-nums">
							{total.toLocaleString()}
						</span>
						<div className="space-y-1.5 text-xs">
							<div className="flex justify-between gap-2">
								<span>
									{owned.toLocaleString()} covered by inventory{" "}
									<span className="text-muted-foreground">
										({ordinary} ordinary, {route.classifiedUsed} classified)
									</span>
									{leftover && leftover.gathered > 0 && (
										<span className="block text-muted-foreground">
											{leftover.gathered.toLocaleString()} more gathered at your target
										</span>
									)}
								</span>
								<strong>{percent}%</strong>
							</div>
							<div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-highlight/10">
								<div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
							</div>
						</div>
					</dd>
				</div>
				<div
					data-syncing={gathering.stale || undefined}
					className="group/sync flex flex-col gap-3 rounded-lg bg-surface-raised/40 p-3"
				>
					<dt className="text-xs text-muted-foreground">Classified to buy</dt>
					<dd className={cn("mt-auto", syncValue)}>
						<span className="block text-2xl font-semibold leading-none tabular-nums text-classified">
							{leftover?.classifiedToBuy ?? route.additionalClassified}
						</span>
						{leftover && leftover.gathered > 0 && (
							<span className="mt-1 block text-xs text-muted-foreground">
								{route.additionalClassified} before gathering {leftover.gathered}
							</span>
						)}
					</dd>
				</div>
				<div className="flex flex-col gap-3 rounded-lg bg-surface-raised/40 p-3">
					<dt className="text-xs text-muted-foreground">Claims before using classified</dt>
					<dd className={cn("mt-auto", syncValue)}>
						<span className="text-2xl font-semibold leading-none tabular-nums">
							{ordinaryClaims}
							<span className="text-sm font-normal text-muted-foreground"> / {route.claims.length}</span>
						</span>
						{route.possibleNow > ordinaryClaims && (
							<span className="block text-xs text-muted-foreground">{route.possibleNow} with owned classified</span>
						)}
					</dd>
				</div>
				<div
					data-syncing={gathering.stale || undefined}
					className="group/sync col-span-2 flex flex-col gap-3 rounded-lg bg-surface-raised/40 p-3"
				>
					<dt className="text-xs text-muted-foreground">Fastest cash-free finish</dt>
					<dd className={cn("mt-auto flex flex-wrap items-end justify-between gap-2", syncValue)}>
						{plan === undefined ? (
							<span className="text-sm text-muted-foreground">Calculating…</span>
						) : plan && plan.days > 0 ? (
							<span className="flex flex-wrap items-baseline gap-x-3">
								<strong className="text-lg leading-none">
									{plan.days} gathering {plan.days === 1 ? "day" : "days"}
								</strong>
								<span className="text-sm text-muted-foreground">
									{plan.total} {plan.total === 1 ? "document" : "documents"}
								</span>
								{deadline.cashFreeDays !== null && <span className="text-sm text-warning">Past season end</span>}
							</span>
						) : (
							<strong>{plan ? "No gathering needed" : "Unavailable with selected filters"}</strong>
						)}
					</dd>
				</div>
			</dl>
			{leftover && (
				<dl
					aria-label="Left over after the route"
					data-syncing={gathering.stale || undefined}
					className="group/sync grid grid-cols-2 gap-2"
				>
					<div className="flex flex-col gap-3 rounded-lg bg-classified/[0.07] p-3">
						<dt className="text-xs text-muted-foreground">Classified documents left over</dt>
						<dd className={cn("mt-auto", syncValue)}>
							<span className="block text-2xl font-semibold leading-none tabular-nums text-classified">
								{leftover.classified.toLocaleString()}
							</span>
							<span className="mt-1 block text-xs text-muted-foreground">
								{leftover.ownedClassified} owned unused · {leftover.spareClassified} spare from packs
							</span>
						</dd>
					</div>
					<div className="flex flex-col gap-3 rounded-lg bg-amber-400/[0.06] p-3">
						<dt className="text-xs text-muted-foreground">TarCoins left over</dt>
						<dd className={cn("mt-auto", syncValue)}>
							<span className="flex items-center text-2xl font-semibold leading-none tabular-nums">
								{leftover.tarCoins.toLocaleString()}
								<TarCoin />
							</span>
							<span className="mt-1 block text-xs text-muted-foreground">
								After paying ${(leftover.cashCents / 100).toFixed(2)}, gathering {gathering.selected?.gathered ?? 0}
							</span>
						</dd>
					</div>
				</dl>
			)}
		</div>
	);
}
