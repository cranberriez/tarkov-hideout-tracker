"use client";

import { Fragment, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Moon, RefreshCw, Sun, type LucideIcon } from "lucide-react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import {
	calculatePriceHistoryInsights,
	filterPriceHistory,
	filterPriceHistoryOutliers,
	type PriceHistoryRange,
} from "@/lib/utils/price-history";
import type { PriceHistoryPoint } from "@/types/prices";
import { priceHistoryQueryOptions } from "./price-history-query";
import {
	bucketPriceHistory,
	RANGE_BUCKET_MS,
	seriesPath,
	splitAtGaps,
	type ChartPoint,
	type ChartScale,
	type PriceSeries,
} from "./price-chart-model";

const RANGE_LABELS: Array<{ value: PriceHistoryRange; label: string }> = [
	{ value: "day", label: "1D" },
	{ value: "threeDays", label: "3D" },
	{ value: "week", label: "1W" },
	{ value: "month", label: "1M" },
	{ value: "all", label: "All" },
];

/** The minimum is dotted so the two series stay distinct without relying on colour alone. */
const SERIES: Array<{
	value: PriceSeries;
	label: string;
	color: string;
	dotted: boolean;
	swatch: string;
	inactiveSwatch: string;
}> = [
	{
		value: "price",
		label: "Aggregate",
		color: "var(--chart-1)",
		dotted: false,
		swatch: "h-0.5 rounded-full bg-chart-1",
		inactiveSwatch: "h-0.5 rounded-full bg-muted-foreground/40",
	},
	{
		value: "priceMin",
		label: "Minimum",
		color: "var(--chart-2)",
		dotted: true,
		swatch: "border-t-2 border-dotted border-chart-2",
		inactiveSwatch: "border-t-2 border-dotted border-muted-foreground/40",
	},
];

interface ItemDetailPriceHistoryProps {
	itemId: string;
	mode: TarkovJsonGameMode;
	onAvailabilityChange?: (hasData: boolean) => void;
}

const asSeries = (points: readonly PriceHistoryPoint[], series: PriceSeries) =>
	series === "price" ? [...points] : points.map((point) => ({ ...point, price: point.priceMin }));

export function ItemDetailPriceHistory({ itemId, mode, onAvailabilityChange }: ItemDetailPriceHistoryProps) {
	const historyQuery = useQuery(priceHistoryQueryOptions(itemId, mode));
	const points = historyQuery.data ?? null;
	const [range, setRange] = useState<PriceHistoryRange>("week");
	const [hovered, setHovered] = useState<ChartPoint | null>(null);
	const [shown, setShown] = useState<Record<PriceSeries, boolean>>({ price: true, priceMin: false });
	// The aggregate stays the baseline whenever it is shown; otherwise the minimum leads.
	const primary: PriceSeries = shown.price ? "price" : "priceMin";

	useEffect(() => {
		if (points !== null) onAvailabilityChange?.(points.length > 0);
	}, [onAvailabilityChange, points]);

	const filtered = useMemo(() => filterPriceHistory(points ?? [], range), [points, range]);
	const visible = useMemo(() => {
		// Outliers are judged on the leading series, but both series stay on each kept point.
		const kept = new Set(filterPriceHistoryOutliers(asSeries(filtered, primary)).map((point) => point.timestamp));
		return filtered.filter((point) => kept.has(point.timestamp));
	}, [filtered, primary]);
	const bucketMs = RANGE_BUCKET_MS[range];
	const plotted = useMemo<ChartPoint[]>(
		() => (bucketMs ? bucketPriceHistory(visible, bucketMs) : visible),
		[visible, bucketMs],
	);
	const insights = useMemo(() => calculatePriceHistoryInsights(asSeries(visible, primary)), [visible, primary]);

	if (historyQuery.error) {
		return (
			<div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
				<p className="text-sm text-muted-foreground">Price history is temporarily unavailable.</p>
				<button
					type="button"
					onClick={() => void historyQuery.refetch()}
					className="flex items-center gap-2 rounded-md border border-border-color px-3 py-2 text-xs text-foreground hover:bg-highlight/5"
				>
					<RefreshCw size={12} /> Try again
				</button>
			</div>
		);
	}

	if (!points) {
		return <p className="px-4 py-6 text-sm text-muted-foreground">Loading price history…</p>;
	}

	if (points.length === 0) {
		return (
			<div className="flex min-h-72 items-center justify-center p-6 text-sm text-muted-foreground">
				Tarkov.dev has no flea price history for this item.
			</div>
		);
	}

	const displayPoint: ChartPoint = hovered ?? visible[visible.length - 1] ?? points[points.length - 1];
	const toggleSeries = (series: PriceSeries) =>
		setShown((current) => {
			const next = { ...current, [series]: !current[series] };
			// Keep at least one series visible.
			return next.price || next.priceMin ? next : current;
		});

	return (
		<div className="p-3 sm:p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="font-mono text-xl font-semibold text-foreground">{formatRoubles(displayPoint[primary])}</div>
					<div className="mt-0.5 text-[11px] text-muted-foreground">{pointSummary(displayPoint, primary)}</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex rounded-sm border border-border-color bg-shadow/15 p-0.5" aria-label="Price series">
						{SERIES.map((series) => (
							<button
								key={series.value}
								type="button"
								aria-pressed={shown[series.value]}
								onClick={() => toggleSeries(series.value)}
								className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] transition-colors ${
									shown[series.value]
										? "bg-highlight/10 text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<span className={`w-3 ${shown[series.value] ? series.swatch : series.inactiveSwatch}`} />
								{series.label}
							</button>
						))}
					</div>
					<div className="flex rounded-sm border border-border-color bg-shadow/15 p-0.5">
						{RANGE_LABELS.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => {
									setRange(option.value);
									setHovered(null);
								}}
								className={`rounded px-2.5 py-1.5 text-[11px] transition-colors ${
									range === option.value
										? "bg-highlight/10 text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<PriceChart points={plotted} shown={shown} primary={primary} bucketMs={bucketMs} onHover={setHovered} />

			<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
				<RangeInsight
					average={formatRoubles(insights.average)}
					direction={trendLabel(insights.trend, insights.changePercent)}
					trend={insights.trend}
				/>
				<ComparisonInsight
					label="Weekend and weekday"
					summary={comparisonLabel("Weekends", insights.weekendPercent)}
					rows={[
						{ label: "Weekend avg.", value: formatRoubles(insights.weekendAverage) },
						{ label: "Weekday avg.", value: formatRoubles(insights.weekdayAverage) },
					]}
				/>
				<ComparisonInsight
					label="Local night and day"
					summary={comparisonLabel("Nights", insights.localNightPercent)}
					rows={[
						{ label: "12am–6am", icon: Moon, value: formatRoubles(insights.localNightAverage) },
						{ label: "12pm–6pm", icon: Sun, value: formatRoubles(insights.localDayAverage) },
					]}
				/>
			</div>
			<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
				Aggregate is Tarkov.dev&apos;s reference price and minimum is the cheapest listing; 1M and All show 12-hour and
				daily summaries. Dashed lines mark times with no data from Tarkov.dev, and extreme spikes are hidden.
			</p>
		</div>
	);
}

function PriceChart({
	points,
	shown,
	primary,
	bucketMs,
	onHover,
}: {
	points: ChartPoint[];
	shown: Record<PriceSeries, boolean>;
	primary: PriceSeries;
	bucketMs: number | null;
	onHover: (point: ChartPoint | null) => void;
}) {
	const [activePoint, setActivePoint] = useState<ChartPoint | null>(null);
	const width = 800;
	const height = 290;
	const inset = { left: 0, right: 0, top: 12, bottom: 24 };
	const visibleSeries = SERIES.filter((series) => shown[series.value]);
	const leading = SERIES.find((series) => series.value === primary)!;
	const prices = points.flatMap((point) => visibleSeries.map((series) => point[series.value]));
	const rawMin = Math.min(...prices);
	const rawMax = Math.max(...prices);
	const padding = Math.max((rawMax - rawMin) * 0.1, rawMax * 0.03, 1);
	const min = Math.max(0, rawMin - padding);
	const max = rawMax + padding;
	const firstTime = points[0]?.timestamp ?? 0;
	const lastTime = points[points.length - 1]?.timestamp ?? firstTime + 1;
	const scale: ChartScale = {
		x: (timestamp) =>
			inset.left + ((timestamp - firstTime) / Math.max(lastTime - firstTime, 1)) * (width - inset.left - inset.right),
		y: (price) => inset.top + (1 - (price - min) / Math.max(max - min, 1)) * (height - inset.top - inset.bottom),
	};
	const segments = splitAtGaps(points, bucketMs);
	const valuesFor = (segment: ChartPoint[], series: PriceSeries) => segment.map((point) => point[series]);
	const baseline = height - inset.bottom;

	const handleMove = (event: MouseEvent<SVGSVGElement>) => {
		if (points.length === 0) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		const targetTime = firstTime + ratio * (lastTime - firstTime);
		let nearestIndex = 0;
		for (let index = 1; index < points.length; index += 1) {
			if (Math.abs(points[index].timestamp - targetTime) < Math.abs(points[nearestIndex].timestamp - targetTime)) {
				nearestIndex = index;
			}
		}
		const nearest = points[nearestIndex];
		setActivePoint(nearest);
		onHover(nearest);
	};

	return (
		<div className="mt-3 overflow-hidden rounded-lg border border-border-color bg-shadow/15">
			<div className="flex gap-3 px-2.5 pt-2 text-[10px] text-muted-foreground" aria-hidden="true">
				{visibleSeries.map((series) => (
					<span key={series.value} className="flex items-center gap-1.5">
						<span className={`w-3 ${series.swatch}`} /> {series.label}
					</span>
				))}
			</div>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="block h-auto w-full touch-none"
				role="img"
				aria-label={`Flea market price history: ${visibleSeries.map((series) => series.label.toLowerCase()).join(" and ")}`}
				onMouseMove={handleMove}
				onMouseLeave={() => {
					setActivePoint(null);
					onHover(null);
				}}
			>
				<defs>
					<linearGradient id="price-history-area" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={leading.color} stopOpacity="0.25" />
						<stop offset="100%" stopColor={leading.color} stopOpacity="0" />
					</linearGradient>
				</defs>
				{[0.2, 0.4, 0.6, 0.8].map((ratio) => (
					<line
						key={ratio}
						x1={0}
						x2={width}
						y1={height * ratio}
						y2={height * ratio}
						stroke="currentColor"
						className="text-foreground/[0.055]"
					/>
				))}
				{segments.map((segment) => {
					// The area sits under the leading series: the aggregate when shown, otherwise the minimum.
					if (segment.length < 2) return null;
					const first = scale.x(segment[0].timestamp);
					const last = scale.x(segment[segment.length - 1].timestamp);
					const line = seriesPath(segment, valuesFor(segment, primary), scale);
					return (
						<path
							key={segment[0].timestamp}
							d={`${line} L${last},${baseline} L${first},${baseline} Z`}
							fill="url(#price-history-area)"
						/>
					);
				})}
				{visibleSeries.map((series) => (
					<g key={series.value}>
						{segments.map((segment, index) => {
							const values = valuesFor(segment, series.value);
							const previous = segments[index - 1];
							return (
								<Fragment key={segment[0].timestamp}>
									{previous && (
										// Tarkov.dev recorded nothing in between: bridge without inventing prices.
										<line
											x1={scale.x(previous[previous.length - 1].timestamp)}
											y1={scale.y(valuesFor(previous, series.value).at(-1)!)}
											x2={scale.x(segment[0].timestamp)}
											y2={scale.y(values[0])}
											stroke={series.color}
											strokeOpacity="0.5"
											strokeWidth="1.25"
											strokeDasharray="4 4"
											vectorEffect="non-scaling-stroke"
										/>
									)}
									<path
										d={seriesPath(segment, values, scale)}
										fill="none"
										stroke={series.color}
										strokeWidth={series.value === primary ? 2.5 : 1.75}
										strokeDasharray={series.dotted ? "0.1 5" : undefined}
										strokeLinecap={series.dotted ? "round" : undefined}
										vectorEffect="non-scaling-stroke"
									/>
								</Fragment>
							);
						})}
					</g>
				))}
				{activePoint && (
					<>
						<line
							x1={scale.x(activePoint.timestamp)}
							x2={scale.x(activePoint.timestamp)}
							y1={0}
							y2={baseline}
							stroke="currentColor"
							strokeWidth="1"
							strokeDasharray="4 4"
							className="text-foreground/30"
							vectorEffect="non-scaling-stroke"
						/>
						{visibleSeries.map((series) => (
							<circle
								key={series.value}
								cx={scale.x(activePoint.timestamp)}
								cy={scale.y(activePoint[series.value])}
								r={series.value === primary ? 4 : 3.5}
								fill={series.color}
								stroke="var(--shadow)"
								strokeWidth="2"
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</>
				)}
				<text x={8} y={height - 7} fill="currentColor" className="text-[10px] text-muted-foreground">
					{new Date(firstTime).toLocaleDateString()}
				</text>
				<text
					x={width - 8}
					y={height - 7}
					textAnchor="end"
					fill="currentColor"
					className="text-[10px] text-muted-foreground"
				>
					{new Date(lastTime).toLocaleDateString()}
				</text>
			</svg>
		</div>
	);
}

function RangeInsight({
	average,
	direction,
	trend,
}: {
	average: string;
	direction: string;
	trend: "up" | "down" | "flat" | "unknown";
}) {
	const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
	return (
		<div className="rounded-md border border-border-color bg-shadow/10 p-2.5">
			<div>
				<div className="text-[10px] text-muted-foreground">Direction</div>
				<div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
					<Icon size={12} className="shrink-0" />
					<span className="whitespace-nowrap">{direction}</span>
				</div>
			</div>
			<div className="mt-3">
				<div className="text-[10px] text-muted-foreground">Range average</div>
				<div className="mt-1 text-xs font-medium text-foreground">{average}</div>
			</div>
		</div>
	);
}

function ComparisonInsight({
	label,
	summary,
	rows,
}: {
	label: string;
	summary: string;
	rows: Array<{ label: string; value: string; icon?: LucideIcon }>;
}) {
	return (
		<div className="overflow-hidden rounded-md border border-border-color bg-shadow/10">
			<div className="p-2.5">
				<div className="text-[10px] text-muted-foreground">{label}</div>
				<div className="mt-1 text-xs font-medium leading-tight text-foreground">{summary}</div>
			</div>
			<div className="divide-y divide-border-color/60 border-t border-border-color/60 bg-highlight/[0.025]">
				{rows.map((row) => (
					<div key={row.label} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
						<span
							className="flex items-center text-[9px] leading-tight text-muted-foreground"
							title={row.icon ? row.label : undefined}
						>
							{row.icon ? (
								<>
									<row.icon size={12} aria-hidden="true" />
									<span className="ml-1.5">{row.label}</span>
								</>
							) : (
								row.label
							)}
						</span>
						<span className="shrink-0 font-mono text-[10px] text-foreground">{row.value}</span>
					</div>
				))}
			</div>
		</div>
	);
}

const UTC_DAY = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
const UTC_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const UTC_CLOCK = new Intl.DateTimeFormat(undefined, { timeStyle: "short", timeZone: "UTC" });

/** One observation as recorded, or a bucket with its interval and how many observations it summarises. */
function pointSummary(point: ChartPoint, primary: PriceSeries) {
	const other =
		primary === "price" ? `lowest ${formatRoubles(point.priceMin)}` : `aggregate ${formatRoubles(point.price)}`;
	if (!point.bucket) {
		return [
			primary === "price" ? "Aggregate reference" : "Minimum listing",
			new Date(point.timestamp).toLocaleString(),
			primary === "price" ? `minimum ${formatRoubles(point.priceMin)}` : `aggregate ${formatRoubles(point.price)}`,
			`${point.offerCount ?? "unknown"} offers`,
		].join(" · ");
	}
	const { end, count, upstreamDaily } = point.bucket;
	const interval =
		end - point.timestamp >= 24 * 60 * 60 * 1000
			? `${UTC_DAY.format(point.timestamp)} (UTC day)`
			: `${UTC_TIME.format(point.timestamp)}–${UTC_CLOCK.format(end)} UTC`;
	const source = upstreamDaily ? "Tarkov.dev daily summary" : `${count} snapshot${count === 1 ? "" : "s"}`;
	const offers = point.offerCount === null ? "unknown offers" : `avg. ${Math.round(point.offerCount)} offers`;
	return [primary === "price" ? "Mean aggregate" : "Lowest listing", interval, source, other, offers].join(" · ");
}

function formatRoubles(value: number | null) {
	return value === null ? "Not enough data" : `${Math.round(value).toLocaleString()} ₽`;
}

function trendLabel(trend: string, percent: number | null) {
	if (percent === null || trend === "unknown") return "Not enough data";
	if (trend === "flat") return `Flat (${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%)`;
	return `${trend === "up" ? "Up" : "Down"} ${Math.abs(percent).toFixed(1)}%`;
}

function comparisonLabel(subject: string, percent: number | null) {
	if (percent === null) return "Not enough data";
	if (Math.abs(percent) < 2) return `${subject} nearly even (${Math.abs(percent).toFixed(1)}%)`;
	return `${subject} ${Math.abs(percent).toFixed(1)}% ${percent > 0 ? "higher" : "lower"}`;
}
