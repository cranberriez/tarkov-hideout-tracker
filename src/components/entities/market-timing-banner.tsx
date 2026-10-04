import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketTiming } from "@/lib/utils/market-timing";
import { formatCompactRoubles, formatRoubles } from "@/lib/utils/market-price";

const TONES: Record<MarketTiming["kind"], string> = {
	high: "border-warning/25 bg-warning/8 text-warning",
	low: "border-info/25 bg-info/8 text-info",
};
/** Borderless and faint, matching the item dialog's price-stability panel. */
const PANEL_TONES: Record<MarketTiming["kind"], string> = {
	high: "bg-warning/[0.04] text-warning",
	low: "bg-info/[0.04] text-info",
};

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(Math.round(value));

/** The banner's arrow alone, for the top-right corner of an item icon in lists. */
export function MarketTimingMarker({ timing, className }: { timing: MarketTiming; className?: string }) {
	const high = timing.kind === "high";
	const Icon = high ? TrendingUp : TrendingDown;
	const label = `${high ? "Unusually high" : "Unusually low"} price · typical ${formatCompactRoubles(timing.typical)} ₽`;
	return (
		<span
			role="img"
			aria-label={label}
			title={label}
			className={cn(
				"absolute -right-1 -top-1 z-1 inline-flex items-center justify-center drop-shadow-[0_1px_2px_var(--shadow)]",
				high ? "text-warning" : "text-info",
				className,
			)}
		>
			<Icon size={11} strokeWidth={2.5} aria-hidden="true" />
		</span>
	);
}

/** An unusually high or low flea price: one line in hover cards, with the typical range in the item dialog. */
export function MarketTimingBanner({
	timing,
	compact = false,
	className,
}: {
	timing: MarketTiming;
	compact?: boolean;
	className?: string;
}) {
	const high = timing.kind === "high";
	const Icon = high ? TrendingUp : TrendingDown;
	const title = high ? "Unusually high" : "Unusually low";

	if (compact) {
		return (
			<div
				role="note"
				className={cn(
					"flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] leading-4",
					TONES[timing.kind],
					className,
				)}
			>
				<Icon size={12} aria-hidden="true" className="shrink-0" />
				<span className="font-medium">{title}</span>
				<span className="text-foreground/75">· typical {formatCompactRoubles(timing.typical)} ₽</span>
			</div>
		);
	}

	return (
		<div role="note" className={cn("rounded-md px-2.5 py-2", PANEL_TONES[timing.kind], className)}>
			<div className="flex items-center gap-1.5 text-xs font-semibold">
				<Icon size={13} aria-hidden="true" className="shrink-0" />
				{title} right now
			</div>
			<p className="mt-1 text-[11px] leading-4 text-foreground/80">
				Typical {formatRoubles(timing.typical)} · 7-day range {formatNumber(timing.rangeLow)}–
				{formatRoubles(timing.rangeHigh)}.{" "}
				{high
					? "Prices this far above normal tend to ease within a few days: sell now, and wait to buy if you can."
					: "Prices this far below normal tend to recover within a few days: a good time to buy, and to hold before selling."}
			</p>
		</div>
	);
}
