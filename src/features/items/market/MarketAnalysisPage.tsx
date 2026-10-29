"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ItemImage } from "@/components/entities/item-image";
import { ItemLink } from "@/components/entities/item-link";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { marketPageQueryOptions } from "@/lib/query/page-data";
import { cn } from "@/lib/utils";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { formatCompactRoubles } from "@/lib/utils/market-price";
import type { MarketOverviewItem } from "@/types/contracts";
import {
	activeShocks,
	categoriesOf,
	changeOf,
	changeRubOf,
	currentPrice,
	filterMarketItems,
	monthExtremes,
	mostVolatile,
	moveBandCounts,
	summarizeMarket,
	topMovers,
	type MarketWindow,
	type MoveBandId,
	type MoveUnit,
} from "./market-model";
import { changeTone, formatPercent, formatPrice, formatSignedRoubles, toPreviewItem } from "./market-format";
import { MoveBreadthChart, Sparkline, TrendSplitBar } from "./MarketCharts";
import { MarketExplorer } from "./MarketExplorer";

function Segmented<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: Array<{ value: T; label: string }>;
	onChange: (value: T) => void;
}) {
	return (
		<div className="inline-flex rounded-md border border-highlight/10 bg-shadow/30 p-1" role="group" aria-label={label}>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => onChange(option.value)}
					aria-pressed={value === option.value}
					className={cn(
						"min-w-12 rounded px-3 py-1.5 text-sm font-semibold transition-colors",
						value === option.value
							? "bg-brand text-inverse"
							: "text-muted-foreground hover:bg-highlight/5 hover:text-foreground",
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function StatTile({
	label,
	value,
	detail,
	children,
}: {
	label: string;
	value?: ReactNode;
	detail?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
			{value !== undefined && <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>}
			{detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
			{children && <div className="mt-2">{children}</div>}
		</div>
	);
}

function MoverCard({
	title,
	description,
	items,
	value,
	detail,
}: {
	title: string;
	description: string;
	items: MarketOverviewItem[];
	value: (item: MarketOverviewItem) => ReactNode;
	detail?: (item: MarketOverviewItem) => ReactNode;
}) {
	return (
		<section className="min-w-0 rounded-lg border border-border bg-card p-4">
			<h3 className="font-semibold text-foreground">{title}</h3>
			<p className="mb-3 text-xs text-muted-foreground">{description}</p>
			{items.length ? (
				<ol className="space-y-2">
					{items.map((item) => (
						<li key={item.id} className="flex items-center gap-2">
							<ItemImage item={toPreviewItem(item)} size="sm" opensModal />
							<div className="min-w-0 flex-1">
								<ItemLink
									item={toPreviewItem(item)}
									title={item.name}
									className="block truncate text-left text-sm font-medium text-foreground hover:text-brand"
								>
									{item.shortName ?? item.name}
								</ItemLink>
								{detail && <span className="block truncate text-xs text-muted-foreground">{detail(item)}</span>}
							</div>
							<Sparkline sparkline={item.sparkline} width={64} height={24} className="max-sm:hidden" />
							<span className="w-16 shrink-0 text-right text-sm tabular-nums">{value(item)}</span>
						</li>
					))}
				</ol>
			) : (
				<p className="text-sm text-muted-foreground">Nothing with enough evidence right now.</p>
			)}
		</section>
	);
}

function moveValue(item: MarketOverviewItem, window: MarketWindow, unit: MoveUnit) {
	const value = unit === "rub" ? changeRubOf(item, window) : changeOf(item, window);
	return (
		<span className={changeTone(value)}>
			{unit === "rub" ? formatSignedRoubles(value, true) : formatPercent(value)}
		</span>
	);
}

function moveDetail(item: MarketOverviewItem, window: MarketWindow, unit: MoveUnit) {
	const other =
		unit === "rub" ? formatPercent(changeOf(item, window)) : formatSignedRoubles(changeRubOf(item, window), true);
	return `${formatPrice(currentPrice(item))} · ${other}`;
}

function shockDetail(item: MarketOverviewItem) {
	const shock = item.shock;
	if (!shock) return null;
	const span = `${formatCompactRoubles(shock.baseline)} → ${formatCompactRoubles(shock.extreme)}`;
	const back = shock.retracement === null ? "" : ` · ${Math.round(shock.retracement * 100)}% back`;
	return `${span}${back}`;
}

function shockSize(item: MarketOverviewItem) {
	const { baseline, extreme } = item.shock ?? {};
	return baseline && extreme ? (extreme - baseline) / baseline : null;
}

/** Whole-market flea analysis from one suspended page-data read. */
export function MarketAnalysisPage({ mode }: { mode: TarkovJsonGameMode }) {
	const { data } = useSuspenseQuery(marketPageQueryOptions(mode));
	const [window, setWindow] = useState<MarketWindow>("24h");
	const [unit, setUnit] = useState<MoveUnit>("rub");
	const [includeLowConfidence, setIncludeLowConfidence] = useState(false);
	const [category, setCategory] = useState<string | null>(null);
	const [band, setBand] = useState<MoveBandId | null>(null);

	const categories = useMemo(() => categoriesOf(data.items), [data.items]);
	const items = useMemo(
		() => filterMarketItems(data.items, { includeLowConfidence, category }),
		[data.items, includeLowConfidence, category],
	);
	const summary = useMemo(() => summarizeMarket(items, window), [items, window]);
	const bands = useMemo(() => moveBandCounts(items, window), [items, window]);
	const lists = useMemo(
		() => ({
			gainers: topMovers(items, window, unit, "up"),
			losers: topMovers(items, window, unit, "down"),
			shocks: activeShocks(items),
			volatile: mostVolatile(items),
			lows: monthExtremes(items, "low"),
			highs: monthExtremes(items, "high"),
		}),
		[items, window, unit],
	);
	const analyzed = formatRelativeUpdatedAt(data.latestRun?.completedAt ?? null);

	return (
		<main className="container mx-auto space-y-6 px-6 py-8">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">FLEA MARKET ANALYSIS</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						{data.items.length.toLocaleString("en-US")} flea-sellable items tracked
						{analyzed && ` · analyzed ${analyzed}`}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Segmented
						label="Change window"
						value={window}
						options={[
							{ value: "24h", label: "24h" },
							{ value: "7d", label: "7d" },
						]}
						onChange={setWindow}
					/>
					<label className="sr-only" htmlFor="market-category">
						Category
					</label>
					<select
						id="market-category"
						value={category ?? ""}
						onChange={(event) => setCategory(event.target.value || null)}
						className="h-[42px] rounded-md border border-highlight/10 bg-background px-3 text-sm text-foreground focus:border-brand focus:outline-none [&>option]:bg-background [&>option]:text-foreground"
					>
						<option value="">All categories</option>
						{categories.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
					<label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<input
							type="checkbox"
							checked={includeLowConfidence}
							onChange={(event) => setIncludeLowConfidence(event.target.checked)}
							className="size-4 accent-[var(--brand)]"
						/>
						Include low confidence
					</label>
				</div>
			</div>

			{data.error && (
				<p
					role="alert"
					className="rounded border border-warning/30 bg-warning-surface/30 px-4 py-3 text-sm text-warning"
				>
					{data.error}
				</p>
			)}
			{data.invalidCount > 0 && (
				<p
					role="alert"
					className="rounded border border-warning/30 bg-warning-surface/30 px-4 py-3 text-sm text-warning"
				>
					{data.invalidCount} item{data.invalidCount === 1 ? " has" : "s have"} malformed or out-of-range market data
					and {data.invalidCount === 1 ? "is" : "are"} left out.
				</p>
			)}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile label="7-day trend" detail={`${summary.total.toLocaleString("en-US")} items`}>
					<TrendSplitBar trend={summary.trend} />
				</StatTile>
				<StatTile
					label={`Median ${window} move`}
					value={<span className={changeTone(summary.medianChange)}>{formatPercent(summary.medianChange)}</span>}
					detail="Typical item, not a price index"
				/>
				<StatTile
					label="Active price shocks"
					value={summary.activeShocks.toLocaleString("en-US")}
					detail="Sudden spikes or drops still holding or retracing"
				/>
				<StatTile
					label="At 7-day extremes"
					value={
						<>
							{summary.belowRange.toLocaleString("en-US")}
							<span className="text-base font-normal text-muted-foreground"> low · </span>
							{summary.aboveRange.toLocaleString("en-US")}
							<span className="text-base font-normal text-muted-foreground"> high</span>
						</>
					}
					detail="At or beyond the 7-day low/high band"
				/>
			</div>

			<section className="rounded-lg border border-border bg-card p-4" aria-labelledby="market-breadth-title">
				<div className="mb-3">
					<h2 id="market-breadth-title" className="font-semibold text-foreground">
						How prices moved · {window}
					</h2>
					<p className="text-xs text-muted-foreground">
						Items per price-change band. Select a bar to list those items below.
					</p>
				</div>
				<MoveBreadthChart bands={bands} selected={band} onSelect={setBand} />
			</section>

			<div className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-lg font-semibold text-foreground">Swings and signals</h2>
					<Segmented
						label="Rank moves by"
						value={unit}
						options={[
							{ value: "rub", label: "₽" },
							{ value: "percent", label: "%" },
						]}
						onChange={setUnit}
					/>
				</div>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					<MoverCard
						title="Biggest gains"
						description={`${window}, at least 3 listings and larger than the flea fee`}
						items={lists.gainers}
						value={(item) => moveValue(item, window, unit)}
						detail={(item) => moveDetail(item, window, unit)}
					/>
					<MoverCard
						title="Biggest drops"
						description={`${window}, at least 3 listings and larger than the flea fee`}
						items={lists.losers}
						value={(item) => moveValue(item, window, unit)}
						detail={(item) => moveDetail(item, window, unit)}
					/>
					<MoverCard
						title="Price shocks"
						description="Sudden moves still holding or retracing, baseline → extreme"
						items={lists.shocks}
						value={(item) => <span className={changeTone(shockSize(item))}>{formatPercent(shockSize(item))}</span>}
						detail={shockDetail}
					/>
					<MoverCard
						title="Most volatile"
						description="Widest 7-day price spread relative to the median"
						items={lists.volatile}
						value={(item) => formatPercent(item.volatility7d, { signed: false })}
						detail={(item) => `${formatPrice(item.rangeLow7d)} – ${formatPrice(item.rangeHigh7d)}`}
					/>
					<MoverCard
						title="Near 30-day low"
						description="Cheaper now than at least 90% of the past month"
						items={lists.lows}
						value={(item) => formatPrice(item.marketValue)}
						detail={(item) => `30-day median ${formatPrice(item.median30d)}`}
					/>
					<MoverCard
						title="Near 30-day high"
						description="Pricier now than at least 90% of the past month"
						items={lists.highs}
						value={(item) => formatPrice(item.marketValue)}
						detail={(item) => `30-day median ${formatPrice(item.median30d)}`}
					/>
				</div>
			</div>

			<MarketExplorer
				items={items}
				allItems={data.items}
				window={window}
				band={band}
				onClearBand={() => setBand(null)}
			/>
		</main>
	);
}
