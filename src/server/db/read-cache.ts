// Leave ample room below Next's 2 MB entry limit, including cache metadata.
export const MAX_CACHE_BYTES = 512 * 1024;
export const ENTITY_BATCH_SIZE = 128;

export function canonicalIds(ids: readonly string[]): string[] {
    return [...new Set(ids)].sort();
}

export async function mapBatches<T>(
    ids: readonly string[],
    read: (batch: string[]) => Promise<T>,
): Promise<T[]> {
    const batches = Array.from({ length: Math.max(1, Math.ceil(ids.length / ENTITY_BATCH_SIZE)) },
        (_, index) => ids.slice(index * ENTITY_BATCH_SIZE, (index + 1) * ENTITY_BATCH_SIZE));
    const results: T[] = [];
    // Three independent batches at a time; Promise.all preserves input order.
    for (let index = 0; index < batches.length; index += 3) {
        results.push(...await Promise.all(batches.slice(index, index + 3).map(read)));
    }
    return results;
}

class OversizedCacheValue extends Error {}

export async function boundedReadCache<T>(
    key: string[],
    read: () => Promise<T>,
    revalidate: number | false = false,
    cache?: typeof import("next/cache").unstable_cache,
): Promise<T> {
    const unstable_cache = cache ?? (await import("next/cache")).unstable_cache;
    let oversized: { value: T } | undefined;
    try {
        return await unstable_cache(async () => {
            const value = await read();
            if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_CACHE_BYTES) {
                oversized = { value };
                // Rejected callbacks are not stored. Still deliver a valid large
                // record to the caller without truncation or a duplicate DB read.
                throw new OversizedCacheValue();
            }
            return value;
        }, ["turso-read-v1", ...key], { revalidate })();
    } catch (error) {
        if (error instanceof OversizedCacheValue && oversized) return oversized.value;
        throw error;
    }
}
