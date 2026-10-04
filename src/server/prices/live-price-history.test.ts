import assert from "node:assert/strict";
import test from "node:test";
import { PRICE_HISTORY_CUTOFF_TIMESTAMP } from "../services/priceHistory";
import { TARKOV_API_USER_AGENT } from "../services/tarkovApi";
import { fetchCachedJsonPriceHistory, PRICE_HISTORY_REVALIDATE_SECONDS } from "./live-price-history";

function memoryCache() {
	const entries = new Map<string, unknown>();
	const durations: Array<number | false | undefined> = [];
	const cache = ((read, keys, options) => async () => {
		const key = JSON.stringify(keys);
		durations.push(options?.revalidate);
		if (!entries.has(key)) entries.set(key, await read());
		return entries.get(key);
	}) as typeof import("next/cache").unstable_cache;
	return { durations, cache };
}

test("modal price history caches histories and provider misses for two hours", async (context) => {
	const { cache, durations } = memoryCache();
	const fetchMock = context.mock.method(
		globalThis,
		"fetch",
		async (input: string | URL | Request, init?: RequestInit) => {
			assert.equal(new Headers(init?.headers).get("User-Agent"), TARKOV_API_USER_AGENT);
			assert.equal(init?.cache, "no-store");
			if (String(input).endsWith("/missing")) return Response.json({ error: "Not found" }, { status: 404 });
			return Response.json({
				data: [{ price: 1200, priceMin: 1000, offerCount: 5, timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP }],
			});
		},
	);

	const expected = [{ price: 1200, priceMin: 1000, offerCount: 5, timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP }];
	assert.deepEqual(await fetchCachedJsonPriceHistory("pve", "item-a", cache), expected);
	assert.deepEqual(await fetchCachedJsonPriceHistory("pve", "item-a", cache), expected);
	assert.equal(await fetchCachedJsonPriceHistory("pve", "missing", cache), null);
	assert.equal(await fetchCachedJsonPriceHistory("pve", "missing", cache), null);
	assert.equal(fetchMock.mock.callCount(), 2);
	assert.ok(durations.every((duration) => duration === PRICE_HISTORY_REVALIDATE_SECONDS));
});
