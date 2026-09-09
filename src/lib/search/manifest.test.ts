import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { buildSearchManifest } from "./build-manifest";
import { decodeSearchManifest, searchManifestItems, validateSearchManifest } from "./manifest";
import { searchManifestOptions } from "./query";
import { removeGameDataScope } from "../query/scope";
import { REMOVED_QUEST_IDS } from "../utils/removed-quests";
import type { FullQuest } from "../../types/quests";

const quest = (id: string, lightkeeperRequired = false) =>
	({
		id,
		name: id,
		normalizedName: id,
		trader: { id: "trader", name: "Trader", normalizedName: "trader" },
		lightkeeperRequired,
	}) as FullQuest;
const items = [{ id: "gpu", name: "Graphics card", normalizedName: "graphics-card", shortName: "GPU" }];
const traders = [{ id: "trader", name: "Trader", normalizedName: "trader" }];
const fixture = () => ({
	...buildSearchManifest("regular", items, [quest("quest")], traders),
	releaseId: "revision-a",
});

test("round trip keeps identities and short names, omits optional images and excludes quests", () => {
	const value = fixture();
	const decoded = decodeSearchManifest(JSON.parse(JSON.stringify(value)), "regular", "revision-a");
	assert.equal(decoded.items[0].iconLink, undefined);
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
		["keep"],
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
	]) {
		assert.throws(() => validateSearchManifest(bad, "regular"));
	}
	assert.throws(() => decodeSearchManifest(value, "pve", "revision-a"));
	assert.throws(() => decodeSearchManifest(value, "regular", "revision-b"));
});

test("manifest is fetched once across searches and reopens, revision changes fetch anew", async () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const original = globalThis.fetch;
	let requests = 0;
	globalThis.fetch = (async (url) => {
		requests++;
		const releaseId = new URL(String(url), "http://localhost").searchParams.get("releaseId");
		return new Response(JSON.stringify({ ...fixture(), releaseId }));
	}) as typeof fetch;
	try {
		const first = await client.fetchQuery(searchManifestOptions("regular", "revision-a"));
		searchManifestItems(first.itemIndex, "gpu", 10);
		searchManifestItems(first.itemIndex, "card", 50);
		await client.fetchQuery(searchManifestOptions("regular", "revision-a"));
		assert.equal(requests, 1);
		await client.fetchQuery(searchManifestOptions("regular", "revision-b"));
		assert.equal(requests, 2);
		await removeGameDataScope(client, "regular");
		assert.equal(client.getQueryCache().getAll().length, 0);
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
		const pending = client.fetchQuery(searchManifestOptions("regular", "revision-a")).catch(() => null);
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
