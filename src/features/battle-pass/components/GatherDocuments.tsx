import { FileSearch } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import { DAILY_HEADROOM, gatheringDailyCap } from "../lib/gathering-caps";
import { cashFreeGatheringPlan, type GatheringQuantity, type SavingsRoute } from "../lib/gathering-savings-model";
import { useFundingSettings } from "../useFundingSettings";
import type { GatheringTarget } from "../useGatheringTarget";
import { Disclosure } from "./ui/Disclosure";
import { DocumentIcon } from "./ui/DocumentIcon";
import { syncValue } from "./ui/field";

type Profile = { key: string; label: string; color: string };
const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

/** Documents to gather per mode for the gathering target, one column per mode. */
export function GatherDocuments({
	profiles,
	route,
	gathering,
}: {
	profiles: Profile[];
	route: SavingsRoute;
	gathering: GatheringTarget;
}) {
	const { documents } = useBattlePassData();
	const { startingTarCoins, gatheringFilters, dailyHeadroom } = useFundingSettings();
	const reserve = dailyHeadroom ? DAILY_HEADROOM : 0;
	// Without cash breakpoints there is no target to pick, so show the cash-free plan.
	const fallback = useMemo(
		() =>
			gathering.breakpoints.length ? null : cashFreeGatheringPlan(route, startingTarCoins, gatheringFilters, reserve),
		[gathering.breakpoints.length, route, startingTarCoins, gatheringFilters, reserve],
	);
	const rows: GatheringQuantity[] =
		gathering.selected?.quantities ?? [...(fallback?.modes.values() ?? [])].flatMap((mode) => mode.documents);
	const modes = profiles.map((profile) => {
		const docs = rows.filter((row) => row.profileKey === profile.key).sort((a, b) => b.quantity - a.quantity);
		const total = docs.reduce((sum, row) => sum + row.quantity, 0);
		return { ...profile, docs, total, days: Math.ceil(total / gatheringDailyCap(profile.key, reserve)) };
	});
	const name = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	return (
		<Disclosure
			title="Documents to gather"
			icon={<FileSearch className="size-4 text-brand" aria-hidden />}
			syncing={gathering.stale}
			meta={
				<span className="flex flex-wrap justify-end gap-x-3">
					{modes.map((mode) => (
						<span key={mode.key}>
							<span style={{ color: mode.color }}>{mode.label}</span>{" "}
							<strong className="tabular-nums text-foreground">{mode.total}</strong>
						</span>
					))}
				</span>
			}
		>
			<div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", syncValue)}>
				{modes.map((mode) => (
					<section key={mode.key} className="space-y-3 rounded-lg border border-border/60 p-3">
						<header className="flex items-baseline justify-between gap-2">
							<h4 className="text-sm font-semibold" style={{ color: mode.color }}>
								{mode.label}
							</h4>
							<span className="text-xs text-muted-foreground">
								<strong className="text-base tabular-nums text-foreground">{mode.total}</strong>
								{mode.total > 0 && <> · {days(mode.days)}</>}
							</span>
						</header>
						{mode.docs.length ? (
							<ul className="space-y-2">
								{mode.docs.map((row) => (
									<li key={row.documentKey} className="flex items-center gap-3">
										<DocumentIcon documentKey={row.documentKey} className="size-9 shrink-0" />
										<strong className="w-7 text-right text-lg tabular-nums">{row.quantity}</strong>
										<span className="text-sm">{name(row.documentKey)}</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-xs text-muted-foreground">Nothing to gather</p>
						)}
					</section>
				))}
			</div>
		</Disclosure>
	);
}
