import type { TarkovDataMode } from "@/types/common";
import { getActiveDataReleaseId } from "@/server/db/release-config";
import { getDefaultRepository } from "./query-utils";

export async function getDeferredPrices(mode: TarkovDataMode, ids: string[]) {
	const releaseId = await getActiveDataReleaseId(mode);
	const repository = await getDefaultRepository({ mode, releaseId });
	const result = await repository.prices.getCurrent(mode, ids);
	return result.data;
}
