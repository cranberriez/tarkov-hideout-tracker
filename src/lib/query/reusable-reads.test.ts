import assert from "node:assert/strict";
import test from "node:test";
import { createQueryClient } from "./client";
import { completedItemsConversionQueryOptions, legacyProfileConversionQueryOptions } from "./conversions";
import { mapOverlaysQueryOptions } from "./maps";

test("conversion reads are cached independently for each requested destination mode", () => {
    assert.deepEqual(legacyProfileConversionQueryOptions("regular").queryKey, ["conversion", "legacy-profile", "regular"]);
    assert.deepEqual(completedItemsConversionQueryOptions("pve").queryKey, ["conversion", "completed-items", "pve"]);
    assert.notDeepEqual(legacyProfileConversionQueryOptions("regular").queryKey, legacyProfileConversionQueryOptions("pve").queryKey);
});

test("map overlays use a long-lived mode-independent cache", async () => {
    const originalFetch = globalThis.fetch;
    const client = createQueryClient({ gcTime: Infinity });
    let calls = 0;
    try {
        globalThis.fetch = async () => {
            calls++;
            return Response.json({ markers: [] });
        };
        const options = mapOverlaysQueryOptions("customs");
        assert.deepEqual(options.queryKey, ["map-overlays", "customs"]);
        await client.fetchQuery(options);
        await client.fetchQuery(options);
        assert.equal(calls, 1);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});
