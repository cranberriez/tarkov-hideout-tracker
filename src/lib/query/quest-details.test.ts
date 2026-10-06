import assert from "node:assert/strict";
import test from "node:test";
import { createQueryClient } from "./client";
import { questDetailQueryOptions } from "./quest-details";
import { PartialDataError } from "./request";
import type { FullQuest } from "../../types/quests";

const quest = (id: string): FullQuest => ({
	id,
	name: id,
	normalizedName: id,
	experience: 0,
	trader: { id: "trader", name: "Trader", normalizedName: "trader" },
	taskRequirements: [],
	traderRequirements: [],
	otherRequirements: [],
	objectives: [],
});

test("detail batches fill independent per-quest caches and reuse overlapping selections", async () => {
	const original = globalThis.fetch;
	const client = createQueryClient({ gcTime: Infinity });
	const calls: { mode: string | null; ids: string[] }[] = [];
	try {
		globalThis.fetch = async (input) => {
			const params = new URL(String(input), "http://localhost").searchParams;
			const ids = params.get("ids")!.split(",");
			calls.push({ mode: params.get("mode"), ids });
			return Response.json({
				quests: ids.map(quest),
				items: [],
				requestedQuestIds: ids,
				unresolvedQuestIds: [],
				unresolvedItemIds: [],
				errors: { quests: null, items: null },
				freshness: { questsUpdatedAt: 1, itemsUpdatedAt: 1 },
			});
		};
		await Promise.all(["b", "a"].map((id) => client.fetchQuery(questDetailQueryOptions("regular", id))));
		assert.deepEqual(calls, [{ mode: "regular", ids: ["a", "b"] }]);
		await Promise.all(["b", "c"].map((id) => client.fetchQuery(questDetailQueryOptions("regular", id))));
		assert.deepEqual(calls[1], { mode: "regular", ids: ["c"] });
		await client.fetchQuery(questDetailQueryOptions("pve", "a"));
		assert.deepEqual(calls[2], { mode: "pve", ids: ["a"] });
		assert.equal(client.getQueryData(questDetailQueryOptions("regular", "a").queryKey)?.quest?.id, "a");
		assert.equal(client.getQueryCache().getAll().length, 4, "no combination cache entry is stored");
	} finally {
		globalThis.fetch = original;
		client.clear();
	}
});

test("failed item reads retain quest details for retry without marking the cache complete", async () => {
	const original = globalThis.fetch;
	const client = createQueryClient({ gcTime: Infinity });
	try {
		globalThis.fetch = async () =>
			Response.json({
				quests: [quest("a")],
				items: null,
				requestedQuestIds: ["a"],
				unresolvedQuestIds: [],
				unresolvedItemIds: [],
				errors: { quests: null, items: "Items unavailable" },
				freshness: { questsUpdatedAt: 1, itemsUpdatedAt: null },
			});
		const options = questDetailQueryOptions("regular", "a");
		await assert.rejects(client.fetchQuery(options), (error: unknown) => {
			assert.ok(error instanceof PartialDataError);
			assert.equal(error.payload.quest.id, "a");
			assert.equal(error.payload.itemsError, "Items unavailable");
			return true;
		});
		assert.equal(client.getQueryData(options.queryKey), undefined);
	} finally {
		globalThis.fetch = original;
		client.clear();
	}
});
