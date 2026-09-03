"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    Moon,
    RefreshCw,
    Sun,
    type LucideIcon,
} from "lucide-react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import {
    calculatePriceHistoryInsights,
    downsamplePriceHistory,
    filterPriceHistory,
    filterPriceHistoryOutliers,
    type PriceHistoryRange,
} from "@/lib/utils/price-history";
import type { PriceHistoryPoint } from "@/types/prices";

const historyCache = new Map<string, PriceHistoryPoint[]>();
const RANGE_LABELS: Array<{ value: PriceHistoryRange; label: string }> = [
    { value: "day", label: "1D" },
    { value: "threeDays", label: "3D" },
    { value: "week", label: "1W" },
    { value: "month", label: "1M" },
    { value: "all", label: "All" },
];

interface ItemDetailPriceHistoryProps {
    itemId: string;
    mode: TarkovJsonGameMode;
    onAvailabilityChange?: (hasData: boolean) => void;
}

export function getCachedPriceHistoryAvailability(itemId: string, mode: TarkovJsonGameMode) {
    const points = historyCache.get(`${mode}:${itemId}`);
    return points ? points.length > 0 : null;
}

export function ItemDetailPriceHistory({
    itemId,
    mode,
    onAvailabilityChange,
}: ItemDetailPriceHistoryProps) {
    const cacheKey = `${mode}:${itemId}`;
    const [points, setPoints] = useState<PriceHistoryPoint[] | null>(
        () => historyCache.get(cacheKey) ?? null,
    );
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const [range, setRange] = useState<PriceHistoryRange>("week");
    const [hovered, setHovered] = useState<PriceHistoryPoint | null>(null);

    useEffect(() => {
        if (points !== null) onAvailabilityChange?.(points.length > 0);
    }, [onAvailabilityChange, points]);

    useEffect(() => {
        const cached = historyCache.get(cacheKey);
        if (cached) {
            return;
        }
        const controller = new AbortController();
        fetch(`/api/items/${encodeURIComponent(itemId)}/price-history?mode=${mode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error("Price history is temporarily unavailable.");
                return (await response.json()) as { data?: PriceHistoryPoint[] };
            })
            .then((response) => {
                const data = Array.isArray(response.data) ? response.data : [];
                historyCache.set(cacheKey, data);
                setPoints(data);
            })
            .catch((reason: unknown) => {
                if (controller.signal.aborted) return;
                setError(reason instanceof Error ? reason.message : "Price history could not be loaded.");
            });
        return () => controller.abort();
    }, [cacheKey, itemId, mode, retry]);

    const filtered = useMemo(
        () => filterPriceHistory(points ?? [], range),
        [points, range],
    );
    const visible = useMemo(() => filterPriceHistoryOutliers(filtered), [filtered]);
    const plotted = useMemo(() => downsamplePriceHistory(visible), [visible]);
    const insights = useMemo(() => calculatePriceHistoryInsights(visible), [visible]);

    if (error) {
        return (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        setRetry((value) => value + 1);
                    }}
                    className="flex items-center gap-2 rounded-md border border-border-color px-3 py-2 text-xs text-foreground hover:bg-white/5"
                >
                    <RefreshCw size={12} /> Try again
                </button>
            </div>
        );
    }

    if (!points) {
        return (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading price history…</p>
        );
    }

    if (points.length === 0) {
        return (
            <div className="flex min-h-72 items-center justify-center p-6 text-sm text-muted-foreground">
                Tarkov.dev has no flea price history for this item.
            </div>
        );
    }

    const displayPoint = hovered ?? visible[visible.length - 1] ?? points[points.length - 1];

    return (
        <div className="p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="font-mono text-xl font-semibold text-foreground">
                        {formatRoubles(displayPoint.price)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(displayPoint.timestamp).toLocaleString()} · minimum {formatRoubles(displayPoint.priceMin)}
                    </div>
                </div>
                <div className="flex rounded-sm border border-border-color bg-black/15 p-0.5">
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
                                    ? "bg-white/10 text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <PriceChart points={plotted} onHover={setHovered} />

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
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
                Time-pattern comparisons use the latest 30 days and your device timezone. They describe correlation, not a guaranteed buying window.
            </p>
        </div>
    );
}

function PriceChart({
    points,
    onHover,
}: {
    points: PriceHistoryPoint[];
    onHover: (point: PriceHistoryPoint | null) => void;
}) {
    const [activePoint, setActivePoint] = useState<PriceHistoryPoint | null>(null);
    const width = 800;
    const height = 290;
    const inset = { left: 0, right: 0, top: 12, bottom: 24 };
    const prices = points.map((point) => point.price);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const padding = Math.max((rawMax - rawMin) * 0.1, rawMax * 0.03, 1);
    const min = Math.max(0, rawMin - padding);
    const max = rawMax + padding;
    const firstTime = points[0]?.timestamp ?? 0;
    const lastTime = points[points.length - 1]?.timestamp ?? firstTime + 1;
    const x = (timestamp: number) =>
        inset.left +
        ((timestamp - firstTime) / Math.max(lastTime - firstTime, 1)) *
            (width - inset.left - inset.right);
    const y = (price: number) =>
        inset.top +
        (1 - (price - min) / Math.max(max - min, 1)) *
            (height - inset.top - inset.bottom);
    const path = points
        .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.timestamp)},${y(point.price)}`)
        .join(" ");
    const area = `${path} L${x(lastTime)},${height - inset.bottom} L${x(firstTime)},${height - inset.bottom} Z`;

    const handleMove = (event: MouseEvent<SVGSVGElement>) => {
        if (points.length === 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const targetTime = firstTime + ratio * (lastTime - firstTime);
        let nearestIndex = 0;
        for (let index = 1; index < points.length; index += 1) {
            if (
                Math.abs(points[index].timestamp - targetTime) <
                Math.abs(points[nearestIndex].timestamp - targetTime)
            ) {
                nearestIndex = index;
            }
        }
        const nearest = points[nearestIndex];
        setActivePoint(nearest);
        onHover(nearest);
    };

    return (
        <div className="mt-3 overflow-hidden rounded-lg border border-border-color bg-black/15">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="block h-auto w-full touch-none"
                role="img"
                aria-label="Flea market price history"
                onMouseMove={handleMove}
                onMouseLeave={() => {
                    setActivePoint(null);
                    onHover(null);
                }}
            >
                <defs>
                    <linearGradient id="price-history-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(144 182 97)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="rgb(144 182 97)" stopOpacity="0" />
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
                        className="text-white/[0.055]"
                    />
                ))}
                <path d={area} fill="url(#price-history-area)" />
                <path
                    d={path}
                    fill="none"
                    stroke="rgb(144 182 97)"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                />
                {activePoint && (
                    <>
                        <line
                            x1={x(activePoint.timestamp)}
                            x2={x(activePoint.timestamp)}
                            y1={0}
                            y2={height - inset.bottom}
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                            className="text-white/30"
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle
                            cx={x(activePoint.timestamp)}
                            cy={y(activePoint.price)}
                            r="4"
                            fill="rgb(144 182 97)"
                            stroke="rgb(10 10 10)"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
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
        <div className="rounded-md border border-border-color bg-black/10 p-2.5">
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
        <div className="overflow-hidden rounded-md border border-border-color bg-black/10">
            <div className="p-2.5">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="mt-1 text-xs font-medium leading-tight text-foreground">{summary}</div>
            </div>
            <div className="divide-y divide-border-color/60 border-t border-border-color/60 bg-white/[0.025]">
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
