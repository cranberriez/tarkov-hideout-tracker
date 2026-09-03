import { formatCompactRoubles, formatRoubles } from "@/lib/utils/market-price";
import type { VendorPrice } from "@/types/prices";

export function formatSignedRoubles(value: number | null) {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${formatRoubles(Math.round(value))}`;
}

export function formatRoundedRoubles(value: number | null) {
  return formatRoubles(value === null ? null : Math.round(value));
}

export function formatCompactPrice(value: number | null) {
  return value === null ? "-" : `${formatCompactRoubles(Math.round(value))} ₽`;
}

export function formatTraderOffer(
  offer: VendorPrice,
  count: number,
  includeRoubleComparison: boolean,
) {
  const amount = (offer.price ?? offer.priceRUB) * count;
  const formattedAmount = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
  const original =
    offer.currency === "USD"
      ? `$${formattedAmount}`
      : offer.currency === "EUR"
        ? `€${formattedAmount}`
        : offer.currency === "RUB" || !offer.currency
          ? `${formattedAmount} ₽`
          : `${formattedAmount} ${offer.currency}`;
  if (!includeRoubleComparison || offer.currency === "RUB" || !offer.currency)
    return original;
  return `${original} (${formatCompactPrice(offer.priceRUB * count)})`;
}

export function formatQuantity(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.round((seconds % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
