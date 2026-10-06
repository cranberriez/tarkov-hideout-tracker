import assert from "node:assert/strict";
import test from "node:test";
import type { ItemSummary } from "@/types/items";
import { PHYSICAL_BITCOIN_ITEM_ID } from "./craft-rules";
import { getBestTraderOffer, getItemSellComparison } from "./prices";

const bitcoin: ItemSummary = {
	id: PHYSICAL_BITCOIN_ITEM_ID,
	name: "Physical Bitcoin",
	normalizedName: "physical-bitcoin",
	onFleaMarket: false,
	marketPrice: {
		sellFor: [
			{ traderId: "5a7c2eca46aef81a7ca2145d", priceRUB: 400_000 },
			{ traderId: "54cb57776803fa99248b456e", priceRUB: 534_000 },
			{ traderId: "579dc571d53a0658a154fbec", priceRUB: 200_000 },
		],
	},
};

test("Bitcoin's best trader buyback remains available when crafting disables locked-output sales", () => {
	assert.equal(getItemSellComparison(bitcoin, {}, { useTraderSaleForLockedOutputs: false }).selectedPrice, null);
	const offer = getBestTraderOffer(bitcoin);
	assert.equal(offer?.priceRUB, 534_000);
	assert.equal(offer?.traderId, "54cb57776803fa99248b456e");
	assert.equal(
		bitcoin.marketPrice?.sellFor?.[0].traderId,
		"5a7c2eca46aef81a7ca2145d",
		"selection must not reorder shared offers",
	);
});

test("trader-only selection uses the supplied mode's offers and never falls back to flea or manual prices", () => {
	assert.equal(getItemSellComparison(bitcoin, { [bitcoin.id]: { sell: 999_999 } }).selectedPrice, 999_999);
	assert.equal(getBestTraderOffer(bitcoin)?.priceRUB, 534_000);
	const otherMode = {
		...bitcoin,
		marketPrice: { sellFor: [{ traderId: "54cb57776803fa99248b456e", priceRUB: 600_000 }] },
	};
	assert.equal(getBestTraderOffer(otherMode)?.priceRUB, 600_000);
	assert.equal(getBestTraderOffer({ ...bitcoin, marketPrice: { price: 1_000_000 } }), null);
	assert.equal(getBestTraderOffer(undefined), null);
});

test("invalid trader offers cannot win selection; no valid offer stays unavailable", () => {
	const invalid = [NaN, Infinity, -1].map((priceRUB) => ({ traderId: "invalid", priceRUB }));
	assert.equal(getBestTraderOffer({ ...bitcoin, marketPrice: { sellFor: invalid } }), null);
	assert.equal(
		getBestTraderOffer({ ...bitcoin, marketPrice: { sellFor: [...invalid, ...bitcoin.marketPrice!.sellFor!] } })
			?.priceRUB,
		534_000,
	);
});
