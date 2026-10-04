import test from "node:test";
import assert from "node:assert/strict";
import type { PriceHistoryPoint } from "../../../src/types/prices";
import { analyzeMode, seedAnalysisState } from "../analysis";
import { emptyModeState } from "../worker-state";
import { buildObservation, type MarketObservation } from "./observation";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 28, 12);
const points: PriceHistoryPoint[] = Array.from({ length: 100 }, (_, index) => ({
	timestamp: NOW - (99 - index) * 2 * HOUR,
	price: 21_000,
	priceMin: 20_000 + (index % 3) * 500,
	offerCount: 12,
}));
const sellFor = [{ traderId: "54cb57776803fa99248b456e", priceRUB: 5_100 }];

test("observation combines market and economic state with compact evidence", () => {
	const observation = buildObservation("relay", points, sellFor, NOW)!;
	assert.equal(observation.sourceUpdatedAt, NOW);
	assert.equal(observation.livePriceMin, points.at(-1)!.priceMin);
	assert.ok(observation.marketValue! >= 20_000 && observation.marketValue! <= 21_000);
	assert.equal(observation.traderValue, 5_100);
	assert.equal(observation.basePrice, 10_000);
	assert.ok(observation.fleaNet! > observation.traderValue!);
	assert.equal(observation.traderId, "54cb57776803fa99248b456e");
	assert.equal(observation.trend, "stable");
	assert.equal(buildObservation("none", [], sellFor, NOW), null);
});

test("analysis writes one row per item with new upstream data only", async () => {
	const state = emptyModeState();
	state.eligibleIds = ["fresh", "unchanged", "uncached", "excluded"];
	state.items.fresh = { etag: null, checkedAt: 1, latestTimestamp: NOW, analyzedTimestamp: NOW - 2 * HOUR };
	state.items.unchanged = { etag: null, checkedAt: 1, latestTimestamp: NOW, analyzedTimestamp: NOW };
	state.items.excluded = { etag: null, checkedAt: 1, latestTimestamp: null, excluded: { reason: "not-found", at: 1 } };
	let written: readonly MarketObservation[] = [];
	const run = await analyzeMode("pvp-season", state, {
		readHistory: () => points,
		readTraderSellOffers: async () => new Map([["fresh", sellFor]]),
		writeRun: async (_run, observations) => {
			written = observations;
		},
		saveState: () => undefined,
		now: () => NOW,
		newRunId: () => "analysis-1",
	});
	assert.deepEqual(
		written.map((observation) => observation.itemId),
		["fresh"],
	);
	assert.equal(run.analyzedCount, 1);
	assert.equal(run.unchangedCount, 1);
	assert.equal(run.missingCount, 1);
	assert.equal(state.items.fresh.analyzedTimestamp, NOW);
	assert.equal(state.lastAnalysisAt, NOW);

	const again = await analyzeMode(
		"pvp-season",
		state,
		{
			readHistory: () => points,
			readTraderSellOffers: async () => new Map(),
			writeRun: async (_run, observations) => {
				written = observations;
			},
			saveState: () => undefined,
			now: () => NOW,
			newRunId: () => "analysis-2",
		},
		{ includeUnchanged: true },
	);
	assert.equal(again.analyzedCount, 2);
	assert.deepEqual(written.map((observation) => observation.itemId).sort(), ["fresh", "unchanged"]);
});

test("a fresh local state resumes analysis progress from PostgreSQL", () => {
	const state = emptyModeState();
	state.items.seen = { etag: null, checkedAt: 1, latestTimestamp: NOW };
	state.items.local = { etag: null, checkedAt: 1, latestTimestamp: NOW, analyzedTimestamp: NOW };
	state.items.unseen = { etag: null, checkedAt: 1, latestTimestamp: NOW };
	const restored = seedAnalysisState(state, {
		lastRunAt: NOW - HOUR,
		analyzed: new Map([
			["seen", NOW],
			["local", NOW - HOUR],
		]),
	});
	assert.equal(restored, 1);
	assert.equal(state.lastAnalysisAt, NOW - HOUR);
	assert.equal(state.items.seen.analyzedTimestamp, NOW);
	assert.equal(state.items.local.analyzedTimestamp, NOW);
	assert.equal(state.items.unseen.analyzedTimestamp, undefined);
});
