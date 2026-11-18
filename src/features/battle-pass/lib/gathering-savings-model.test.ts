import test from "node:test";
import assert from "node:assert/strict";
import { buildGatheringSavings, gatheringScenario, type SavingsRoute } from "./gathering-savings-model";
import { optimizeRouteFunding } from "./funding-model";
import { gatheringDailyCap } from "./gathering-caps";

function route(
	amounts: { profile: string; cost: number; owned?: number; classified?: number; coins?: number; key?: string }[],
): SavingsRoute {
	const claims = amounts.map((row, index) => ({
		rewardId: String(index),
		profileKey: row.profile,
		profileLabel: row.profile,
		page: 1,
		cost: { [row.key ?? "financial"]: row.cost },
		ordinaryUsed: { [row.key ?? "financial"]: row.owned ?? 0 },
		classifiedUsed: row.classified ?? 0,
		additionalClassified: row.cost - (row.owned ?? 0) - (row.classified ?? 0),
		possibleNow: false,
	}));
	return {
		claims,
		selected: amounts.map((row, index) => ({
			id: String(index),
			slot: index,
			displayName: String(index),
			img: "",
			bigImg: "",
			cost: claims[index].cost,
			totalDocumentCost: row.cost,
			rewards: [{ type: "tarcoin", value: row.coins ?? 0 }],
		})),
		additionalClassified: claims.reduce((sum, claim) => sum + claim.additionalClassified, 0),
		classifiedUsed: claims.reduce((sum, claim) => sum + claim.classifiedUsed, 0),
		stock: {},
		unresolvedIds: [],
		possibleNow: 0,
	};
}

test("replays shared classified after new ordinary documents and preserves profile owners", () => {
	const input = route([
		{ profile: "PVP", cost: 10, owned: 2, classified: 8 },
		{ profile: "PVE", cost: 20 },
	]);
	const scenario = gatheringScenario(input, 9);
	assert.deepEqual(
		scenario.quantities.map((row) => [row.profileKey, row.quantity]),
		[
			["PVP", 8],
			["PVE", 1],
		],
	);
	assert.deepEqual(
		scenario.claims.map((claim) => claim.additionalClassified),
		[0, 11],
	);
});

test("breakpoints match an exhaustive funding sweep and omit full gathering", () => {
	const input = route([
		{ profile: "PVP", cost: 30, coins: 500 },
		{ profile: "PVE", cost: 35 },
	]);
	const points = buildGatheringSavings(input, 0, true);
	const expected: number[] = [];
	let previous = optimizeRouteFunding(gatheringScenario(input, 0).claims, 0, true).cashCents;
	for (let count = 1; count < input.additionalClassified; count++) {
		const cash = optimizeRouteFunding(gatheringScenario(input, count).claims, 0, true).cashCents;
		if (cash < previous) expected.push(count);
		previous = cash;
	}
	assert.deepEqual(
		points.map((point) => point.gathered),
		expected,
	);
	assert.ok(points.every((point) => point.remainingClassified > 0));
	assert.ok(points.some((point) => point.cashCents === 0));
	for (const point of points)
		assert.equal(
			point.parallelWindows,
			Math.max(...point.windows.map((profile) => Math.ceil(profile.quantity / gatheringDailyCap(profile.profileKey)))),
		);
});

test("profile windows use separate caps and cumulative quantities", () => {
	const input = route([
		{ profile: "PVP", cost: 30 },
		{ profile: "PVE", cost: 30 },
		{ profile: "season-1", cost: 30 },
	]);
	const points = buildGatheringSavings(input, 0, false);
	assert.ok(points.length > 0);
	assert.deepEqual([gatheringDailyCap("PVP"), gatheringDailyCap("PVE"), gatheringDailyCap("season-1")], [25, 15, 40]);
	for (const point of points)
		assert.equal(
			point.quantities.reduce((sum, row) => sum + row.quantity, 0),
			point.gathered,
		);
});

test("zero cash baseline and a one-document shortfall have no savings rows", () => {
	assert.deepEqual(buildGatheringSavings(route([{ profile: "PVP", cost: 40 }]), 10000, false), []);
	assert.deepEqual(buildGatheringSavings(route([{ profile: "PVP", cost: 1 }]), 0, false), []);
});

test("roughly 500 missing documents produce breakpoints without a per-document sweep", () => {
	const input = route(
		Array.from({ length: 20 }, (_, index) => ({
			profile: index % 2 ? "PVE" : "PVP",
			cost: 25,
			coins: index % 5 === 0 ? 500 : 0,
		})),
	);
	const started = performance.now();
	const points = buildGatheringSavings(input, 0, true);
	assert.ok(points.length > 0);
	assert.ok(performance.now() - started < 10000);
});
