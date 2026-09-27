import type { TarkovDataMode } from "@/types/common";
import { getCatalogVersion } from "@/server/db/postgres-read";
import { getDefaultRepository } from "./query-utils";

export async function getCurrentPageRepository(mode: TarkovDataMode) {
	const contentVersion = await getCatalogVersion(mode);
	return getDefaultRepository({ mode, contentVersion });
}
