import type { TarkovDataMode } from "@/types/common";
import { getDefaultRepository, getRecipeGraphItemIds } from "./query-utils";
import { buildChecklistReferences } from "./checklist-references";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import {
	canonicalPriceIds,
	isPriceItemId,
	type PriceRequest,
	type PriceResponse,
} from "../../lib/query/price-contract";

async function getPriceRepository(mode: TarkovDataMode) {
	const { getCatalogVersion } = await import("../db/postgres-read");
	return getDefaultRepository({ mode, contentVersion: await getCatalogVersion(mode) });
}

export async function getDeferredPrices(mode: TarkovDataMode, ids: string[]) {
	const repository = await getPriceRepository(mode);
	const result = await repository.prices.getCurrent(mode, ids);
	return result.data;
}

export async function getItemPriceResponse(
	request: PriceRequest,
	repository?: TarkovDataRepository,
): Promise<PriceResponse> {
	const { mode } = request;
	const dataRepository = repository ?? (await getPriceRepository(mode));
	let ids = request.ids;
	if (request.scope === "checklist") {
		// A failed domain must not publish a partial scope into the CDN cache.
		const [stations, quests] = await Promise.all([
			dataRepository.hideout.getStations(mode),
			dataRepository.quests.getAll(mode),
		]);
		ids = buildChecklistReferences(mode, stations.data, quests.data).itemIds;
	} else if (request.scope === "recipes") {
		const [barters, crafts] = await Promise.all([
			dataRepository.recipes.getBarters(mode),
			dataRepository.recipes.getCrafts(mode),
		]);
		ids = getRecipeGraphItemIds(barters.data, crafts.data);
	}
	const itemIds = canonicalPriceIds(ids ?? []).filter(isPriceItemId);
	const result = await dataRepository.prices.getCurrent(mode, itemIds);
	return { itemIds, prices: result.data };
}
