const cacheDisabledInDevelopment =
    process.env.NODE_ENV === "development" && process.env.CACHE_ENABLED === "false";

export const isCacheEnabled = !cacheDisabledInDevelopment;

export function cacheWhenEnabled<T>(uncached: T, cached: T): T {
    return isCacheEnabled ? cached : uncached;
}
