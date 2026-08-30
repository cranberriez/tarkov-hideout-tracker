import assert from "node:assert/strict";
import test from "node:test";
import { isFreshCache, markStaleFallback, parseNonEmptyTimedResponse } from "./cache";

test("parseNonEmptyTimedResponse rejects missing and empty payloads", () => {
    assert.equal(parseNonEmptyTimedResponse(null, () => []), null);
    assert.equal(
        parseNonEmptyTimedResponse('{"data":{"quests":[]},"updatedAt":1}', (payload) =>
            (payload as { quests: unknown[] }).quests,
        ),
        null,
    );
});

test("parseNonEmptyTimedResponse accepts object and serialized non-empty payloads", () => {
    const response = { data: { stations: [{ id: "station" }] }, updatedAt: 123 };
    const selectStations = (payload: { stations: unknown[] }) => payload.stations;

    assert.deepEqual(parseNonEmptyTimedResponse(response, selectStations), response);
    assert.deepEqual(
        parseNonEmptyTimedResponse(JSON.stringify(response), selectStations),
        response,
    );
});

test("isFreshCache requires a numeric updatedAt inside the freshness window", () => {
    const now = 48 * 60 * 60 * 1000;
    assert.equal(isFreshCache({ updatedAt: now - 60_000 }, now), true);
    assert.equal(isFreshCache({ updatedAt: now - 25 * 60 * 60 * 1000 }, now), false);
    assert.equal(isFreshCache({ updatedAt: "recent" }, now), false);
});

test("markStaleFallback preserves validated data and records the provider warning", () => {
    const response = {
        data: { items: [{ id: "item" }] },
        updatedAt: 123,
        diagnostics: { provider: "json" as const, upstreamStatus: "ok" as const },
    };

    assert.deepEqual(markStaleFallback(response), {
        ...response,
        diagnostics: { provider: "json", upstreamStatus: "stale-fallback" },
    });
});
