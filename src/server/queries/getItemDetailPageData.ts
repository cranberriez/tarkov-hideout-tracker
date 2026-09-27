import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { ItemDetailPageData } from "@/types/contracts";
import { getDefaultRepository } from "./query-utils";

/**
 * Bounded one-item read for `/items/[itemId]`. Relations, usage, acquisition, and
 * prices keep loading through their existing feature-owned client queries.
 */
export async function getItemDetailPageData(
    mode: TarkovDataMode,
    itemId: string,
    repository?: TarkovDataRepository,
): Promise<ItemDetailPageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    try {
        const { data } = await dataRepository.items.getByIds(mode, [itemId]);
        return { item: data[itemId] ?? null, error: null };
    } catch {
        return { item: null, error: "Item data could not be loaded." };
    }
}
