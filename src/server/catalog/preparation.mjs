import { stripCatalogDto } from "../../../db-scripts/lib/catalog-dto.mjs";
import { MODES } from "../../../db-scripts/lib/postgres-catalog.mjs";

function makeResult(data, updatedAt) {
	return { data, updatedAt };
}
function byId(map, ids) {
	return Object.fromEntries([...new Set(ids)].flatMap((id) => (map.has(id) ? [[id, map.get(id)]] : [])));
}

function memoryRepository(data) {
	const items = new Map(data.items.map((row) => [row.id, row]));
	const quests = new Map(data.quests.map((row) => [row.id, row]));
	const traders = new Map(data.traders.map((row) => [row.id, row]));
	return {
		items: {
			getCatalog: async () => makeResult(data.items, data.freshness.items),
			getByIds: async (_mode, ids) => makeResult(byId(items, ids), data.freshness.items),
		},
		hideout: { getStations: async () => makeResult(data.stations, data.freshness.stations) },
		quests: {
			getAll: async () => makeResult(data.quests, data.freshness.quests),
			getByIds: async (_mode, ids) => makeResult(byId(quests, ids), data.freshness.quests),
		},
		traders: {
			getAll: async () => makeResult(data.traders, data.freshness.traders),
			getByIds: async (_mode, ids) => makeResult(byId(traders, ids), data.freshness.traders),
		},
		recipes: {
			getBarters: async () => makeResult(data.barters, data.freshness.barters),
			getCrafts: async () => makeResult(data.crafts, data.freshness.crafts),
		},
		prices: {
			getCurrent: async () => makeResult({}, data.freshness.items),
			getHistory: async () => {
				throw new Error("Price history is not part of catalog ingestion");
			},
		},
	};
}

export async function loadModeData(mode, services) {
	const [itemResult, skillsResult, stationResult, questResult, traderResult, barterResult, craftResult] =
		await Promise.all([
			services.itemsService.getGlobalItemList(mode),
			services.itemsService.getGlobalSkillList(mode),
			services.hideoutService.getJsonHideoutStations(mode),
			services.questsService.getCurrentJsonFullQuestData(mode),
			services.tradersService.getJsonTraders(mode),
			services.recipesService.getBarterIndex(mode),
			services.recipesService.getCraftIndex(mode),
		]);
	const data = {
		items: itemResult.data.items.map((sourceItem) => {
			const item = { ...sourceItem };
			delete item.marketPrice;
			delete item.buyFromTrader;
			return item;
		}),
		skills: skillsResult.data.skills,
		stations: stationResult.data.stations,
		quests: questResult.data.quests,
		traders: traderResult.data.traders,
		barters: Object.values(barterResult.data.bartersByItemId).flat(),
		crafts: Object.values(craftResult.data.craftsByItemId).flat(),
		freshness: {
			items: itemResult.updatedAt,
			skills: skillsResult.updatedAt,
			stations: stationResult.updatedAt,
			quests: questResult.updatedAt,
			traders: traderResult.updatedAt,
			barters: barterResult.updatedAt,
			crafts: craftResult.updatedAt,
		},
	};
	return data;
}

export async function prepareDetails(mode, data, services) {
	const repo = memoryRepository(data);
	data.itemDetails = [];
	const batchSize = 10;
	for (let offset = 0; offset < data.items.length; offset += batchSize) {
		const entries = await Promise.all(
			data.items.slice(offset, offset + batchSize).map(async (item) => {
				const [relations, usage, acquisition] = await Promise.all([
					services.relationsQuery.getItemRelationsData(item.id, mode, repo),
					services.usageQuery.getItemUsageData(item.id, mode, repo),
					services.acquisitionQuery.getItemAcquisitionTreeData(item.id, mode, repo),
				]);
				return {
					itemId: item.id,
					relations: stripCatalogDto(relations),
					usage: stripCatalogDto(usage),
					acquisition: stripCatalogDto(acquisition),
				};
			}),
		);
		data.itemDetails.push(...entries);
		if (offset === 0 || offset + batchSize >= data.items.length || (offset + batchSize) % 500 === 0)
			console.log(
				`  ${mode}: prepared item details ${Math.min(offset + batchSize, data.items.length)}/${data.items.length}`,
			);
	}
}

export async function prepareCatalog(services) {
	/** @type {Record<string, object>} */
	const modesData = {};
	for (const mode of MODES) {
		console.log(`Fetching normalized ${mode} catalog�`);
		const data = await loadModeData(mode, services);
		await prepareDetails(mode, data, services);
		modesData[mode] = data;
	}
	return modesData;
}
