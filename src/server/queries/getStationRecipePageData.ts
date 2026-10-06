import { FUEL_TANK_ITEM_IDS, GENERATOR_STATION_ID, GRAPHICS_CARD_ITEM_ID } from "@/lib/cfg/hideout-power";
import { BITCOIN_FARM_STATION_ID, PHYSICAL_BITCOIN_ITEM_ID } from "@/lib/price-calculation/craft-rules";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import { getProfitPageData } from "./getProfitPageData";
import { getDefaultRepository } from "./query-utils";

/** Station crafts and their complete backwards acquisition graph, never the global profit graph. */
export async function getStationRecipePageData(
	mode: TarkovDataMode,
	stationId: string,
	repository?: TarkovDataRepository,
) {
	const source = repository ?? (await getDefaultRepository());
	const extraItemIds =
		stationId === BITCOIN_FARM_STATION_ID
			? [...FUEL_TANK_ITEM_IDS, GRAPHICS_CARD_ITEM_ID, PHYSICAL_BITCOIN_ITEM_ID]
			: stationId === GENERATOR_STATION_ID
				? [...FUEL_TANK_ITEM_IDS]
				: [];
	// Keep failures in the normal partial-data contract; never fall back to loading all recipes.
	const graph = Promise.resolve().then(() => {
		if (!source.recipes.getForStation) throw new Error("Station recipe reads are unavailable");
		return source.recipes.getForStation(mode, stationId, extraItemIds);
	});
	return getProfitPageData(
		mode,
		{
			...source,
			recipes: {
				getCrafts: async () => (await graph).crafts,
				getBarters: async () => (await graph).barters,
			},
		},
		{ includePrices: false, extraItemIds, compactSources: true },
	);
}
