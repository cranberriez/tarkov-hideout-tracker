import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { ProfitPageData } from "@/types/contracts";
import { dedupeIds, getDefaultRepository, getRecipeGraphItemIds, mergePricedItems } from "./query-utils";

export async function getProfitPageData(
	mode: TarkovDataMode,
	repository?: TarkovDataRepository,
	options: { includePrices?: boolean; extraItemIds?: readonly string[]; compactSources?: boolean } = {},
): Promise<ProfitPageData> {
	const dataRepository = repository ?? (await getDefaultRepository());
	const [bartersResult, craftsResult] = await Promise.allSettled([
		dataRepository.recipes.getBarters(mode),
		dataRepository.recipes.getCrafts(mode),
	]);
	const barters = bartersResult.status === "fulfilled" ? bartersResult.value.data : [];
	const crafts = craftsResult.status === "fulfilled" ? craftsResult.value.data : [];
	const itemIds = dedupeIds([...getRecipeGraphItemIds(barters, crafts), ...(options.extraItemIds ?? [])]).sort();
	const stationIds = new Set(crafts.map((craft) => craft.stationId));

	const [itemsResult, pricesResult, tradersResult, stationsResult] = await Promise.allSettled([
		dataRepository.items.getByIds(mode, itemIds),
		options.includePrices === false
			? Promise.resolve({ data: {}, updatedAt: null })
			: dataRepository.prices.getCurrent(mode, itemIds),
		// The catalog is small; serialize all of it so trader loyalty settings can
		// list every trader (e.g. Fence), not only those the recipe graph references.
		options.compactSources ? Promise.resolve(null) : dataRepository.traders.getAll(mode),
		stationIds.size > 0 ? dataRepository.hideout.getStations(mode) : Promise.resolve(null),
	]);
	const itemRecords = itemsResult.status === "fulfilled" ? itemsResult.value.data : null;
	const traderIds = dedupeIds([
		...barters.map((recipe) => recipe.traderId),
		...Object.values(itemRecords ?? {}).flatMap((item) => (item.buyFromTrader ?? []).map((offer) => offer.traderId)),
	]);
	const [compactTradersResult] = await Promise.allSettled([
		options.compactSources && traderIds.length
			? dataRepository.traders.getByIds(mode, traderIds)
			: Promise.resolve(null),
	]);
	// Unlock requirements come from the recipes/offers; only resolve their labels
	// by known ID. Never scan quest rewards to infer acquisition eligibility.
	const taskUnlockIds = dedupeIds([
		...barters.flatMap((recipe) => (recipe.taskUnlockId ? [recipe.taskUnlockId] : [])),
		...crafts.flatMap((recipe) => (recipe.taskUnlockId ? [recipe.taskUnlockId] : [])),
		...Object.values(itemRecords ?? {}).flatMap((item) =>
			(item.buyFromTrader ?? []).flatMap((offer) => (offer.taskUnlockId ? [offer.taskUnlockId] : [])),
		),
	]);
	const [taskUnlocksResult] = await Promise.allSettled([
		taskUnlockIds.length ? dataRepository.quests.getByIds(mode, taskUnlockIds) : Promise.resolve(null),
	]);
	const taskUnlocksValue = taskUnlocksResult.status === "fulfilled" ? taskUnlocksResult.value : null;
	const taskUnlocksById = Object.fromEntries(
		taskUnlockIds.flatMap((id) => {
			const quest = taskUnlocksValue?.data[id];
			return quest ? [[id, { id, name: quest.name, wikiLink: quest.wikiLink }]] : [];
		}),
	);
	const unresolvedTaskUnlockIds = taskUnlockIds.filter((id) => !taskUnlocksById[id]);
	const priceRecords = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};
	const merged = itemRecords
		? mergePricedItems(itemIds, itemRecords, priceRecords)
		: { items: null, unresolvedItemIds: [...itemIds] };
	const tradersValue = tradersResult.status === "fulfilled" ? tradersResult.value : null;
	const stationsValue = stationsResult.status === "fulfilled" ? stationsResult.value : null;
	const compactTradersValue = compactTradersResult.status === "fulfilled" ? compactTradersResult.value : null;
	const traders = options.compactSources ? Object.values(compactTradersValue?.data ?? {}) : (tradersValue?.data ?? []);
	const stations = stationsValue
		? stationsValue.data
				.filter((station) => stationIds.has(station.id))
				.map(({ id, name, normalizedName, imageLink }) => ({
					id,
					name,
					normalizedName,
					imageLink,
				}))
		: [];

	return {
		barters,
		crafts,
		items: merged.items,
		itemIds,
		unresolvedItemIds: merged.unresolvedItemIds,
		traders,
		stations,
		taskUnlocksById,
		unresolvedTaskUnlockIds,
		freshness: {
			bartersUpdatedAt: bartersResult.status === "fulfilled" ? bartersResult.value.updatedAt : null,
			craftsUpdatedAt: craftsResult.status === "fulfilled" ? craftsResult.value.updatedAt : null,
			itemsUpdatedAt: itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
			pricesUpdatedAt: pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
			tradersUpdatedAt: compactTradersValue?.updatedAt ?? tradersValue?.updatedAt ?? null,
			stationsUpdatedAt: stationsValue?.updatedAt ?? null,
			taskUnlocksUpdatedAt: taskUnlocksValue?.updatedAt ?? null,
		},
		errors: {
			taskUnlocks:
				taskUnlocksResult.status === "rejected"
					? "Quest names could not be loaded. Unlock requirements still apply."
					: unresolvedTaskUnlockIds.length
						? "Some quest names are unavailable. Unlock requirements still apply."
						: null,
			barters: bartersResult.status === "rejected" ? "Barter data could not be loaded." : null,
			crafts: craftsResult.status === "rejected" ? "Craft data could not be loaded." : null,
			items: itemsResult.status === "rejected" ? "Recipe item summaries could not be loaded." : null,
			prices: pricesResult.status === "rejected" ? "Recipe item prices could not be loaded." : null,
			traders:
				tradersResult.status === "rejected" || compactTradersResult.status === "rejected"
					? "Trader source data could not be loaded."
					: null,
			stations: stationsResult.status === "rejected" ? "Hideout station source data could not be loaded." : null,
		},
	};
}
