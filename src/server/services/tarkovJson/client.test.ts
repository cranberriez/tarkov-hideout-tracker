import assert from "node:assert/strict";
import test from "node:test";
import { fetchTarkovJsonDataset } from "./client";

test("fetchTarkovJsonDataset combines base data with the English locale", async (context) => {
    context.mock.method(globalThis, "fetch", async (input) => {
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

