import { gunzipSync, gzipSync } from "node:zlib";

// Leave ample room below Next's 2 MB entry limit, including cache metadata.
export const MAX_CACHE_BYTES = 512 * 1024;
/** Base64 gzip entries (whole-domain catalog reads); still well below the 2 MB limit. */
export const MAX_COMPRESSED_CACHE_BYTES = 1536 * 1024;
export const ENTITY_BATCH_SIZE = 128;

export function canonicalIds(ids: readonly string[]): string[] {
	return [...new Set(ids)].sort();
}

export async function mapBatches<T>(ids: readonly string[], read: (batch: string[]) => Promise<T>): Promise<T[]> {
	const batches = Array.from({ length: Math.max(1, Math.ceil(ids.length / ENTITY_BATCH_SIZE)) }, (_, index) =>
		ids.slice(index * ENTITY_BATCH_SIZE, (index + 1) * ENTITY_BATCH_SIZE),
	);
	const results: T[] = [];
	// Three independent batches at a time; Promise.all preserves input order.
	for (let index = 0; index < batches.length; index += 3) {
		results.push(...(await Promise.all(batches.slice(index, index + 3).map(read))));
	}
	return results;
}

class OversizedCacheValue extends Error {}

export interface ReadCacheOptions {
	/** Store gzip-compressed JSON so whole-domain catalog reads fit under the entry limit. */
	compress?: boolean;
	tags?: string[];
	cache?: typeof import("next/cache").unstable_cache;
}

export async function boundedReadCache<T>(
	key: string[],
	read: () => Promise<T>,
	revalidate: number | false = false,
	cacheOrOptions?: typeof import("next/cache").unstable_cache | ReadCacheOptions,
): Promise<T> {
	const options = typeof cacheOrOptions === "function" ? { cache: cacheOrOptions } : (cacheOrOptions ?? {});
	const unstable_cache = options.cache ?? (await import("next/cache")).unstable_cache;
	let oversized: { value: T } | undefined;
	try {
		const stored = await unstable_cache(
			async () => {
				const value = await read();
				const json = JSON.stringify(value);
				const entry = options.compress ? { gz: gzipSync(json).toString("base64") } : value;
				const size = options.compress ? (entry as { gz: string }).gz.length : Buffer.byteLength(json, "utf8");
				if (size > (options.compress ? MAX_COMPRESSED_CACHE_BYTES : MAX_CACHE_BYTES)) {
					oversized = { value };
					// Rejected callbacks are not stored. Still deliver a valid large
					// record to the caller without truncation or a duplicate DB read.
					throw new OversizedCacheValue();
				}
				return entry;
			},
			["postgres-read-v1", ...(options.compress ? ["gz"] : []), ...key],
			{ revalidate, ...(options.tags ? { tags: options.tags } : {}) },
		)();
		return options.compress
			? (JSON.parse(gunzipSync(Buffer.from((stored as { gz: string }).gz, "base64")).toString("utf8")) as T)
			: (stored as T);
	} catch (error) {
		if (error instanceof OversizedCacheValue && oversized) return oversized.value;
		throw error;
	}
}

type MemoEntry = { value: Promise<unknown>; expiresAt: number };
const memoGlobal = globalThis as typeof globalThis & { __tarkovReadMemo?: Map<string, MemoEntry> };

/** Per-instance memo in front of the shared data cache. Rejections are never kept. */
export function memoizedRead<T>(key: string, ttlMs: number, read: () => Promise<T>): Promise<T> {
	const memo = (memoGlobal.__tarkovReadMemo ??= new Map());
	const now = Date.now();
	const hit = memo.get(key);
	if (hit && hit.expiresAt > now) return hit.value as Promise<T>;
	const value = read().catch((error) => {
		if (memo.get(key)?.value === value) memo.delete(key);
		throw error;
	});
	memo.set(key, { value, expiresAt: now + ttlMs });
	return value;
}

export function evictMemoizedReads(predicate: (key: string) => boolean): void {
	const memo = memoGlobal.__tarkovReadMemo;
	if (!memo) return;
	for (const key of [...memo.keys()]) if (predicate(key)) memo.delete(key);
}
