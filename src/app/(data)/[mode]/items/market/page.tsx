import type { Metadata } from "next";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { MarketQueryPage } from "@/features/items/market/MarketQueryPage";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Flea Market Analysis",
		description:
			"Escape from Tarkov flea market price swings: biggest movers, price shocks, volatility, and 30-day highs and lows for every sellable item.",
		alternates: modeCanonical(gameMode, "/items/market"),
	};
}

/** Not prefetched: the whole-market payload loads on the client behind a Suspense fallback instead of inflating the HTML. */
export default async function MarketPage({ params }: { params: ModeRouteParams }) {
	return <MarketQueryPage mode={(await readRouteGameMode(params)).dataMode} />;
}
