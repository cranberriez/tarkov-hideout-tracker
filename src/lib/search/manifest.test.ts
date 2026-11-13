import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { buildSearchManifest } from "./build-manifest";
import { decodeSearchManifest, searchManifestItems, validateSearchManifest } from "./manifest";
import { searchManifestOptions } from "./query";
import { removeGameDataScope } from "../query/scope";
import { REMOVED_QUEST_IDS } from "../quests/removed-quests";
import type { FullQuest } from "../../types/quests";

const quest = (id: string, lightkeeperRequired = false) =>
	({
		id,
		name: id,
		normalizedName: id,
		trader: { id: "trader", name: "Trader", normalizedName: "trader" },
		lightkeeperRequired,
	}) as FullQuest;
const items = [
	{
		id: "gpu",
		name: "Graphics card",
		normalizedName: "graphics-card",
		shortName: "GPU",
		category: { id: "electronics", name: "Electronics", normalizedName: "electronics" },
	},
];
const traders = [{ id: "trader", name: "Trader", normalizedName: "trader" }];
const fixture = () => ({
	...buildSearchManifest("regular", items, [quest("quest")], traders),
	releaseId: "revision-a",
});

test("round trip keeps identities and short names, omits optional images and excludes quests", () => {
	const value = fixture();
	const decoded = decodeSearchManifest(JSON.parse(JSON.stringify(value)), "regular");
	assert.equal(decoded.items[0].iconLink, undefined);
	assert.equal(decoded.items[0].categoryId, "electronics");
	assert.equal(searchManifestItems(decoded.itemIndex, "GPU", 10)[0].id, "gpu");
	assert.equal(searchManifestItems(decoded.itemIndex, "graphicscard", 10)[0].id, "gpu");
	const seasonal = buildSearchManifest(
		"pvp-season",
		items,
		[quest("keep"), quest("seasonal", true), quest([...REMOVED_QUEST_IDS][0])],
		traders,
	);
	assert.deepEqual(
		seasonal.quests.map((entry) => entry.id),
		["keep", "seasonal"],
	);
	assert.equal("releaseId" in seasonal, false);
});

test("malformed, empty, duplicate and cross-scope manifests are rejected", () => {
	const value = fixture();
	for (const bad of [
		null,
		{ ...value, v: 2 },
		{ ...value, items: [] },
		{ ...value, items: [value.items[0], value.items[0]] },
		{ ...value, traders: {} },
		{ ...value, items: [{ ...value.items[0], ic: 3 }] },
		{ ...value, items: [{ ...value.items[0], c: 1 }] },
	]) {
		assert.throws(() => validateSearchManifest(bad, "regular"));
	}
	assert.throws(() => decodeSearchManifest(value, "pve"));
	assert.throws(() => decodeSearchManifest({ ...value, releaseId: "" }, "regular"));
});

test("one request loads the current manifest, and reopens reuse it until stale", async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const original = globalThis.fetch;
	let requests = 0;
	let releaseId = "revision-a";
	const options = searchManifestOptions("regular");
	globalThis.fetch = (async (url) => {
		requests++;
		const request = new URL(String(url), "http://localhost");
		assert.equal(request.pathname, "/api/search");
		assert.equal(request.searchParams.get("mode"), "regular");
		assert.equal(request.searchParams.has("releaseId"), false);
		assert.equal(request.searchParams.has("identity"), false);
		return new Response(JSON.stringify({ ...fixture(), releaseId }));
	}) as typeof fetch;
	try {
		const first = await client.fetchQuery(options);
		assert.equal(first.releaseId, "revision-a");
		searchManifestItems(first.itemIndex, "gpu", 10);
		searchManifestItems(first.itemIndex, "card", 50);
		assert.equal(await client.fetchQuery(options), first);
		assert.equal(requests, 1);

		releaseId = "revision-b";
		await client.invalidateQueries({ queryKey: options.queryKey });
		const stale = await client.ensureQueryData({ ...options, revalidateIfStale: true });
		assert.equal(stale.releaseId, "revision-a");
		assert.equal((await client.fetchQuery(options)).releaseId, "revision-b");
		assert.equal(requests, 2);
		assert.equal(client.getQueryCache().getAll().length, 1);
	} finally {
		globalThis.fetch = original;
		client.clear();
	}
});

test("mode removal aborts a pending manifest and cannot accept its late response", async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const original = globalThis.fetch;
	let signal: AbortSignal | null | undefined;
	let finish!: (response: Response) => void;
	globalThis.fetch = ((_url, init) => {
		signal = init?.signal;
		return new Promise<Response>((resolve) => {
			finish = resolve;
		});
	}) as typeof fetch;
	try {
		const pending = client.fetchQuery(searchManifestOptions("regular")).catch(() => null);
		await removeGameDataScope(client, "regular");
		assert.equal(signal?.aborted, true);
		finish(new Response(JSON.stringify(fixture())));
		await pending;
		assert.equal(client.getQueryCache().getAll().length, 0);
	} finally {
		globalThis.fetch = original;
		client.clear();
	}
});

test("a failed refresh keeps the last valid manifest in its own mode", async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const original = globalThis.fetch;
	const options = searchManifestOptions("regular");
	globalThis.fetch = async () => Response.json(fixture());
	try {
		const data = await client.fetchQuery(options);
		await client.invalidateQueries({ queryKey: options.queryKey });
		globalThis.fetch = async () => Response.json({ ...fixture(), releaseId: "revision-b", mode: "pve" });
		await assert.rejects(client.fetchQuery(options));
		assert.equal(client.getQueryData(options.queryKey), data);
		assert.equal(client.getQueryData(searchManifestOptions("pve").queryKey), undefined);
		assert.equal("refetchInterval" in options, false);
	} finally {
		globalThis.fetch = original;
		client.clear();
	}
});
