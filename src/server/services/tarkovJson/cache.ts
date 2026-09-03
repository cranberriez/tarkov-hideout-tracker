import type { DataResult } from "@/types/common";
import { DATA_CACHE_MAX_AGE_MS } from "../../cache";
import { PROGRESSION_DATA_FROZEN } from "../../../lib/cfg/cacheVersions";

export function parseNonEmptyTimedResponse<TPayload>(
    cachedBody: unknown,
    selectEntries: (payload: TPayload) => unknown[] | undefined,
): DataResult<TPayload> | null {
    if (!cachedBody) return null;

    try {
        const parsed =
            typeof cachedBody === "string"
                ? (JSON.parse(cachedBody) as DataResult<TPayload>)
                : (cachedBody as DataResult<TPayload>);
        const entries = parsed?.data ? selectEntries(parsed.data) : undefined;
        return Array.isArray(entries) && entries.length > 0 ? parsed : null;
    } catch (error) {
        console.error("Ignoring invalid cached Tarkov data", error);
        return null;
    }
}

export function markStaleFallback<TPayload>(
    response: DataResult<TPayload>,
): DataResult<TPayload> {
    return {
        ...response,
        diagnostics: {
            provider: response.diagnostics?.provider ?? "json",
            ...response.diagnostics,
            upstreamStatus: "stale-fallback",
        },
    };
}

export function isFreshCache(cachedMeta: unknown, now = Date.now()): boolean {
    if (!cachedMeta || typeof cachedMeta !== "object" || !("updatedAt" in cachedMeta)) {
        return false;
    }

    const updatedAt = (cachedMeta as { updatedAt?: unknown }).updatedAt;
    return typeof updatedAt === "number" && now - updatedAt < DATA_CACHE_MAX_AGE_MS;
}

export function isProgressionCacheUsable(cachedMeta: unknown, now = Date.now()): boolean {
    if (PROGRESSION_DATA_FROZEN) {
        return (
            !!cachedMeta &&
            typeof cachedMeta === "object" &&
            "updatedAt" in cachedMeta &&
            typeof (cachedMeta as { updatedAt?: unknown }).updatedAt === "number"
        );
    }

    return isFreshCache(cachedMeta, now);
}
