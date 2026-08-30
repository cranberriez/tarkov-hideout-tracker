import { Redis } from "@upstash/redis";
import { after } from "next/server";
import { isCacheEnabled, namespaceRedisKey } from "./cache";

type RedisClient = ReturnType<typeof Redis.fromEnv>;

export type RedisCacheState = "disabled" | "unchecked" | "available" | "unavailable";

export interface RedisCacheStatus {
    state: RedisCacheState;
    lastAttemptAt: number | null;
    lastError: string | null;
}

let client: RedisClient | null = null;
let status: RedisCacheStatus = {
    state: isCacheEnabled ? "unchecked" : "disabled",
    lastAttemptAt: null,
    lastError: null,
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function markAvailable() {
    status = { state: "available", lastAttemptAt: Date.now(), lastError: null };
}

function markUnavailable(operation: string, error: unknown) {
    const message = errorMessage(error);
    if (status.state !== "unavailable" || status.lastError !== message) {
        console.warn(`Redis ${operation} failed; continuing without Redis (${message})`);
    }
    status = { state: "unavailable", lastAttemptAt: Date.now(), lastError: message };
    // Upstash uses stateless HTTP requests, but rebuilding the lightweight client
    // on the next operation also recovers from configuration/runtime changes.
    client = null;
}

function getClient(): RedisClient | null {
    if (!isCacheEnabled) return null;
    client ??= Redis.fromEnv();
    return client;
}

function nullsForKeys<T extends unknown[]>(keys: string[]): T {
    return keys.map(() => null) as T;
}

export const redis = {
    async get<T>(key: string): Promise<T | null> {
        if (!isCacheEnabled) return null;
        try {
            const activeClient = getClient();
            const value = activeClient
                ? await activeClient.get<T>(namespaceRedisKey(key))
                : null;
            markAvailable();
            return value;
        } catch (error) {
            markUnavailable("read", error);
            return null;
        }
    },

    async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
        if (!isCacheEnabled) return nullsForKeys<T>(keys);
        try {
            const activeClient = getClient();
            const values = activeClient
                ? await activeClient.mget<T>(...keys.map((key) => namespaceRedisKey(key)))
                : nullsForKeys<T>(keys);
            markAvailable();
            return values;
        } catch (error) {
            markUnavailable("read", error);
            return nullsForKeys<T>(keys);
        }
    },

    async mset(values: Record<string, unknown>): Promise<"OK" | null> {
        if (!isCacheEnabled) return "OK";
        try {
            const activeClient = getClient();
            if (!activeClient) return null;
            const namespacedValues = Object.fromEntries(
                Object.entries(values).map(([key, value]) => [namespaceRedisKey(key), value]),
            );
            const result = await activeClient.mset(namespacedValues);
            markAvailable();
            return result;
        } catch (error) {
            markUnavailable("write", error);
            return null;
        }
    },
};

export function getRedisCacheStatus(): RedisCacheStatus {
    return { ...status };
}

/**
 * Schedule validated cache data to be persisted after the response/prerender.
 * `after` is supported by Next.js in development and by Vercel's waitUntil
 * integration. Direct service calls outside a Next lifecycle fall back to an
 * immediate best-effort write.
 */
export async function writeRedisAfterResponse(
    values: Record<string, unknown>,
    label: string,
): Promise<void> {
    if (!isCacheEnabled) return;

    const write = async () => {
        await redis.mset(values);
    };

    try {
        after(write);
    } catch (error) {
        console.warn(
            `Could not schedule the ${label} Redis write after the response; writing immediately (${errorMessage(error)})`,
        );
        await write();
    }
}
