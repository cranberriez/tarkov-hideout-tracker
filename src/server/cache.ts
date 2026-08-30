const cacheDisabledInDevelopment =
    process.env.NODE_ENV === "development" && process.env.CACHE_ENABLED === "false";

export const isCacheEnabled = !cacheDisabledInDevelopment;

// Shared provider datasets are large and change infrequently. Keep development
// caching short enough for local iteration while production uses a full day.
export const DATA_CACHE_REVALIDATE_SECONDS =
    process.env.NODE_ENV === "development" ? 5 * 60 : 24 * 60 * 60;
export const DATA_CACHE_MAX_AGE_MS = DATA_CACHE_REVALIDATE_SECONDS * 1000;

/**
 * Keep development Redis data isolated when a local environment points at a
 * shared Redis database. Production and all non-development environments keep
 * the historical key bytes unchanged.
 */
export function namespaceRedisKey(key: string, nodeEnv = process.env.NODE_ENV): string {
    return nodeEnv === "development" ? `dev:${key}` : key;
}

export function cacheWhenEnabled<T>(uncached: T, cached: T): T {
    return isCacheEnabled ? cached : uncached;
}
