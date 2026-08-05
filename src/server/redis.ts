import { Redis } from "@upstash/redis";
import { isCacheEnabled } from "./cache";

// Avoid creating a client at all when development cache access is disabled.
const client = isCacheEnabled ? Redis.fromEnv() : null;

export const redis = {
    async get<T>(key: string): Promise<T | null> {
        return client ? client.get<T>(key) : null;
    },

    async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
        if (client) return client.mget<T>(...keys);
        return keys.map(() => null) as T;
    },

    async mset(values: Record<string, unknown>) {
        return client ? client.mset(values) : "OK";
    },
};
