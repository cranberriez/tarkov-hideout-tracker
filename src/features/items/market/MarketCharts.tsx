"use client";

import { cn } from "@/lib/utils";
import type { MarketOverviewItem } from "@/types/contracts";
import { currentPrice, rangePosition, type MoveBand, type MoveBandId } from "./market-model";
import { formatPercent, formatPrice } from "./market-format";

/** Diverging fill: danger for drops, success for gains, gray for flat; stronger with magnitude. */
const BAND_FILL: Record<number, string> = {
	[-3]: "bg-danger",
	[-2]: "bg-danger/75",
	[-1]: "bg-danger/50",
	0: "bg-muted-foreground/40",
	1: "bg-success/50",
	2: "bg-success/75",
	3: "bg-success",
};

interface BreadthChartProps {
	bands: Array<{ band: MoveBand; count: number }>;
	selected: MoveBandId | null;
	onSelect: (band: MoveBandId | null) => void;
}

/** How many items moved by how much; selecting a bar filters the explorer to that band. */
export function MoveBreadthChart({ bands, selected, onSelect }: BreadthChartProps) {
	const max = Math.max(1, ...bands.map((entry) => entry.count));
	const total = bands.reduce((sum, entry) => sum + entry.count, 0);
	return (
		<div>
			<div
				className="flex h-44 items-end gap-0.5 border-b border-border"
				role="group"
				aria-label="Items by price change"
			>
				{bands.map(({ band, count }) => {
					const active = selected === band.id;
					const share = total ? count / total : 0;
					return (
						<button
							key={band.id}
							type="button"
							onClick={() => onSelect(active ? null : band.id)}
							aria-pressed={active}
							aria-label={`${band.label}: ${count} items`}
							className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-sm px-0.5 hover:bg-highlight/5 focus-visible:outline-2 focus-visible:outline-brand"
						>
							<span className="mb-1 text-xs tabular-nums text-muted-foreground">{count}</span>
							<span
								className={cn(
									"w-full max-w-14 rounded-t-[4px] transition-opacity",
									BAND_FILL[band.direction],
									selected && !active && "opacity-35",
									active && "ring-2 ring-brand ring-offset-2 ring-offset-card",
								)}
								style={{ height: `${Math.max(count ? 2 : 0, (count / max) * 100)}%` }}
							/>
							<span
								role="tooltip"
								className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-foreground shadow-md group-hover:block group-focus-visible:block"
							>
								<span className="font-semibold">{band.label}</span> · {count.toLocaleString("en-US")} items (
								{Math.round(share * 100)}%)
							</span>
						</button>
					);
				})}
			</div>
			<div className="mt-1.5 flex gap-0.5">
				{bands.map(({ band }) => (
					<span
						key={band.id}
						className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground sm:text-xs"
					>
						<span className="sm:hidden">{band.short}</span>
						<span className="hidden sm:inline">{band.label}</span>
					</span>
				))}
			</div>
		</div>
	);
}

/** Rising / stable / falling share of the market as one stacked bar with a legend. */
export function TrendSplitBar({ trend }: { trend: Record<MarketOverviewItem["trend"], number> }) {
	const parts = [
		{ key: "rising", label: "Rising", value: trend.rising, fill: "bg-success" },
		{ key: "stable", label: "Stable", value: trend.stable, fill: "bg-muted-foreground/40" },
		{ key: "falling", label: "Falling", value: trend.falling, fill: "bg-danger" },
	];
	const total = parts.reduce((sum, part) => sum + part.value, 0);
	return (
		<div className="space-y-2">
			<div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
				{parts.map((part) =>
					part.value ? (
						<span key={part.key} className={part.fill} style={{ width: `${(part.value / total) * 100}%` }} />
					) : null,
				)}
			</div>
			<dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
				{parts.map((part) => (
					<div key={part.key} className="flex items-center gap-1.5">
						<span className={cn("size-2 rounded-full", part.fill)} aria-hidden="true" />
						<dt className="text-muted-foreground">{part.label}</dt>
						<dd className="font-semibold tabular-nums text-foreground">{part.value.toLocaleString("en-US")}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

/** 7-day low–high track: the dot is the current price, the tick the 7-day median. */
export function RangeBar({ item, className }: { item: MarketOverviewItem; className?: string }) {
	const position = rangePosition(item);
	if (position === null) return <span className="text-muted-foreground">–</span>;
	const { rangeLow7d: low, rangeHigh7d: high, median7d } = item;
	const medianPosition =
		median7d !== null && low !== null && high !== null && high > low
			? Math.min(1, Math.max(0, (median7d - low) / (high - low)))
			: null;
	const label = `Current ${formatPrice(currentPrice(item))} within 7-day range ${formatPrice(low)} to ${formatPrice(high)} (${formatPercent(position, { signed: false })} of the way up)`;
	return (
		<span className={cn("relative block h-3 w-24", className)} role="img" aria-label={label} title={label}>
			<span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-highlight/15" />
			{medianPosition !== null && (
				<span
					className="absolute top-0 h-3 w-px bg-muted-foreground"
					style={{ left: `${medianPosition * 100}%` }}
					aria-hidden="true"
				/>
			)}
			<span
				className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-card"
				style={{ left: `${position * 100}%` }}
				aria-hidden="true"
			/>
		</span>
	);
}

/** Recent minimum-listing prices as a 2px line, colored by the net move across the window. */
export function Sparkline({
	sparkline,
	width = 96,
	height = 28,
	className,
}: {
	sparkline: MarketOverviewItem["sparkline"];
	width?: number;
	height?: number;
	className?: string;
}) {
	if (!sparkline) return <span className="text-xs text-muted-foreground">–</span>;
	const { prices, from, to } = sparkline;
	const low = Math.min(...prices);
	const high = Math.max(...prices);
	const pad = 2;
	const x = (index: number) => pad + (index / (prices.length - 1)) * (width - pad * 2);
	const y = (price: number) =>
		high === low ? height / 2 : pad + (1 - (price - low) / (high - low)) * (height - pad * 2);
	const path = prices
		.map((price, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(price).toFixed(1)}`)
		.join("");
	const net = prices[prices.length - 1] - prices[0];
	const hours = Math.max(1, Math.round((to - from) / 3_600_000));
	const label = `Last ${hours}h: ${formatPrice(prices[0])} → ${formatPrice(prices[prices.length - 1])}, low ${formatPrice(low)}, high ${formatPrice(high)}`;
	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			width={width}
			height={height}
			role="img"
			aria-label={label}
			className={cn(
				"shrink-0 overflow-visible",
				net > 0 ? "text-success" : net < 0 ? "text-danger" : "text-muted-foreground",
				className,
			)}
		>
			<title>{label}</title>
			<path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
			<circle cx={x(prices.length - 1)} cy={y(prices[prices.length - 1])} r={2.5} fill="currentColor" />
		</svg>
	);
}
