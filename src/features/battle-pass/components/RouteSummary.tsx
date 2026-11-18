import { Button } from "@/components/ui/button";
import { useId, useMemo, useState } from "react";
import { useBattlePassData } from "../BattlePassSeason";
import { DocumentIcon } from "./ui/DocumentIcon";
import { documentDisplayName } from "../lib/battle-pass-display";
import { useFundingSettings } from "../useFundingSettings";
import { cashFreeGatheringPlan, type SavingsRoute } from "../lib/gathering-savings-model";

export function RouteSummary({ route }: { route: SavingsRoute }) {
	const panelId = useId();
	const [showDocuments, setShowDocuments] = useState(false);
	const { startingTarCoins, gatheringFilters } = useFundingSettings();
	const plan = useMemo(
		() => cashFreeGatheringPlan(route, startingTarCoins, gatheringFilters),
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
		<>
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
					<dd className="mt-1 flex flex-wrap items-center justify-between gap-2">
						{plan && plan.days > 0 ? (
							<>
								<span>
									<strong>
										{plan.days} gathering {plan.days === 1 ? "day" : "days"}
									</strong>{" "}
									· {plan.total} {plan.total === 1 ? "document" : "documents"}
								</span>
								<Button
									size="xs"
									aria-expanded={showDocuments}
									aria-controls={panelId}
									onClick={() => setShowDocuments((open) => !open)}
								>
									{showDocuments ? "Hide documents" : "Show documents"}
								</Button>
							</>
						) : (
							<strong>{plan ? "No gathering needed" : "Unavailable with selected filters"}</strong>
						)}
					</dd>
				</div>
			</dl>
			{plan && plan.days > 0 && (
				<section
					id={panelId}
					hidden={!showDocuments}
					aria-label="Cash-free gathering plan"
					className="rounded-lg border border-border bg-surface-raised/50 p-3"
				>
					<h3 className="mb-1 text-sm font-semibold">Documents to gather</h3>
					<p className="mb-3 text-xs text-muted-foreground">
						Gather these totals across the listed days. Modes run in parallel at their full daily caps.
					</p>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{[...plan.modes].map(([key, mode]) => (
							<section key={key}>
								<h3 className="mb-1 text-sm font-semibold">{mode.label}</h3>
								<ul className="space-y-1 text-xs">
									{mode.documents.map((row) => (
										<li key={row.documentKey} className="flex items-center gap-1.5">
											<DocumentIcon documentKey={row.documentKey} className="size-5 shrink-0" />
											<strong className="tabular-nums">{row.quantity}</strong>
											{documentDisplayName(
												documents.find((doc) => doc.key === row.documentKey)?.name ?? row.documentKey,
											)}
										</li>
									))}
								</ul>
							</section>
						))}
					</div>
				</section>
			)}
		</>
	);
}
