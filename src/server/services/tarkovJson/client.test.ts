import assert from "node:assert/strict";
import test from "node:test";
import { fetchTarkovJsonDataset } from "./client";
import { TARKOV_API_USER_AGENT } from "../tarkovApi";

test("fetchTarkovJsonDataset combines base data with the English locale", async (context) => {
    context.mock.method(globalThis, "fetch", async (input, init) => {
        assert.equal(new Headers(init?.headers).get("User-Agent"), TARKOV_API_USER_AGENT);
        const url = String(input);
        if (url.endsWith("_en")) {
            return Response.json({ data: { token: "Translated" } });
        }
        return Response.json({ data: { entry: { name: "token" } }, translations: [] });
    });

    const dataset = await fetchTarkovJsonDataset<{ entry: { name: string } }>("hideout");
    assert.equal(dataset.data.entry.name, "token");
    assert.equal(dataset.translate("token"), "Translated");
    assert.equal(dataset.translate("unknown"), "unknown");
    assert.deepEqual(dataset.locale, {
        requestedPath: "regular/hideout_en",
        resolvedPath: "regular/hideout_en",
        usedRegularFallback: false,
    });
});

test("fetchTarkovJsonDataset rejects missing base data", async (context) => {
    context.mock.method(globalThis, "fetch", async (input) => {
        if (String(input).endsWith("_en")) {
            return Response.json({ data: { token: "Translated" } });
        }
        return Response.json({ data: null });
    });

    await assert.rejects(fetchTarkovJsonDataset("tasks"), /response is missing or empty data/);
});

test("fetchTarkovJsonDataset rejects empty base objects and arrays", async (context) => {
    context.mock.method(globalThis, "fetch", async (input) => {
        if (String(input).endsWith("_en")) {
            return Response.json({ data: { token: "Translated" } });
        }
        return Response.json({ data: String(input).includes("tasks") ? [] : {} });
    });

    await assert.rejects(fetchTarkovJsonDataset("hideout"), /missing or empty data/);
    await assert.rejects(fetchTarkovJsonDataset("tasks"), /missing or empty data/);
});

test("fetchTarkovJsonDataset prefixes seasonal requests with pvp-season", async (context) => {
    const urls: string[] = [];
    context.mock.method(globalThis, "fetch", async (input) => {
        urls.push(String(input));
        return String(input).endsWith("_en")
            ? Response.json({ data: { token: "Translated" } })
            : Response.json({ data: { entry: { name: "token" } } });
    });

    await fetchTarkovJsonDataset("tasks", "pvp-season");
    assert.deepEqual(urls.sort(), [
        "https://json.tarkov.dev/pvp-season/tasks",
        "https://json.tarkov.dev/pvp-season/tasks_en",
    ]);
});

test("fetchTarkovJsonDataset falls back to regular English translations", async (context) => {
    const urls: string[] = [];
    context.mock.method(console, "warn", () => undefined);
    context.mock.method(globalThis, "fetch", async (input) => {
        const url = String(input);
        urls.push(url);

        if (url.endsWith("/pvp-season/items_en")) {
            return new Response('{"error":"Not found"}', {
                status: 404,
                statusText: "Not Found",
            });
        }
        if (url.endsWith("/regular/items_en")) {
            return Response.json({ data: { token: "Fallback translation" } });
        }
        return Response.json({ data: { items: { entry: { name: "token" } } } });
    });

    const dataset = await fetchTarkovJsonDataset<{
        items: { entry: { name: string } };
    }>("items", "pvp-season");

    assert.equal(dataset.translate("token"), "Fallback translation");
    assert.deepEqual(dataset.locale, {
        requestedPath: "pvp-season/items_en",
        resolvedPath: "regular/items_en",
        usedRegularFallback: true,
    });
    assert.deepEqual(urls.sort(), [
        "https://json.tarkov.dev/pvp-season/items",
        "https://json.tarkov.dev/pvp-season/items_en",
        "https://json.tarkov.dev/regular/items_en",
    ]);
});

test("fetchTarkovJsonDataset still rejects when locale fallback also fails", async (context) => {
    context.mock.method(console, "warn", () => undefined);
    context.mock.method(globalThis, "fetch", async (input) => {
        if (String(input).endsWith("_en")) {
            return new Response('{"error":"Not found"}', {
                status: 404,
                statusText: "Not Found",
            });
        }
        return Response.json({ data: { items: {} } });
    });

    await assert.rejects(
        fetchTarkovJsonDataset("items", "pvp-season"),
        /regular\/items_en: 404 Not Found/,
    );
});

test("fetchTarkovJsonDataset retries transient upstream failures", async (context) => {
    let baseAttempts = 0;
    context.mock.method(globalThis, "fetch", async (input) => {
        if (String(input).endsWith("_en")) {
            return Response.json({ data: { token: "Translated" } });
        }
        baseAttempts += 1;
        if (baseAttempts === 1) {
            return new Response('{"error":"temporarily unavailable"}', {
                status: 503,
                statusText: "Service Unavailable",
            });
        }
        return Response.json({ data: { entry: { name: "token" } } });
    });

    const dataset = await fetchTarkovJsonDataset<{ entry: { name: string } }>("hideout");

    assert.equal(baseAttempts, 2);
    assert.equal(dataset.data.entry.name, "token");
});

test("fetchTarkovJsonDataset retries request timeouts", async (context) => {
    let baseAttempts = 0;
    context.mock.method(globalThis, "fetch", async (input) => {
        if (String(input).endsWith("_en")) {
            return Response.json({ data: { token: "Translated" } });
        }
        baseAttempts += 1;
        if (baseAttempts === 1) {
            throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
        }
        return Response.json({ data: { entry: { name: "token" } } });
    });

    const dataset = await fetchTarkovJsonDataset<{ entry: { name: string } }>("hideout");

    assert.equal(baseAttempts, 2);
    assert.equal(dataset.data.entry.name, "token");
});
