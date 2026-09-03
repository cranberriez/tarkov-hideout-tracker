import {
  getItemSellComparison,
  type ManualPriceOverride,
} from "@/lib/price-calculation";
import type { GlobalItem } from "@/types";
import {
  formatCompactPrice,
  formatRoundedRoubles,
  formatTraderOffer,
} from "../utils/formatters";
import { InfoHint } from "./InfoHint";

export function ProfitCell({
  label,
  value,
  children,
  detail,
  info,
  infoTitle,
}: {
  label: string;
  value?: number | null;
  children: React.ReactNode;
  detail?: string;
  info?: React.ReactNode;
  infoTitle?: string;
}) {
  const color =
    value == null
      ? "text-foreground"
      : value > 0
        ? "text-tarkov-green"
        : value < 0
          ? "text-red-300"
          : "text-foreground";
  return (
    <div className="flex flex-col items-start justify-center border-l border-white/5 px-3">
      <span className="flex items-center gap-1">
        <span
          className={`whitespace-nowrap font-mono text-sm font-semibold ${color}`}
          title={label}
        >
          {children}
        </span>
        {info && (
          <InfoHint title={infoTitle ?? "Price comparison"} tone="warning">
            {info}
          </InfoHint>
        )}
      </span>
      {detail && (
        <span className="mt-0.5 whitespace-nowrap font-mono text-[9px] text-muted-foreground">
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
  overrides,
}: {
  item?: GlobalItem;
  count: number;
  sellValue: number | null;
  overrides: Record<string, ManualPriceOverride>;
}) {
  const comparison = getItemSellComparison(item, overrides);
  const trader = comparison.bestTraderOffer;
  return (
    <div className="flex min-w-0 flex-col items-start justify-center border-l border-white/5 px-3">
      <span className="whitespace-nowrap font-mono text-sm font-semibold text-foreground">
        {formatRoundedRoubles(sellValue)}
      </span>
      {comparison.selectedSource === "manual" ? (
        <span className="mt-0.5 text-[8px] uppercase tracking-wide text-amber-300">
          Manual price
        </span>
      ) : comparison.pricesAreClose &&
        comparison.fleaPrice !== null &&
        trader ? (
        <span className="mt-0.5 block max-w-full space-y-0.5 text-[8px] leading-tight text-muted-foreground">
          <span className="block truncate">
            Flea {formatCompactPrice(comparison.fleaPrice * count)}
          </span>
          <span className="block truncate">
            {trader.vendor.name} {formatTraderOffer(trader, count, true)}
          </span>
        </span>
      ) : (
        <span className="mt-0.5 max-w-full truncate text-[8px] text-muted-foreground">
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
