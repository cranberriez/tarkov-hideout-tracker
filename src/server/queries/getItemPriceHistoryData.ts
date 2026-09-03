import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { ItemPriceHistoryPayload } from "@/types/contracts";
import { getDefaultRepository } from "./query-utils";

export async function getItemPriceHistoryData(
    itemId: string,
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<ItemPriceHistoryPayload> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const result = await dataRepository.prices.getHistory(mode, itemId);
    return { data: result.data, fetchedAt: result.updatedAt };
}
