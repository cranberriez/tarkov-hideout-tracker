import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTraderSellOffers } from "../../../src/lib/data/traders";
import { calcTax } from "../../../src/lib/price-calculation/calc-tax";
import { computeEconomics } from "./economics";

const THERAPIST = "54cb57776803fa99248b456e";
// Stored rows may still use the earlier inline vendor form. Flea quotes carry no trader ID and are dropped.
const fleaRow = { vendor: { name: "Flea Market", normalizedName: "flea-market" }, priceRUB: 90_000 };
const offers = normalizeTraderSellOffers([
	{ vendor: { id: THERAPIST, name: "Therapist", normalizedName: "therapist" }, priceRUB: 5_100 },
	{ traderId: "579dc571d53a0658a154fbec", priceRUB: 2_400 },
	fleaRow,
]);

test("trader crossover, practical crossover and max-net envelope", () => {
	const economics = computeEconomics(20_000, offers);
	assert.equal(economics.basePrice, 10_000);
	assert.equal(economics.traderValue, 5_100);
	assert.equal(economics.traderId, THERAPIST);
	assert.equal(economics.fleaNet, 20_000 - calcTax(10_000, 20_000)!);

	const net = (price: number) => price - calcTax(10_000, price)!;
	const breakEven = economics.traderBreakEven!;
	assert.ok(net(breakEven) >= 5_100 && net(breakEven - 1) < 5_100);
	assert.ok(economics.practicalBreakEven! > breakEven);
	assert.ok(net(economics.practicalBreakEven!) >= 5_100 * 1.05);
	assert.ok(economics.maxNetPrice! > economics.practicalBreakEven!);
	assert.equal(economics.maxNet, net(economics.maxNetPrice!));
});

test("missing trader buyback leaves economics unpriced rather than guessed", () => {
	const economics = computeEconomics(20_000, normalizeTraderSellOffers([fleaRow]));
	assert.equal(economics.basePrice, null);
	assert.equal(economics.traderValue, null);
	assert.equal(economics.fleaNet, null);
	assert.equal(economics.traderBreakEven, null);
	assert.equal(economics.maxNetPrice, null);
});
