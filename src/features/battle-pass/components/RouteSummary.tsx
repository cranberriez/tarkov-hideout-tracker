import { useMemo } from "react";
import { useBattlePassData } from "../BattlePassSeason";
import { DocumentIcon } from "./ui/DocumentIcon";
import { documentDisplayName } from "../lib/battle-pass-display";
import { useFundingSettings } from "../useFundingSettings";
import { minimumFreeGatheringDays, type SavingsRoute } from "../lib/gathering-savings-model";

export function RouteSummary({ route }: { route: SavingsRoute }) {
	const { startingTarCoins, gatheringFilters } = useFundingSettings();
	const days = useMemo(
		() => minimumFreeGatheringDays(route, startingTarCoins, gatheringFilters),
		[route, startingTarCoins, gatheringFilters],
	);
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
		<dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
			<div className="col-span-2 rounded-lg border border-brand/25 bg-brand/5 p-4 lg:row-span-2">
				<dt className="text-sm font-medium">Documents needed</dt>
				<dd className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{total.toLocaleString()}</dd>
				<dd className="mt-4 space-y-1.5 text-xs">
					<div className="flex justify-between gap-2">
						<span>{owned.toLocaleString()} covered by inventory</span>
						<strong>{percent}%</strong>
					</div>
					<div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
						<div className="h-full bg-brand" style={{ width: `${percent}%` }} />
					</div>
					<p className="text-muted-foreground">
						{ordinary} ordinary · {route.classifiedUsed} classified
					</p>
					{total > 0 && (
						<details className="mt-3">
							<summary className="cursor-pointer font-medium">Needed by document type</summary>
							<ul className="mt-2 grid gap-y-1 sm:grid-cols-2">
								{[...byType].map(([key, count]) => (
									<li key={key} className="flex items-center gap-1">
										<DocumentIcon documentKey={key} className="size-5 shrink-0" />
										<strong>{count}</strong>{" "}
										{documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key)}
									</li>
								))}
							</ul>
						</details>
					)}
				</dd>
			</div>
			<div className="rounded-lg border border-border p-3">
				<dt className="text-xs text-muted-foreground">Additional classified needed</dt>
				<dd className="text-2xl font-semibold tabular-nums text-classified">{route.additionalClassified}</dd>
			</div>
			<div className="rounded-lg border border-border p-3">
				<dt className="text-xs text-muted-foreground">Claims before using classified</dt>
				<dd className="text-2xl font-semibold tabular-nums">
					{ordinaryClaims}
					<span className="text-sm font-normal text-muted-foreground"> / {route.claims.length}</span>
				</dd>
				{route.possibleNow > ordinaryClaims && (
					<dd className="text-xs text-muted-foreground">{route.possibleNow} with owned classified</dd>
				)}
			</div>
			<div className="col-span-2 rounded-lg border border-border bg-surface-raised/50 p-3">
				<dt className="text-xs text-muted-foreground">Fastest cash-free finish</dt>
				<dd className="font-semibold">
					{days === null
						? "Unavailable with selected filters"
						: days === 0
							? "No gathering needed"
							: `${days} gathering ${days === 1 ? "day" : "days"}`}
				</dd>
				<dd className="mt-1 text-xs text-muted-foreground">
					For this claim order, using your wallet, claim rewards and full daily gathering caps.
				</dd>
			</div>
		</dl>
	);
}
