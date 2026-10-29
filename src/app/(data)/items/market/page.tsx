import type { Metadata } from "next";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { MarketQueryPage } from "@/features/items/market/MarketQueryPage";

export const metadata: Metadata = {
	title: "Flea Market Analysis",
	description:
		"Escape from Tarkov flea market price swings: biggest movers, price shocks, volatility, and 30-day highs and lows for every sellable item.",
	alternates: { canonical: "/items/market" },
};

/** Not prefetched: the whole-market payload loads on the client behind a Suspense fallback instead of inflating the HTML. */
export default async function MarketPage() {
	return <MarketQueryPage mode={await getActiveTarkovJsonGameMode()} />;
}
