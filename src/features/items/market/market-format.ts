import { formatCompactRoubles, formatRoubles } from "@/lib/utils/market-price";
import type { MarketOverviewItem } from "@/types/contracts";
import type { PreviewItem } from "@/components/entities/item-link";

export const EMPTY = "–";

export function formatPercent(value: number | null, { signed = true } = {}) {
	if (value === null) return EMPTY;
	const amount = value * 100;
	const digits = Math.abs(amount) < 10 ? 1 : 0;
	return `${signed && amount > 0 ? "+" : amount < 0 ? "−" : ""}${Math.abs(amount).toFixed(digits)}%`;
}

export function formatSignedRoubles(value: number | null, compact = false) {
	if (value === null) return EMPTY;
	const amount = Math.abs(Math.round(value));
	// Values just under a million would otherwise round to "1000k".
	const text = compact
		? `${amount >= 999_500 && amount < 1_000_000 ? "1.0m" : formatCompactRoubles(amount)} ₽`
		: formatRoubles(amount);
	return `${value > 0 ? "+" : value < 0 ? "−" : ""}${text}`;
}

export function formatPrice(value: number | null) {
	return value === null ? EMPTY : formatRoubles(Math.round(value));
}

/** Text color for a signed change; zero and missing stay neutral. */
export function changeTone(value: number | null) {
	if (!value) return "text-muted-foreground";
	return value > 0 ? "text-success" : "text-danger";
}

export function toPreviewItem(item: MarketOverviewItem): PreviewItem {
	return { id: item.id, name: item.name, shortName: item.shortName ?? undefined };
}
