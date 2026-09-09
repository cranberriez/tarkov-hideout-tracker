import test from "node:test";
import assert from "node:assert/strict";
import { createQueryClient } from "../../../lib/query/client";
import { PartialDataError } from "../../../lib/query/request";
import {
    itemAcquisitionQueryOptions,
    itemRelationsQueryOptions,
    itemUsageQueryOptions,
} from "./item-detail-queries";

const relations = {
    item: null,
    relatedItems: [],
    unresolvedItemIds: [],
    hideoutRequirements: [],
    questItemIndex: [],
    questRewardIndex: [],
    questAnyOfGroups: [],
    questAvailabilityQuests: [],
    freshness: { itemsUpdatedAt: 1, pricesUpdatedAt: 1, stationsUpdatedAt: 1, questsUpdatedAt: 1 },
    errors: { items: null, prices: null, stations: null, quests: null },
} as const;

const usage = {
    barters: [], crafts: [], items: [], itemIds: [], unresolvedItemIds: [],
    tradersById: {}, taskUnlocksById: {}, stationsById: {},
    freshness: {
        bartersUpdatedAt: 1, craftsUpdatedAt: 1, itemsUpdatedAt: 1,
        pricesUpdatedAt: 1, tradersUpdatedAt: 1, taskUnlocksUpdatedAt: 1,
        stationsUpdatedAt: 1,
    },
} as const;

const acquisition = {
    rootItemId: "item-12345678", barters: [], crafts: [], itemIds: [], truncated: false,
    items: [], unresolvedItemIds: [],
    freshness: { bartersUpdatedAt: 1, craftsUpdatedAt: 1, itemsUpdatedAt: 1, pricesUpdatedAt: 1 },
    errors: { barters: null, crafts: null, items: null, prices: null },
} as const;

test("detail domains reuse complete results independently", async () => {
    const originalFetch = globalThis.fetch;
    const calls = new Map<string, number>();
    globalThis.fetch = async (input) => {
        const path = String(input);
        const domain = path.includes("/relations?") ? "relations" : path.includes("/usage?") ? "usage" : "acquisition";
        calls.set(domain, (calls.get(domain) ?? 0) + 1);
        return Response.json(domain === "relations" ? relations : domain === "usage" ? usage : acquisition);
    };
    const client = createQueryClient();
    try {
        const relationOptions = itemRelationsQueryOptions("regular", "item-12345678");
        const usageOptions = itemUsageQueryOptions("regular", "item-12345678");
        const treeOptions = itemAcquisitionQueryOptions("regular", "item-12345678");
        await Promise.all([client.fetchQuery(relationOptions), client.fetchQuery(usageOptions), client.fetchQuery(treeOptions)]);
        await Promise.all([client.fetchQuery(relationOptions), client.fetchQuery(usageOptions), client.fetchQuery(treeOptions)]);
        assert.deepEqual(Object.fromEntries(calls), { relations: 1, usage: 1, acquisition: 1 });
        assert.notDeepEqual(relationOptions.queryKey, usageOptions.queryKey);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});

test("partial output remains on the error while another domain succeeds", async () => {
    const originalFetch = globalThis.fetch;
    const partial = { ...relations, errors: { ...relations.errors, quests: "Quest relations unavailable" } };
    globalThis.fetch = async (input) => Response.json(String(input).includes("/relations?") ? partial : usage);
    const client = createQueryClient();
    const relationOptions = itemRelationsQueryOptions("regular", "item-12345678");
    try {
        const [relationResult, usageResult] = await Promise.allSettled([
            client.fetchQuery(relationOptions),
            client.fetchQuery(itemUsageQueryOptions("regular", "item-12345678")),
        ]);
        assert.equal(relationResult.status, "rejected");
        assert.ok(relationResult.status === "rejected" && relationResult.reason instanceof PartialDataError);
        assert.equal(relationResult.status === "rejected" && relationResult.reason.payload.errors.quests, "Quest relations unavailable");
        assert.equal(client.getQueryData(relationOptions.queryKey), undefined);
        assert.equal(usageResult.status, "fulfilled");
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});

test("cancelling an inactive detail query aborts its request signal", async () => {
    const originalFetch = globalThis.fetch;
    let aborted = false;
    globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(init.signal?.reason);
        }, { once: true });
    });
    const client = createQueryClient();
    const options = itemRelationsQueryOptions("regular", "item-12345678");
    try {
        const request = client.fetchQuery(options);
        await client.cancelQueries({ queryKey: options.queryKey });
        await assert.rejects(request);
        assert.equal(aborted, true);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});
