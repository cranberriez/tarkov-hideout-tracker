import "server-only";

import type { TarkovDataMode } from "@/types/common";
import type { TarkovDataRepository } from "./types";
import { getItemsByIds, getQuests, getRecipes, getStations, getTraders } from "@/server/db/domain-data";
import { getCurrentPriceData, getStoredPriceHistoryData } from "@/server/db/price-data";
import { getCatalogVersion, withStableCatalogRead } from "@/server/db/postgres-read";
import { getPostgresDb } from "@/server/postgres/connection";

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
			getByIds: async (mode, ids) => getItemsByIds(mode, ids, getPostgresDb(), await versionFor(mode)),
		},
		hideout: {
			getStations: async (mode) => getStations(mode, getPostgresDb(), await versionFor(mode)),
		},
		quests: {
			getAll: async (mode) => getQuests(mode, getPostgresDb(), await versionFor(mode)),
			getByIds: async (mode, ids) => {
				const version = await versionFor(mode);
				const result = await getQuests(mode, getPostgresDb(), version, ids);
				return { data: Object.fromEntries(result.data.map((quest) => [quest.id, quest])), updatedAt: result.updatedAt };
			},
		},
		traders: {
			getAll: async (mode) => getTraders(mode, getPostgresDb(), await versionFor(mode)),
			getByIds: async (mode, ids) => {
				const version = await versionFor(mode);
				const result = await getTraders(mode, getPostgresDb(), version, ids);
				return {
					data: Object.fromEntries(result.data.map((trader) => [trader.id, trader])),
					updatedAt: result.updatedAt,
				};
			},
		},
		recipes: {
			getBarters: async (mode) => (await getRecipes(mode, getPostgresDb(), await versionFor(mode))).barters,
			getCrafts: async (mode) => (await getRecipes(mode, getPostgresDb(), await versionFor(mode))).crafts,
		},
		prices: {
			getCurrent: async (mode, ids) => {
				const version = await versionFor(mode);
				const result = await withStableCatalogRead(
					mode,
					async () => getCurrentPriceData(mode, ids),
					undefined,
					version,
				);
				return result.data;
			},
			getHistory: async (mode, itemId) => {
				const version = await versionFor(mode);
				const result = await withStableCatalogRead(
					mode,
					async () => getStoredPriceHistoryData(mode, itemId),
					undefined,
					version,
				);
				return result.data;
			},
		},
	};
}
