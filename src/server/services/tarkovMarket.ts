import { redis } from "@/server/redis";
import type { TimedResponse } from "@/types";

const CACHE_WINDOW_MS = 45 * 60 * 1000; // 45 minutes
// Toggle: whether to cache empty/failed acquisitions (null results).
// When true, we also cache "no match" responses so we don't keep hammering
// Tarkov Market for items that don't return data, further reducing 429 risk.
const CACHE_EMPTY_RESULTS = true;
// v4 adds game-mode separation (PVP vs PVE) to Redis keys.
const REDIS_KEY_PREFIX = "tarkov-market:item:v4";
const RATE_LIMIT_KEY = "tarkov-market:rate-limit-until";
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 60 * 1000;

type GameMode = "PVP" | "PVE";

const TARKOV_MARKET_ITEM_ENDPOINT_PVP = "https://api.tarkov-market.app/api/v1/item";
const TARKOV_MARKET_ITEM_ENDPOINT_PVE = "https://api.tarkov-market.app/api/v1/pve/item";

export interface TarkovMarketItem {
    uid: string;
    name: string;
    tags?: string[];
    shortName?: string;
    price?: number;
    basePrice?: number;
    avg24hPrice?: number;
    avg7daysPrice?: number;
    traderName?: string;
    traderPrice?: number;
    traderPriceCur?: string;
    updated?: string;
    slots?: number;
    diff24h?: number;
    diff7days?: number;
    icon?: string;
    link?: string;
    wikiLink?: string;
    img?: string;
    imgBig?: string;
    bsgId?: string;
    isFunctional?: boolean;
    reference?: string;
}

interface RedisMeta {
    updatedAt: number;
}

function buildRedisKeys(normalizedName: string, mode: GameMode) {
    const modeKey = mode.toLowerCase();
    const baseKey = `${REDIS_KEY_PREFIX}:${modeKey}:${normalizedName}`;
    return {
        bodyKey: baseKey,
        metaKey: `${baseKey}:meta`,
    };
}

export function normalizeNameForMatch(name: string): string {
    return (
        name
            .toLowerCase()
            // Replace any sequence of non-alphanumeric characters (spaces, punctuation, etc)
            // with a single dash, then trim leading/trailing dashes. This mirrors our
            // internal normalizedName style like "military-flash-drive".
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
    );
}

function pickBestMatch(
    queryNormalizedName: string,
    items: TarkovMarketItem[]
): TarkovMarketItem | null {
    if (!items.length) return null;

    const target = queryNormalizedName.toLowerCase();

    let best: { item: TarkovMarketItem; score: number } | null = null;

    for (const item of items) {
        const normalizedFromName = item.name ? normalizeNameForMatch(item.name) : "";
        const normalizedFromShort = item.shortName ? normalizeNameForMatch(item.shortName) : "";

        let score = 0;

        if (normalizedFromName === target) {
            score = 3;
        } else if (normalizedFromName.includes(target) || target.includes(normalizedFromName)) {
            score = 2;
        } else if (normalizedFromShort && normalizedFromShort === target) {
            score = 1;
        }

        if (!best || score > best.score) {
            best = { item, score };
        }
    }

    if (!best || best.score === 0) return null;
    return best.item;
}

export async function getTarkovMarketItemByNormalizedName(
    normalizedName: string,
    mode: GameMode = "PVP"
): Promise<TimedResponse<TarkovMarketItem | null>> {
    const trimmed = normalizedName.trim();
    if (!trimmed) {
        return {
            data: null,
            updatedAt: Date.now(),
        };
    }

    const { bodyKey, metaKey } = buildRedisKeys(trimmed, mode);

    const [cachedBody, cachedMeta] = await redis.mget<[string, RedisMeta]>(bodyKey, metaKey);

    let isFresh = false;

    if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
        const age = Date.now() - cachedMeta.updatedAt;
        if (age < CACHE_WINDOW_MS) {
            isFresh = true;
        }
    }

    if (isFresh && cachedBody) {
        if (typeof cachedBody === "object") {
            return cachedBody as TimedResponse<TarkovMarketItem | null>;
        }
        return JSON.parse(cachedBody) as TimedResponse<TarkovMarketItem | null>;
    }

    const apiKey = process.env.TARKOV_MARKET_KEY;
    if (!apiKey) {
        console.error("TARKOV_MARKET_KEY is not set in the environment");
        if (cachedBody) {
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<TarkovMarketItem | null>;
        }
        throw new Error("Tarkov Market API key is missing");
    }

    const endpoint =
        mode === "PVE" ? TARKOV_MARKET_ITEM_ENDPOINT_PVE : TARKOV_MARKET_ITEM_ENDPOINT_PVP;
    const url = `${endpoint}?q=${encodeURIComponent(trimmed)}`;

    const rateLimitUntilRaw = await redis.get(RATE_LIMIT_KEY);
    const rateLimitUntil =
        typeof rateLimitUntilRaw === "string"
            ? parseInt(rateLimitUntilRaw, 10)
            : typeof rateLimitUntilRaw === "number"
            ? rateLimitUntilRaw
            : null;

    if (rateLimitUntil && Date.now() < rateLimitUntil) {
        if (cachedBody) {
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<TarkovMarketItem | null>;
        }
        return {
            data: null,
            updatedAt: Date.now(),
        };
    }

    const res = await fetch(url, {
        method: "GET",
        headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
        },
        cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
        const text = await res.text();
        const snippet = text.slice(0, 500);
        const isHtml = /text\/html/i.test(contentType) || snippet.trim().startsWith("<");
        const isRateLimit = res.status === 429;

        let shouldLog = true;

        if (isHtml || isRateLimit) {
            let retryMs = DEFAULT_RATE_LIMIT_BACKOFF_MS;
            const retryAfterHeader = res.headers.get("retry-after");
            if (retryAfterHeader) {
                const asSeconds = Number(retryAfterHeader);
                if (!Number.isNaN(asSeconds) && asSeconds > 0) {
                    retryMs = asSeconds * 1000;
                }
            }
            const limitUntil = Date.now() + retryMs;

            // Set the rate limit key. nx: true ensures we only set it if it doesn't exist.
            // If it already exists, it means another concurrent request handled it.
            const setResult = await redis.set(RATE_LIMIT_KEY, String(limitUntil), {
                px: retryMs,
                nx: true,
            });

            // If we didn't set the key (because it was already set), we skip logging to avoid spamming.
            if (!setResult) {
                shouldLog = false;
            }
        }

        if (shouldLog) {
            const logData = {
                status: res.status,
                contentType,
                mode,
                name: trimmed,
                bodySnippet: snippet,
            };

            if (isHtml) {
                console.error("Tarkov Market HTML/Rate-limit response", logData);
            } else {
                console.error("Tarkov Market item error", logData);
            }
        }

        if (cachedBody) {
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<TarkovMarketItem | null>;
        }
        throw new Error("Failed to fetch Tarkov Market item");
    }

    let json: TarkovMarketItem[];
    try {
        json = (await res.json()) as TarkovMarketItem[];
    } catch (error) {
        const text = await res.text().catch(() => "");
        console.error("Failed to parse Tarkov Market JSON", {
            name: trimmed,
            contentType,
            bodySnippet: text.slice(0, 500),
            error,
        });
        if (cachedBody) {
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<TarkovMarketItem | null>;
        }
        throw new Error("Failed to parse Tarkov Market response as JSON");
    }

    if (!Array.isArray(json) || json.length === 0) {
        console.warn("Tarkov Market returned no results for", trimmed);
    }

    const bestMatch = pickBestMatch(trimmed, json);

    if (!bestMatch && json.length > 0) {
        console.warn("Tarkov Market returned items but none matched by name", {
            query: trimmed,
            returnedNames: json.map((i) => i.name),
        });
    }

    const updatedAt = Date.now();

    const data: TarkovMarketItem | null = bestMatch ?? null;

    // Optionally skip caching when we have no successful match
    if (!data && !CACHE_EMPTY_RESULTS) {
        return {
            data: null,
            updatedAt,
        };
    }

    const body: TimedResponse<TarkovMarketItem | null> = {
        data,
        updatedAt,
    };

    const jsonBody = JSON.stringify(body);

    await redis.mset({
        [bodyKey]: jsonBody,
        [metaKey]: { updatedAt },
    });

    return body;
}
