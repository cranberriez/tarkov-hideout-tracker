import Link from "next/link";
import { itemHref } from "@/lib/entity-routes";
import { formatRoubles } from "@/lib/utils/market-price";
import type { MarketMoverRow, MarketWorkerDashboard } from "@/server/db/postgres-dashboard";

function timestamp(value: number | null | undefined) {
	return value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "Never";
}

function age(value: number | null | undefined, now: number) {
	if (!value) return "";
	const minutes = Math.round((now - value) / 60_000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return hours < 48 ? `${hours}h ${minutes % 60}m ago` : `${Math.floor(hours / 24)}d ago`;
}

function percent(value: number | null, signed = true) {
	if (value === null) return "–";
	const formatted = `${(value * 100).toFixed(1)}%`;
	return signed && value > 0 ? `+${formatted}` : formatted;
}

function tally(counts: Record<string, number>, labels: Record<string, string>) {
	return (
		Object.entries(labels)
			.filter(([key]) => counts[key])
			.map(([key, label]) => `${label} ${counts[key]}`)
			.join(" · ") || "–"
	);
}

function numberField(summary: Record<string, unknown> | null, key: string) {
	const value = summary?.[key];
	return typeof value === "number" ? value.toLocaleString("en-US") : "–";
}

export function MarketWorkerPanel({ dashboard, modeValue }: { dashboard: MarketWorkerDashboard; modeValue: string }) {
	const { refresh, analytics, loadedAt: now } = dashboard;
	const summary = refresh?.summary ?? null;
	const source = summary?.source === "worker" ? "market-analyzer worker" : summary ? "Vercel cron / CLI" : "–";
	return (
		<section className="space-y-5 rounded-xl border border-border bg-card p-5">
			<header className="space-y-1">
				<h2 className="font-semibold">Market worker</h2>
				<p className="text-sm text-muted-foreground">
					Latest price push and derived analytics. Trigger steps now with{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-xs">
						docker compose exec market-analyzer node dist/worker.cjs run-now {modeValue}:analyze
					</code>
				</p>
			</header>

			<div className="space-y-2">
				<h3 className="text-sm font-semibold">Latest price push</h3>
				{refresh ? (
					<dl className="grid gap-4 text-sm sm:grid-cols-4">
						<div>
							<dt className="text-muted-foreground">Completed</dt>
							<dd>
								{timestamp(refresh.lastCompletedAt)}{" "}
								<span className="text-muted-foreground">{age(refresh.lastCompletedAt, now)}</span>
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Status · source</dt>
							<dd>
								{String(summary?.status ?? "–")} · {source}
								{refresh.leaseActive && <span className="text-warning"> · running now</span>}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Prices written · failures</dt>
							<dd>
								{numberField(summary, "changedCount")} · {numberField(summary, "failedCount")}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Checks · excluded · catalog</dt>
							<dd>
								{numberField(summary, "checkedCount")} · {numberField(summary, "excludedCount")} ·{" "}
								{String(summary?.catalogPriceStatus ?? "–")}
							</dd>
						</div>
					</dl>
				) : (
					<p className="text-sm text-muted-foreground">No price refresh has run for this mode.</p>
				)}
			</div>

			{!analytics.available ? (
				<p role="alert" className="rounded-lg border border-warning p-3 text-sm text-warning">
					{analytics.reason}
				</p>
			) : (
				<>
					<div className="space-y-2">
						<h3 className="text-sm font-semibold">
							Analysis runs{" "}
							<span className="font-normal text-muted-foreground">
								· {analytics.observationCount.toLocaleString("en-US")} observations for{" "}
								{analytics.itemCount.toLocaleString("en-US")} items
							</span>
						</h3>
						{analytics.runs.length ? (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="text-muted-foreground">
										<tr>
											<th className="py-1 pr-4 font-medium">Started</th>
											<th className="py-1 pr-4 font-medium">Status</th>
											<th className="py-1 pr-4 font-medium">Observations</th>
											<th className="py-1 pr-4 font-medium">Unchanged · uncached</th>
											<th className="py-1 pr-4 font-medium">Trend</th>
											<th className="py-1 font-medium">Confidence</th>
										</tr>
									</thead>
									<tbody>
										{analytics.runs.map((run) => (
											<tr key={run.runId} className="border-t border-border">
												<td className="py-1 pr-4 whitespace-nowrap">
													{timestamp(run.startedAt)}{" "}
													<span className="text-muted-foreground">{age(run.startedAt, now)}</span>
												</td>
												<td className="py-1 pr-4">{run.status}</td>
												<td className="py-1 pr-4">{run.analyzedCount.toLocaleString("en-US")}</td>
												<td className="py-1 pr-4">
													{run.unchangedCount.toLocaleString("en-US")} · {run.missingCount.toLocaleString("en-US")}
												</td>
												<td className="py-1 pr-4 whitespace-nowrap">
													{tally(run.trend, { rising: "↑", falling: "↓", stable: "→", unknown: "?" })}
												</td>
												<td className="py-1 whitespace-nowrap">
													{tally(run.confidence, { high: "high", medium: "med", low: "low" })}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">No analysis has run for this mode yet.</p>
						)}
					</div>

					<MoversTable title="Biggest rouble moves" movers={analytics.moversByRub} />
					<MoversTable title="Biggest % moves" movers={analytics.moversByPercent} />
				</>
			)}
		</section>
	);
}

function signedRoubles(value: number | null) {
	if (value === null) return "–";
	return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatRoubles(Math.abs(value))}`;
}

function compact(value: number | null) {
	if (value === null) return "?";
	return value >= 1_000_000
		? `${(value / 1_000_000).toFixed(1)}m`
		: value >= 1_000
			? `${Math.round(value / 1_000)}k`
			: String(value);
}

/** e.g. "retracing · 2k→18k, 56% back" */
function shockLabel(mover: MarketMoverRow) {
	if (!mover.shockPhase) return "–";
	const back = mover.retracement === null ? "" : `, ${Math.round(mover.retracement * 100)}% back`;
	return `${mover.shockPhase} · ${compact(mover.shockBaseline)}→${compact(mover.shockExtreme)}${back}`;
}

function MoversTable({ title, movers }: { title: string; movers: MarketMoverRow[] }) {
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-semibold">
				{title}{" "}
				<span className="font-normal text-muted-foreground">
					· 24h, latest observation per item · depth ≥ 3, move larger than the flea fee, not low confidence
				</span>
			</h3>
			{movers.length ? (
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="text-muted-foreground">
							<tr>
								<th className="py-1 pr-4 font-medium">Item</th>
								<th className="py-1 pr-4 text-right font-medium">Current</th>
								<th className="py-1 pr-4 text-right font-medium">Market value</th>
								<th className="py-1 pr-4 text-right font-medium">24h ₽</th>
								<th className="py-1 pr-4 text-right font-medium">24h</th>
								<th className="py-1 pr-4 text-right font-medium">× fee</th>
								<th className="py-1 pr-4 text-right font-medium">Last 12h</th>
								<th className="py-1 pr-4 font-medium">Shock</th>
								<th className="py-1 pr-4 text-right font-medium">7d</th>
								<th className="py-1 pr-4 text-right font-medium">Depth</th>
								<th className="py-1 font-medium">Confidence</th>
							</tr>
						</thead>
						<tbody>
							{movers.map((mover) => (
								<tr key={mover.itemId} className="border-t border-border">
									<td className="py-1 pr-4">
										<Link href={itemHref(mover.itemId)} className="text-brand hover:underline">
											{mover.name}
										</Link>
									</td>
									<td className="py-1 pr-4 text-right whitespace-nowrap">{formatRoubles(mover.currentLevel)}</td>
									<td className="py-1 pr-4 text-right whitespace-nowrap">{formatRoubles(mover.marketValue)}</td>
									<td
										className={`py-1 pr-4 text-right whitespace-nowrap ${(mover.change24hRub ?? 0) >= 0 ? "text-success" : "text-danger"}`}
									>
										{signedRoubles(mover.change24hRub)}
									</td>
									<td className="py-1 pr-4 text-right">{percent(mover.change24h)}</td>
									<td className="py-1 pr-4 text-right">
										{mover.fleaFee && mover.change24hRub !== null
											? `${(Math.abs(mover.change24hRub) / mover.fleaFee).toFixed(1)}×`
											: "–"}
									</td>
									<td className={`py-1 pr-4 text-right ${(mover.move12h ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
										{percent(mover.move12h)}
									</td>
									<td className="py-1 pr-4 whitespace-nowrap">{shockLabel(mover)}</td>
									<td className="py-1 pr-4 text-right">{percent(mover.change7d)}</td>
									<td className="py-1 pr-4 text-right">{mover.depthMedian24h ?? "–"}</td>
									<td className="py-1">{mover.confidence}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">No moves with enough evidence yet.</p>
			)}
		</div>
	);
}
