import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "../game-mode";
import type { CompletedItemsConversionData, LegacyProfileConversionData } from "../../types/contracts";
import { fetchJson } from "./request";

const CONVERSION_STALE_TIME = 5 * 60 * 1000;

export function legacyProfileConversionQueryOptions(mode: TarkovJsonGameMode) {
    return queryOptions({
        queryKey: ["conversion", "legacy-profile", mode] as const,
        queryFn: ({ signal }) => fetchJson<LegacyProfileConversionData>(
            `/api/conversion/legacy-profile?mode=${encodeURIComponent(mode)}`,
            { signal },
        ),
        staleTime: CONVERSION_STALE_TIME,
        retry: false,
    });
}

export function completedItemsConversionQueryOptions(mode: TarkovJsonGameMode) {
    return queryOptions({
        queryKey: ["conversion", "completed-items", mode] as const,
        queryFn: ({ signal }) => fetchJson<CompletedItemsConversionData>(
            `/api/conversion/completed-items?mode=${encodeURIComponent(mode)}`,
            { signal },
        ),
        staleTime: CONVERSION_STALE_TIME,
        retry: false,
    });
}
