import type { TarkovDataMode } from "@/types/common";
import type { CurrentPrice } from "@/types/prices";

export type PriceState = { state: "pending" | "error" | "ready"; prices: Record<string, CurrentPrice>; releaseChanged?: boolean };

export class PriceReleaseChangedError extends Error {}

/** Session-only complete-result cache. Failed requests remain retryable. */
export function createDeferredPriceLoader(fetchPrices: typeof fetch = fetch, now = Date.now) {
    const cache = new Map<string, { expires: number; value: PriceState }>();
    const requests = new Map<string, Promise<PriceState>>();
    return async function loadPrices(key: string, mode: TarkovDataMode, releaseId: string, ids: string[]): Promise<PriceState> {
        const cached = cache.get(key);
        if (cached && cached.expires > now()) return cached.value;
        const existing = requests.get(key);
        if (existing) return existing;
        const request = (async () => {
            const prices: Record<string, CurrentPrice> = {};
            // Three concurrent 128-ID batches bound both transport and database work.
            for (let start = 0; start < ids.length; start += 384) {
                const batches = [0, 128, 256].map((offset) => ids.slice(start + offset, Math.min(start + offset + 128, ids.length))).filter((batch) => batch.length);
                const results = await Promise.all(batches.map(async (batch) => {
                    const response = await fetchPrices("/api/items/prices", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode, releaseId, ids: batch }), signal: AbortSignal.timeout(30_000),
                    });
                    if (response.status === 409) throw new PriceReleaseChangedError("The data release changed. Refresh the page to load prices.");
                    if (!response.ok) throw new Error("Prices could not be loaded");
                    const payload = await response.json();
                    if (!payload?.prices || typeof payload.prices !== "object" || Array.isArray(payload.prices) ||
                        Object.entries(payload.prices).some(([id, price]) => !batch.includes(id) || !price || typeof price !== "object" || Array.isArray(price))) {
                        throw new Error("Invalid price response");
                    }
                    return payload.prices as Record<string, CurrentPrice>;
                }));
                for (const result of results) Object.assign(prices, result);
            }
            const value: PriceState = { state: "ready", prices };
            cache.set(key, { expires: now() + 60_000, value });
            if (cache.size > 20) cache.delete(cache.keys().next().value!);
            return value;
        })();
        requests.set(key, request);
        try { return await request; } finally { requests.delete(key); }
    };
}

export const loadDeferredPrices = createDeferredPriceLoader();
