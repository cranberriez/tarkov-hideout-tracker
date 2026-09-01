export const CACHE_DOMAINS = [
    "hideoutStations",
    "itemCatalog",
    "itemBarters",
    "itemCrafts",
    "quests",
    "questsFull",
    "traders",
] as const;

export type CacheDomain = (typeof CACHE_DOMAINS)[number];
export type CacheOperation = "next" | "redisRead" | "redisWrite";

export interface CachePolicy {
    next: boolean;
    redisRead: boolean;
    redisWrite: boolean;
}

const DOMAIN_ENV_NAMES: Record<CacheDomain, string> = {
    hideoutStations: "HIDEOUT_STATIONS",
    itemCatalog: "ITEM_CATALOG",
    itemBarters: "ITEM_BARTERS",
    itemCrafts: "ITEM_CRAFTS",
    quests: "QUESTS",
    questsFull: "QUESTS_FULL",
    traders: "TRADERS",
};

const OPERATION_ENV_NAMES: Record<CacheOperation, string> = {
    next: "NEXT",
    redisRead: "REDIS_READ",
    redisWrite: "REDIS_WRITE",
};

function parseBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined || value === "") return undefined;
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
    return undefined;
}

function defaultCacheSetting(domain: CacheDomain, operation: CacheOperation): boolean {
    // Quest data is intentionally read-only in development. The dev panel can
    // compare the stored snapshot with upstream without silently replacing it.
    if (
        process.env.NODE_ENV === "development" &&
        operation === "redisWrite" &&
        (domain === "quests" || domain === "questsFull")
    ) {
        return false;
    }
    return true;
}

export function getCachePolicy(domain: CacheDomain): CachePolicy {
    const legacyDisabled =
        process.env.NODE_ENV === "development" && process.env.CACHE_ENABLED === "false";

    return Object.fromEntries(
        (Object.keys(OPERATION_ENV_NAMES) as CacheOperation[]).map((operation) => {
            if (legacyDisabled) return [operation, false];

            const operationName = OPERATION_ENV_NAMES[operation];
            const globalOverride = parseBoolean(process.env[`CACHE_${operationName}_ENABLED`]);
            const domainOverride = parseBoolean(
                process.env[`CACHE_${DOMAIN_ENV_NAMES[domain]}_${operationName}_ENABLED`],
            );

            return [
                operation,
                globalOverride ?? domainOverride ?? defaultCacheSetting(domain, operation),
            ];
        }),
    ) as unknown as CachePolicy;
}

/** Compatibility summary for the existing status dialog. */
export const isCacheEnabled = CACHE_DOMAINS.some((domain) => {
    const policy = getCachePolicy(domain);
    return policy.next || policy.redisRead || policy.redisWrite;
});

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

export function cacheWhenEnabled<T>(domain: CacheDomain, uncached: T, cached: T): T {
    return getCachePolicy(domain).next ? cached : uncached;
}
