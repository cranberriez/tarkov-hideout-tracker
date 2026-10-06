import "server-only";

import type { TarkovDataMode } from "@/types/common";
import type { TarkovDataRepository } from "./types";
import {
	getCachedItemsByIds,
	getCachedQuests,
	getCachedRecipes,
	getCachedStations,
	getCachedTraders,
	pickById,
} from "@/server/db/catalog-cache";
import { getCurrentPriceData, getStoredPriceHistoryData } from "@/server/db/price-data";
import { getCatalogVersion } from "@/server/db/postgres-read";
import { getStationRecipeGraph } from "@/server/db/station-recipes";

export function createPostgresRepository(scope?: {
	mode: TarkovDataMode;
	contentVersion: string;
}): TarkovDataRepository {
	const selectedVersions = new Map<TarkovDataMode, Promise<string>>();
	async function versionFor(mode: TarkovDataMode): Promise<string> {
		if (scope && scope.mode !== mode) throw new Error("Repository catalog scope does not match requested mode");
		if (scope) return scope.contentVersion;
		let selected = selectedVersions.get(mode);
		if (!selected) {
			selected = getCatalogVersion(mode);
			selectedVersions.set(mode, selected);
		}
		return selected;
	}
	return {
		items: {
			getByIds: async (mode, ids, options) => getCachedItemsByIds(mode, await versionFor(mode), ids, options),
		},
		hideout: {
			getStations: async (mode) => getCachedStations(mode, await versionFor(mode)),
		},
		quests: {
			getAll: async (mode) => getCachedQuests(mode, await versionFor(mode)),
			getByIds: async (mode, ids) => {
				const result = await getCachedQuests(mode, await versionFor(mode));
				return {
					data: Object.fromEntries(pickById(result.data, ids).map((quest) => [quest.id, quest])),
					updatedAt: result.updatedAt,
				};
			},
		},
		traders: {
			getAll: async (mode) => getCachedTraders(mode, await versionFor(mode)),
			getByIds: async (mode, ids) => {
				const result = await getCachedTraders(mode, await versionFor(mode));
				return {
					data: Object.fromEntries(pickById(result.data, ids).map((trader) => [trader.id, trader])),
					updatedAt: result.updatedAt,
				};
			},
		},
		recipes: {
			getForStation: async (mode, stationId, extraItemIds) =>
				getStationRecipeGraph(mode, stationId, await versionFor(mode), extraItemIds),
			getBarters: async (mode) => (await getCachedRecipes(mode, await versionFor(mode))).barters,
			getCrafts: async (mode) => (await getCachedRecipes(mode, await versionFor(mode))).crafts,
		},
		// Prices and stored history are refreshed independently of catalog versions.
		prices: {
			getCurrent: (mode, ids) => getCurrentPriceData(mode, ids),
			getHistory: (mode, itemId) => getStoredPriceHistoryData(mode, itemId),
		},
	};
}
