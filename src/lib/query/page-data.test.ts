import assert from "node:assert/strict";
import test from "node:test";
import { createQueryClient } from "./client";
import { PartialDataError } from "./request";
import {
    hideoutPageQueryOptions,
    profitPageQueryOptions,
    questWorkspacePageQueryOptions,
} from "./page-data";

const completeHideout = {
    stations: [], items: [], itemIds: [], unresolvedItemIds: [],
    freshness: { stationsUpdatedAt: 1, itemsUpdatedAt: 1, pricesUpdatedAt: null },
    errors: { stations: null, items: null, prices: null },
};

test("page keys isolate modes and keep every profit consumer on one recipes cache", () => {
    assert.deepEqual(hideoutPageQueryOptions("pve").queryKey, ["game-data", "pve", "hideout-page"]);
    assert.deepEqual(profitPageQueryOptions("regular").queryKey, ["game-data", "regular", "recipes-crafts-barters", "unpriced-v1"]);
    assert.notDeepEqual(profitPageQueryOptions("pve").queryKey, profitPageQueryOptions("regular").queryKey);
    assert.notDeepEqual(questWorkspacePageQueryOptions("regular").queryKey, questWorkspacePageQueryOptions("regular", "dev-test").queryKey);
});

test("complete page requests reuse cache and preserve explicitly missing item IDs", async () => {
    const originalFetch = globalThis.fetch;
    const client = createQueryClient({ gcTime: Infinity });
    let calls = 0;
    try {
        globalThis.fetch = async () => { calls++; return Response.json(completeHideout); };
        const options = hideoutPageQueryOptions("regular");
        await client.fetchQuery(options);
        await client.fetchQuery(options);
        assert.equal(calls, 1);

        client.removeQueries({ queryKey: options.queryKey });
        const withMissingItems = { ...completeHideout, unresolvedItemIds: ["missing"] };
        globalThis.fetch = async () => Response.json(withMissingItems);
        assert.deepEqual(await client.fetchQuery(options), withMissingItems);
        assert.deepEqual(client.getQueryData(options.queryKey), withMissingItems);

        client.removeQueries({ queryKey: options.queryKey });
        const partial = { ...completeHideout, errors: { ...completeHideout.errors, items: "Item data failed." } };
        globalThis.fetch = async () => Response.json(partial);
        await assert.rejects(client.fetchQuery(options), PartialDataError);
        assert.equal(client.getQueryData(options.queryKey), undefined);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});
