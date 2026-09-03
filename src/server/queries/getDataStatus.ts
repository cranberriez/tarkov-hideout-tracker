import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { DataResult, TarkovDataMode } from "@/types/common";
import type { DataStatusDomain, DataStatusPayload } from "@/types/contracts";
import { getDefaultRepository } from "./query-utils";

function statusDomain<T>(
    result: PromiseSettledResult<DataResult<T>>,
    error: string,
): DataStatusDomain {
    if (result.status === "rejected") {
        return { available: false, updatedAt: null, diagnostics: null, error };
    }

    return {
        available: true,
        updatedAt: result.value.updatedAt,
        diagnostics: result.value.diagnostics ?? null,
        error: null,
    };
}

export async function getDataStatus(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<DataStatusPayload> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const [stationsResult, itemsResult] = await Promise.allSettled([
        dataRepository.hideout.getStations(mode),
        dataRepository.items.getCatalog(mode),
    ]);

    return {
        stations: statusDomain(
            stationsResult,
            "Hideout station data could not be loaded.",
        ),
        items: statusDomain(itemsResult, "Item catalog data could not be loaded."),
    };
}
