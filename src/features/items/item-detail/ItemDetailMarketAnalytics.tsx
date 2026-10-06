"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { traderInfo } from "@/lib/data/traders";
import { cn } from "@/lib/utils";
import { formatCompactRoubles, formatRoubles } from "@/lib/utils/market-price";
import { describeMarketTiming } from "@/lib/utils/market-timing";
import { formatRelativeUpdatedAt, formatUpdatedAt } from "@/lib/utils/format-time";
import { getItemSellComparison } from "@/lib/price-calculation/prices";
import type { ItemMarketAnalytics } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";
import { marketAnalyticsQueryOptions } from "./market-analytics-query";

const EMPTY = "–";

function roubles(value: number | null) {
	return value == null ? EMPTY : formatRoubles(Math.round(value));
}

function signedRoubles(value: number | null) {
	return value == null ? EMPTY : `${value > 0 ? "+" : ""}${formatRoubles(Math.round(value))}`;
}

function percent(value: number | null, { signed = true } = {}) {
	if (value == null) return EMPTY;
	const amount = value * 100;
	return `${signed && amount > 0 ? "+" : ""}${amount.toFixed(Math.abs(amount) < 10 ? 1 : 0)}%`;
}

function hours(value: number | null) {
	if (value == null) return EMPTY;
	return value >= 48 ? `${Math.round(value / 24)} days` : `${Math.round(value)} h`;
}

const REASON_LABELS: Record<string, string> = {
	stale: "stale",
	"no-offers": "no offers",
	"short-history": "short history",
	"no-recent-listings": "no recent listings",
	"unknown-depth": "unknown depth",
	"thin-listings": "thin listings",
	volatile: "volatile",
	"unconfirmed-move": "unconfirmed move",
	"above-max-net": "above max-net price",
	"recent-regime-change": "recent price change",
	"thin-large-move": "large move on thin listings",
};

interface ItemDetailMarketAnalyticsProps {
	itemId: string;
	mode: TarkovJsonGameMode;
	/** The item with its current price; the summary compares that price with the stored levels. */
	item?: ItemSummary;
}

/** The market analyzer's latest stored observation for one item. */
export function ItemDetailMarketAnalytics({ itemId, mode, item }: ItemDetailMarketAnalyticsProps) {
	const query = useQuery(marketAnalyticsQueryOptions(itemId, mode));

	if (query.error) {
		return (
			<div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
				<p className="text-sm text-muted-foreground">Market analytics are temporarily unavailable.</p>
				<button
					type="button"
					onClick={() => void query.refetch()}
					className="flex items-center gap-2 rounded-md border border-border-color px-3 py-2 text-xs text-foreground hover:bg-highlight/5"
				>
					<RefreshCw size={12} /> Try again
				</button>
			</div>
		);
	}
	if (query.data === undefined) {
		return <p className="px-4 py-6 text-sm text-muted-foreground">Loading market analytics…</p>;
	}
	if (query.data === null) {
		return (
			<div className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
				No market analytics for this item yet. The analyzer covers items with flea history in this mode.
			</div>
		);
	}
	return <AnalyticsView analytics={query.data} item={item} />;
}

function AnalyticsView({ analytics: a, item }: { analytics: ItemMarketAnalytics; item?: ItemSummary }) {
	const trader = a.traderId ? traderInfo(a.traderId).name : null;
	return (
		<div className="space-y-4 p-3 sm:p-4">
			<AnalyticsSummary analytics={a} item={item} />
			<div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
				<span title={formatUpdatedAt(a.calculatedAt) ?? undefined}>
					Analyzed {formatRelativeUpdatedAt(a.calculatedAt) ?? EMPTY}
				</span>
				<span className={a.confidence === "low" ? "text-warning" : "text-foreground/80"}>
					{a.confidence[0].toUpperCase() + a.confidence.slice(1)} confidence
				</span>
				{a.confidenceReasons.length > 0 && (
					<span>{a.confidenceReasons.map((reason) => REASON_LABELS[reason] ?? reason).join(" · ")}</span>
				)}
			</div>

			<AnalyticsSection title="Price level">
				<Fact label="Market value" hint="The site's robust current flea estimate when analyzed">
					{roubles(a.marketValue)}
				</Fact>
				<Fact label="Current level" hint="Median of the last three snapshots">
					{roubles(a.currentLevel)}
				</Fact>
				<Fact label="Typical (7-day median)">{roubles(a.median7d)}</Fact>
				<Fact label="7-day range" hint="10th–90th percentile of the last 7 days: the recent normal range">
					{a.rangeLow7d == null || a.rangeHigh7d == null
						? EMPTY
						: `${roubles(a.rangeLow7d)} – ${roubles(a.rangeHigh7d)}`}
				</Fact>
				<Fact label="24-hour median">{roubles(a.median24h)}</Fact>
				<Fact label="30-day median">{roubles(a.median30d)}</Fact>
				<Fact label="30-day position" hint="Share of the last 30 days spent below the market value">
					{a.percentile30d == null ? EMPTY : `Above ${percent(a.percentile30d, { signed: false })} of the month`}
				</Fact>
				<Fact label="Latest listing">
					{roubles(a.livePriceMin)}
					{a.liveOfferCount != null && <span className="text-muted-foreground"> · {a.liveOfferCount} offers</span>}
				</Fact>
			</AnalyticsSection>

			<AnalyticsSection title="Movement">
				<Fact label="6 hours">{percent(a.change6h)}</Fact>
				<Fact label="24 hours">
					{percent(a.change24h)}
					{a.change24hRub != null && <span className="text-muted-foreground"> · {signedRoubles(a.change24hRub)}</span>}
				</Fact>
				<Fact label="7 days">
					{percent(a.change7d)}
					{a.change7dRub != null && <span className="text-muted-foreground"> · {signedRoubles(a.change7dRub)}</span>}
				</Fact>
				<Fact label="12-hour direction" hint="Robust slope of the minimum over the last 12 hours, per 12 hours">
					{percent(a.move12h)}
				</Fact>
				<Fact label="Trend">{a.trend[0].toUpperCase() + a.trend.slice(1)}</Fact>
				<Fact label="Volatility (7 days)" hint="Interquartile spread relative to the median">
					{percent(a.volatility7d, { signed: false })}
				</Fact>
				<Fact label="Price held for" hint="How long the current price level has persisted">
					{hours(a.persistenceHours)}
				</Fact>
				<Fact label="Listing depth" hint="Median offers per snapshot over 24 hours; evidence, not sales volume">
					{a.depthMedian24h == null ? EMPTY : Math.round(a.depthMedian24h)}
				</Fact>
			</AnalyticsSection>

			{a.shock && (
				<AnalyticsSection title="Recent spike">
					<Fact label="Phase">{a.shock.phase[0].toUpperCase() + a.shock.phase.slice(1)}</Fact>
					<Fact label="Move">
						{roubles(a.shock.baseline)} → {roubles(a.shock.extreme)}
					</Fact>
					<Fact label="Given back">{percent(a.shock.retracement, { signed: false })}</Fact>
					<Fact label="Peak">{a.shock.at ? (formatRelativeUpdatedAt(a.shock.at) ?? EMPTY) : EMPTY}</Fact>
				</AnalyticsSection>
			)}

			<AnalyticsSection title="Selling">
				<Fact label="Best trader">
					{roubles(a.traderValue)}
					{trader && <span className="text-muted-foreground"> · {trader}</span>}
				</Fact>
				<Fact label="Flea fee at market value" hint="Without the Intelligence Center reduction">
					{roubles(a.fleaFee)}
				</Fact>
				<Fact label="Flea net at market value">{roubles(a.fleaNet)}</Fact>
				<Fact label="Trader break-even" hint="Listing price whose net equals the best trader sale">
					{roubles(a.traderBreakEven)}
				</Fact>
				<Fact label="Practical break-even" hint="Beats the trader by min(5%, 5,000 ₽)">
					{roubles(a.practicalBreakEven)}
				</Fact>
				<Fact label="Max-net listing price" hint="Above this price the flea fee eats any increase">
					{roubles(a.maxNetPrice)}
					{a.maxNet != null && <span className="text-muted-foreground"> · nets {roubles(a.maxNet)}</span>}
				</Fact>
			</AnalyticsSection>

			<p className="text-[11px] text-muted-foreground">
				Data coverage: {percent(a.coverage.day, { signed: false })} of 24 hours,{" "}
				{percent(a.coverage.week, { signed: false })} of 7 days, {percent(a.coverage.month, { signed: false })} of 30
				days.
			</p>
		</div>
	);
}

const compact = (value: number) => `${formatCompactRoubles(Math.round(value))} ₽`;

/** The values most players need at a glance; the sections below keep the full record. */
function AnalyticsSummary({ analytics: a, item }: { analytics: ItemMarketAnalytics; item?: ItemSummary }) {
	const marketPrice = item?.marketPrice;
	const livePrice = typeof marketPrice?.price === "number" && marketPrice.price > 0 ? marketPrice.price : null;
	const now = livePrice ?? a.marketValue;
	const vsTypical = now != null && a.median7d ? now / a.median7d - 1 : null;
	const timing = describeMarketTiming(marketPrice);
	// Sale values follow the loaded current price (as profit pages do); otherwise the analysis.
	const sale = item && marketPrice ? getItemSellComparison(item) : null;
	const fleaNet = sale ? sale.fleaNetTotal : a.fleaNet;
	const traderValue = sale ? (sale.bestTraderOffer?.priceRUB ?? null) : a.traderValue;
	const traderId = sale ? (sale.bestTraderOffer?.traderId ?? null) : a.traderId;
	const trader = traderId ? traderInfo(traderId).name : null;
	const fleaBetter = fleaNet != null && (traderValue == null || fleaNet > traderValue);

	return (
		<dl className="grid grid-cols-2 overflow-hidden rounded-md border border-brand/20 bg-brand/[0.06] sm:grid-cols-4">
			<Glance
				className="border-r border-b sm:border-b-0"
				label="Now vs typical"
				value={percent(vsTypical)}
				valueClassName={timing?.kind === "high" ? "text-warning" : timing?.kind === "low" ? "text-info" : undefined}
				detail={
					now != null && a.median7d != null
						? `${compact(now)}${livePrice == null ? " analyzed" : " now"} · typical ${compact(a.median7d)}`
						: null
				}
			/>
			<Glance
				className="border-b sm:border-r sm:border-b-0"
				label="Normal range (7d)"
				value={
					a.rangeLow7d == null || a.rangeHigh7d == null
						? EMPTY
						: `${formatCompactRoubles(a.rangeLow7d)}–${compact(a.rangeHigh7d)}`
				}
				detail={a.depthMedian24h == null ? null : `~${Math.round(a.depthMedian24h)} listings`}
			/>
			<Glance
				className="border-r"
				label="7-day trend"
				value={percent(a.change7d)}
				valueClassName={
					a.change7d == null || a.change7d === 0 ? undefined : a.change7d > 0 ? "text-success" : "text-danger"
				}
				detail={`${a.trend[0].toUpperCase() + a.trend.slice(1)} · 24h ${percent(a.change24h)}`}
			/>
			<Glance
				label="Best sale"
				value={
					fleaBetter ? `Flea ${compact(fleaNet!)}` : traderValue != null ? `Trader ${compact(traderValue)}` : EMPTY
				}
				detail={
					fleaBetter
						? traderValue != null
							? `Net of fee · ${trader ?? "trader"} ${compact(traderValue)}`
							: "Net of flea fee"
						: [trader, fleaNet != null ? `flea ${compact(fleaNet)} net` : null].filter(Boolean).join(" · ") || null
				}
			/>
		</dl>
	);
}

function Glance({
	label,
	value,
	detail,
	className,
	valueClassName,
}: {
	label: string;
	value: string;
	detail: string | null;
	className?: string;
	valueClassName?: string;
}) {
	return (
		<div className={cn("min-w-0 border-brand/15 px-3 py-2.5", className)}>
			<dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
			<dd className={cn("mt-0.5 truncate font-mono text-base font-semibold text-foreground", valueClassName)}>
				{value}
			</dd>
			{detail && <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</dd>}
		</div>
	);
}

function AnalyticsSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section>
			<h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
			<dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">{children}</dl>
		</section>
	);
}

function Fact({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-3 border-b border-border-color/60 py-1.5 text-xs">
			<dt className="text-foreground/75" title={hint}>
				{label}
			</dt>
			<dd className="text-right font-mono text-foreground">{children}</dd>
		</div>
	);
}
