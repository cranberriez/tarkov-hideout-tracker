import test from "node:test";
import assert from "node:assert/strict";
import { stripCatalogDto } from "./catalog-dto.mjs";

test("price stripping preserves composed item-detail DTO freshness and error contracts", () => {
	const composed = {
		item: { id: "item-1", marketPrice: { price: 250 }, buyFromTrader: [{ traderId: "trader-1" }] },
		relatedItems: [{ id: "item-2", marketPrice: null, buyFromTrader: [] }],
		freshness: { itemsUpdatedAt: 123, pricesUpdatedAt: 456, stationsUpdatedAt: null, questsUpdatedAt: 789 },
		errors: { items: null, prices: null, stations: null, quests: null },
		usage: {
			items: [{ id: "item-1", marketPrice: { price: 250 }, buyFromTrader: [] }],
			freshness: { itemsUpdatedAt: 123, pricesUpdatedAt: 456, bartersUpdatedAt: 789, tradersUpdatedAt: null },
			pricesError: null,
		},
		acquisition: {
			rootItemId: "item-1",
			items: [{ id: "item-1", marketPrice: null, buyFromTrader: [] }],
			freshness: { itemsUpdatedAt: 123, pricesUpdatedAt: 456, craftsUpdatedAt: 789 },
			errors: { items: null, prices: null, crafts: null, barters: null },
		},
	};
	const stored = stripCatalogDto(composed);
	assert.deepEqual(stored.freshness, {
		itemsUpdatedAt: 0,
		pricesUpdatedAt: null,
		stationsUpdatedAt: null,
		questsUpdatedAt: 0,
	});
	assert.deepEqual(stored.errors, composed.errors);
	assert.deepEqual(stored.usage.freshness, {
		itemsUpdatedAt: 0,
		pricesUpdatedAt: null,
		bartersUpdatedAt: 0,
		tradersUpdatedAt: null,
	});
	assert.deepEqual(stored.acquisition.freshness, { itemsUpdatedAt: 0, pricesUpdatedAt: null, craftsUpdatedAt: 0 });
	assert.deepEqual(stored.acquisition.errors, composed.acquisition.errors);
	assert.equal("marketPrice" in stored.item, false);
	assert.equal("buyFromTrader" in stored.item, false);
	assert.equal("marketPrice" in stored.usage.items[0], false);
});
