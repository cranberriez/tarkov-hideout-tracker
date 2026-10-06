import assert from "node:assert/strict";
import test from "node:test";
import { CacheControl, profitPageDataCacheControl } from "./cache-control";

test("offer-bearing unpriced profit data bypasses shared caches", () => {
	assert.equal(profitPageDataCacheControl(true, false), CacheControl.noStore);
	assert.equal(profitPageDataCacheControl(false, true), CacheControl.noStore);
	assert.equal(profitPageDataCacheControl(true, true), CacheControl.publicCdnFiveMinutes);
});
