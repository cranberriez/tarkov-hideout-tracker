import type { TarkovDataMode } from "@/types/common";
import { getActiveDataReleaseId } from "@/server/db/release-config";
import { getDefaultRepository } from "./query-utils";

export async function getCurrentPageRepository(mode: TarkovDataMode) {
    const releaseId = await getActiveDataReleaseId(mode);
    return getDefaultRepository({ mode, releaseId });
}
