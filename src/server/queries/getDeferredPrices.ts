import type { TarkovDataMode } from "@/types/common";
import { getActiveDataReleaseId } from "@/server/db/release-config";
import { getDefaultRepository } from "./query-utils";

export async function getDeferredPriceScope(mode: TarkovDataMode) {
	return { mode, releaseId: await getActiveDataReleaseId(mode) };
}

export class DeferredPriceReleaseChangedError extends Error {}

export async function getDeferredPrices(mode: TarkovDataMode, releaseId: string, ids: string[]) {
	if ((await getActiveDataReleaseId(mode)) !== releaseId)
		throw new DeferredPriceReleaseChangedError("The data release changed. Refresh the page to load prices.");
	const repository = await getDefaultRepository({ mode, releaseId });
	return (await repository.prices.getCurrent(mode, ids)).data;
}
