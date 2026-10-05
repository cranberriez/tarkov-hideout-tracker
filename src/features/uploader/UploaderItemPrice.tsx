import type { CurrentPrice } from "@/types/prices";
import { describeFleaPrice, formatFleaPriceState, formatRoubles } from "@/lib/utils/market-price";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { traderInfo } from "@/lib/data/traders";

export function UploaderItemPrice({
	price,
	state,
	quantity,
}: {
	price?: CurrentPrice;
	state?: "pending" | "error" | "ready";
	quantity: number;
}) {
	if (state === "pending") return <span className="text-xs text-muted-foreground">Loading prices…</span>;
	if (state === "error") return <span className="text-xs text-warning">Price unavailable · use Retry prices</span>;
	if (!price) return <span className="text-xs text-muted-foreground">No price data</span>;
	const flea = describeFleaPrice({ marketPrice: price, priceLoadState: "ready" });
	const bestTrader = (price.sellFor ?? [])
		.filter((offer) => Number.isFinite(offer.priceRUB) && offer.priceRUB > 0)
		.reduce<NonNullable<CurrentPrice["sellFor"]>[number] | undefined>(
			(best, offer) => (!best || offer.priceRUB > best.priceRUB ? offer : best),
			undefined,
		);
	const change = price.changeLast48hPercent;
	const stale = price.fleaPriceReasons?.includes("stale");
	const changeLabel =
		typeof change === "number" && Number.isFinite(change)
			? `${change > 0 ? "+" : ""}${change.toFixed(1)}% / 48h`
			: "48h change unavailable";
	const updated = formatRelativeUpdatedAt(price.updatedAt ?? null);
	return (
		<span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
			<span>
				Flea: {formatFleaPriceState(flea)}
				{flea.kind === "price" ? " each" : ""}
				{flea.kind === "price" && flea.unstable ? " (unstable)" : ""}
				{price.fleaStability === "reference" ? " (reference estimate)" : ""}
			</span>
			<span>
				{bestTrader
					? `${traderInfo(bestTrader.traderId).name}: ${formatRoubles(Math.round(bestTrader.priceRUB))} each`
					: "Trader: no offer"}
			</span>
			<span className={stale ? "text-warning" : undefined}>
				{changeLabel}
				{stale ? " · stale" : ""}
			</span>
			{quantity > 1 && (
				<span>
					{flea.kind === "price"
						? `Stack flea: ${formatFleaPriceState(flea, { count: quantity })}`
						: bestTrader
							? `Stack trader: ${formatRoubles(Math.round(bestTrader.priceRUB * quantity))}`
							: "Stack value unavailable"}
				</span>
			)}
			{updated && <span>Updated {updated}</span>}
		</span>
	);
}
