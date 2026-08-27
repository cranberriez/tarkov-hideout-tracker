const cacheDisabledInDevelopment =
    process.env.NODE_ENV === "development" && process.env.CACHE_ENABLED === "false";

export const isCacheEnabled = !cacheDisabledInDevelopment;

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
