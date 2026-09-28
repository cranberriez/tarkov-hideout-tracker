import { useProfitPricingContext } from "./ProfitPricingContext";
import { getItemSellComparison, type ManualPriceOverride } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import { formatCompactPrice, formatRoundedRoubles, formatSignedRoubles, formatTraderOffer } from "../utils/formatters";
import { InfoHint } from "./InfoHint";

export function ProfitCell({
	label,
	value,
	children,
	detail,
	detailTone = "muted",
	info,
	infoTitle,
	customized = false,
	originalValue,
}: {
	label: string;
	value?: number | null;
	children: React.ReactNode;
	detail?: string;
	detailTone?: "muted" | "danger";
	info?: React.ReactNode;
	infoTitle?: string;
	customized?: boolean;
	originalValue?: React.ReactNode;
}) {
	const color =
		value == null ? "text-foreground" : value > 0 ? "text-success" : value < 0 ? "text-danger" : "text-foreground";
	return (
		<div className="flex min-w-0 flex-col items-start self-start lg:self-auto lg:justify-center lg:border-l border-highlight/5 px-4 xl:px-3">
			<span className="flex items-center gap-1">
				<span
					className={`flex min-w-0 flex-col items-start font-mono text-sm font-semibold leading-tight ${color}`}
					title={customized ? `${label} uses customized pricing` : label}
				>
					{customized && originalValue !== undefined && (
						<span className="whitespace-nowrap text-muted-foreground line-through decoration-muted-foreground/80">
							{originalValue}
						</span>
					)}
					<span className="whitespace-nowrap">{children}</span>
				</span>
				{info && (
					<InfoHint title={infoTitle ?? "Price comparison"} tone="warning">
						{info}
					</InfoHint>
				)}
			</span>
			{detail && (
				<span
					title={detail}
					className={`mt-0.5 max-w-full truncate font-mono text-[10px] ${detailTone === "danger" ? "text-danger" : "text-muted-foreground"}`}
				>
					{detail}
				</span>
			)}
		</div>
	);
}

export function SellValueCell({
	item,
	count,
	sellValue,
	sellSourceLabel,
	overrides,
}: {
	item?: ItemSummary;
	count: number;
	sellValue: number | null;
	sellSourceLabel?: string;
	overrides: Record<string, ManualPriceOverride>;
}) {
	const pricingContext = useProfitPricingContext();
	const comparison = getItemSellComparison(item, overrides, pricingContext, count);
	const trader = comparison.bestTraderOffer;
	return (
		<div className="flex min-w-0 flex-col items-start justify-center border-l border-highlight/5 px-2 xl:px-3">
			<span
				className="whitespace-nowrap font-mono text-sm font-semibold text-foreground"
				title={`Gross sale: ${formatRoundedRoubles(comparison.grossTotal)} · Flea fee: ${formatRoundedRoubles(comparison.fee)} · Proceeds: ${formatRoundedRoubles(comparison.netTotal)}`}
			>
				{formatRoundedRoubles(sellValue)}
			</span>
			{sellSourceLabel ? (
				<span className="mt-0.5 text-[10px] text-muted-foreground">{sellSourceLabel}</span>
			) : comparison.selectedSource === "manual" ? (
				<span className="mt-0.5 text-[10px] uppercase tracking-wide text-warning">Manual price</span>
			) : comparison.pricesAreClose && comparison.fleaPrice !== null && trader ? (
				<span className="mt-0.5 block max-w-full space-y-0.5 text-[10px] leading-tight text-muted-foreground">
					<span className="block truncate">Flea {formatCompactPrice(comparison.fleaPrice * count)}</span>
					<span className="block truncate">
						{trader.vendor.name} {formatTraderOffer(trader, count, true)}
					</span>
				</span>
			) : (
				<span className="mt-0.5 max-w-full truncate text-[10px] text-muted-foreground">
					{comparison.selectedSource === "trader" && trader
						? `${trader.vendor.name} · ${formatTraderOffer(trader, count, false)}`
						: comparison.selectedSource === "flea"
							? "Flea market"
							: "No sale price"}
				</span>
			)}
		</div>
	);
}

export interface MetricRow {
	label: string;
	/** Short muted note beside the label, e.g. sale source or duration. */
	note?: string;
	value: number | null;
	signed?: boolean;
	originalValue?: number | null;
	info?: React.ReactNode;
	infoTitle?: string;
}

/**
 * Mobile-only stacked figures. Rows without a value are omitted; the last row
 * is emphasised as the card's headline figure.
 */
export function MetricList({ rows, warning }: { rows: readonly MetricRow[]; warning?: string }) {
	const shown = rows.filter((row) => row.value !== null);
	return (
		<div className="divide-y divide-highlight/[0.06]">
			{warning && <p className="h-6 truncate font-mono text-[11px] leading-6 text-danger">{warning}</p>}
			{shown.map((row, index) => {
				const last = index === shown.length - 1;
				const value = row.value as number;
				const format = row.signed ? formatSignedRoubles : formatRoundedRoubles;
				const color = !row.signed
					? "text-foreground"
					: value > 0
						? "text-success"
						: value < 0
							? "text-danger"
							: "text-foreground";
				return (
					<div key={row.label} className={`flex items-center gap-2 ${last ? "h-10" : "h-8"}`}>
						<span
							className={`flex min-w-0 items-center gap-1.5 ${last ? "text-xs font-semibold text-foreground" : "text-[11px] text-muted-foreground"}`}
						>
							<span className="shrink-0">{row.label}</span>
							{row.note && (
								<span className="truncate text-[10px] font-normal text-muted-foreground/80">{row.note}</span>
							)}
							{row.info && (
								<InfoHint title={row.infoTitle ?? "Price comparison"} tone="warning">
									{row.info}
								</InfoHint>
							)}
						</span>
						<span className="ml-auto flex shrink-0 items-baseline gap-1.5 font-mono">
							{row.originalValue !== undefined && row.originalValue !== value && (
								<span className="text-[11px] text-muted-foreground line-through decoration-muted-foreground/80">
									{format(row.originalValue)}
								</span>
							)}
							<span className={`font-semibold ${last ? "text-base" : "text-[13px]"} ${color}`}>{format(value)}</span>
						</span>
					</div>
				);
			})}
		</div>
	);
}

/** Short name of where the output sells, for the mobile metric list. */
export function useSellSourceNote(
	item: ItemSummary | undefined,
	count: number,
	sellSourceLabel: string | undefined,
	overrides: Record<string, ManualPriceOverride>,
): string | undefined {
	const pricingContext = useProfitPricingContext();
	if (sellSourceLabel) return sellSourceLabel;
	const comparison = getItemSellComparison(item, overrides, pricingContext, count);
	if (comparison.selectedSource === "manual") return "Manual";
	if (comparison.selectedSource === "trader") return comparison.bestTraderOffer?.vendor.name;
	if (comparison.selectedSource === "flea") return "Flea";
	return undefined;
}
