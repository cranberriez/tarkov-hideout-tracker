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
});

test("fetchTarkovJsonDataset rejects missing base data", async (context) => {
    context.mock.method(globalThis, "fetch", async (input) => {
        if (String(input).endsWith("_en")) {
            return Response.json({ data: { token: "Translated" } });
        }
        return Response.json({ data: null });
    });

    await assert.rejects(fetchTarkovJsonDataset("tasks"), /response is missing data/);
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
