import "server-only";

import type { ItemSummary } from "@/types/items";
import type { FullQuest } from "@/types/quests";
import type { Trader } from "@/types/traders";
import type { Station } from "@/types/hideout";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { TarkovDataMode } from "@/types/common";
import type { TarkovDataRepository } from "./types";
import { getEntitiesByIds, getEntityList } from "@/server/db/entity-data";
import { getCurrentPriceData, getStoredPriceHistoryData } from "@/server/db/price-data";

export function createTursoRepository(scope?: { mode: TarkovDataMode; releaseId: string }): TarkovDataRepository {
	function selectedRelease(mode: TarkovDataMode) {
		if (scope && scope.mode !== mode) throw new Error("Repository release scope does not match requested mode");
		return scope?.releaseId;
	}
	return {
		items: {
			getByIds: (mode, ids) => getEntitiesByIds<ItemSummary>(mode, "item", "items", ids, undefined, selectedRelease(mode)),
		},
		hideout: {
			getStations: (mode) => getEntityList<Station>(mode, "station", "stations", undefined, selectedRelease(mode)),
		},
		quests: {
			getAll: (mode) => getEntityList<FullQuest>(mode, "quest", "quests", undefined, selectedRelease(mode)),
			getByIds: (mode, ids) => getEntitiesByIds<FullQuest>(mode, "quest", "quests", ids, undefined, selectedRelease(mode)),
		},
		traders: {
			getAll: (mode) => getEntityList<Trader>(mode, "trader", "traders", undefined, selectedRelease(mode)),
			getByIds: (mode, ids) => getEntitiesByIds<Trader>(mode, "trader", "traders", ids, undefined, selectedRelease(mode)),
		},
		recipes: {
			getBarters: (mode) => getEntityList<BarterRecord>(mode, "barter", "barters", undefined, selectedRelease(mode)),
			getCrafts: (mode) => getEntityList<CraftRecord>(mode, "craft", "crafts", undefined, selectedRelease(mode)),
		},
		prices: {
			getCurrent: (mode, ids) => getCurrentPriceData(mode, ids, undefined, selectedRelease(mode)),
			getHistory: getStoredPriceHistoryData,
		},
	};
}

export const tursoTarkovDataRepository = createTursoRepository();
