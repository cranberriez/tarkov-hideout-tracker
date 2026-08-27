import { Redis } from "@upstash/redis";
import { isCacheEnabled, namespaceRedisKey } from "./cache";

// Avoid creating a client at all when development cache access is disabled.
const client = isCacheEnabled ? Redis.fromEnv() : null;

export const redis = {
    async get<T>(key: string): Promise<T | null> {
        return client ? client.get<T>(namespaceRedisKey(key)) : null;
    },

    async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
        if (client) return client.mget<T>(...keys.map((key) => namespaceRedisKey(key)));
        return keys.map(() => null) as T;
    },

    async mset(values: Record<string, unknown>) {
        if (!client) return "OK";

        const namespacedValues = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [namespaceRedisKey(key), value]),
        );
        return client.mset(namespacedValues);
    },
};
