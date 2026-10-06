import assert from "node:assert/strict";
import test from "node:test";
import type { DataResult } from "../../types/common";
import type { ItemSummary } from "../../types/items";
import type { FullQuest } from "../../types/quests";
import type { TarkovDataRepository } from "../repositories/tarkov-data/types";
import { getQuestDetailsData } from "./getQuestDetailsData";

function result<T>(data: T, updatedAt = 1): DataResult<T> {
	return { data, updatedAt };
}

function quest(id: string, itemIds: string[] = []): FullQuest {
	return {
		id,
		name: id,
		normalizedName: id,
		experience: 0,
		trader: { id: "trader", name: "Trader", normalizedName: "trader" },
		taskRequirements: [],
		traderRequirements: [],
		otherRequirements: [],
		objectives: itemIds.map((itemId, index) => ({
			id: `${id}-${index}`,
			type: "giveItem" as const,
			description: "Give item",
			optional: false,
			count: 1,
			foundInRaid: false,
			itemIds: [itemId],
		})),
	};
}

function item(id: string): ItemSummary {
	return { id, name: id, normalizedName: id, category: "Other", onFleaMarket: true };
}

function repository(
	getByIds: TarkovDataRepository["quests"]["getByIds"],
	getItems: TarkovDataRepository["items"]["getByIds"],
): TarkovDataRepository {
	const forbidden = async (): Promise<never> => {
		throw new Error("Unexpected repository read");
	};
	return {
		items: { getByIds: getItems },
		hideout: { getStations: forbidden },
		quests: { getAll: forbidden, getByIds },
		traders: { getAll: forbidden, getByIds: forbidden },
		recipes: { getBarters: forbidden, getCrafts: forbidden },
		prices: { getCurrent: forbidden, getHistory: forbidden },
	};
}

test("quest details use bounded quest and item reads and retain missing IDs", async () => {
	const first = quest("quest-a", ["item-a", "item-missing"]);
	let questReadIds: readonly string[] = [];
	let itemReadIds: readonly string[] = [];
	const data = await getQuestDetailsData(
		"regular",
		["quest-missing", first.id],
		repository(
			async (_mode, ids) => {
				questReadIds = ids;
				return result({ [first.id]: first }, 10);
			},
			async (_mode, ids, options) => {
				itemReadIds = ids;
				assert.equal(options?.includeOffers, false);
				return result({ "item-a": item("item-a") }, 20);
			},
		),
	);

	assert.deepEqual(questReadIds, ["quest-a", "quest-missing"]);
	assert.deepEqual(itemReadIds, ["item-a", "item-missing"]);
	assert.deepEqual(
		data.quests?.map((value) => value.id),
		["quest-a"],
	);
	assert.deepEqual(
		data.items?.map((value) => value.id),
		["item-a"],
	);
	assert.deepEqual(data.unresolvedQuestIds, ["quest-missing"]);
	assert.deepEqual(data.unresolvedItemIds, ["item-missing"]);
	assert.deepEqual(data.errors, { quests: null, items: null });
});

test("quest details include custom anchors and prepare only the requested custom quest", async () => {
	const customId = "custom-ttl-trust-but-verify";
	const anchorId = "625d700cc48e6c62a440fab5";
	let questReadIds: readonly string[] = [];
	const data = await getQuestDetailsData(
		"regular",
		[customId],
		repository(
			async (_mode, ids) => {
				questReadIds = ids;
				return result({ [anchorId]: quest(anchorId) });
			},
			async () => result({}),
		),
	);

	assert.deepEqual(questReadIds, [customId, anchorId]);
	assert.deepEqual(
		data.quests?.map((value) => value.id),
		[customId],
	);
	assert.deepEqual(data.unresolvedQuestIds, []);
});

test("quest details request custom prerequisite records needed by a patched provider quest", async () => {
	const questId = "625d700cc48e6c62a440fab5";
	const prerequisiteId = "custom-ttl-the-other-side";
	let questReadIds: readonly string[] = [];
	const data = await getQuestDetailsData(
		"regular",
		[questId],
		repository(
			async (_mode, ids) => {
				questReadIds = ids;
				return result({ [questId]: quest(questId) });
			},
			async () => result({}),
		),
	);

	assert.deepEqual(questReadIds, [questId, prerequisiteId]);
	assert.deepEqual(
		data.quests?.map((value) => value.id),
		[questId],
	);
	assert.equal(data.quests?.[0]?.taskRequirements[0]?.task.id, prerequisiteId);
});

test("quest and item read failures remain independently visible", async () => {
	const questFailure = await getQuestDetailsData(
		"regular",
		["quest-a"],
		repository(
			async () => Promise.reject(new Error("quests")),
			async () => result({}),
		),
	);
	assert.equal(questFailure.quests, null);
	assert.equal(questFailure.items, null);
	assert.ok(questFailure.errors.quests);
	assert.ok(questFailure.errors.items);

	const itemFailure = await getQuestDetailsData(
		"regular",
		["quest-a"],
		repository(
			async () => result({ "quest-a": quest("quest-a", ["item-a"]) }),
			async () => {
				throw new Error("items");
			},
		),
	);
	assert.deepEqual(
		itemFailure.quests?.map((value) => value.id),
		["quest-a"],
	);
	assert.equal(itemFailure.items, null);
	assert.deepEqual(itemFailure.unresolvedItemIds, ["item-a"]);
	assert.equal(itemFailure.errors.quests, null);
	assert.ok(itemFailure.errors.items);
});
