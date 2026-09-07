import type { TarkovDataMode } from "@/types/common";
import { getActiveDataReleaseId } from "@/server/db/release-config";
import { getDefaultRepository } from "./query-utils";

export function getDeferredPriceScope(mode: TarkovDataMode) {
    return { mode, releaseId: getActiveDataReleaseId(mode) };
}

export class DeferredPriceReleaseChangedError extends Error {}

export async function getDeferredPrices(mode: TarkovDataMode, releaseId: string, ids: string[]) {
    if (getActiveDataReleaseId(mode) !== releaseId) throw new DeferredPriceReleaseChangedError("The data release changed. Refresh the page to load prices.");
    const repository = await getDefaultRepository();
    return (await repository.prices.getCurrent(mode, ids)).data;
}
