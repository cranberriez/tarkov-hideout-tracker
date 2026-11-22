import test from "node:test";
import assert from "node:assert/strict";
import { alternateEntries } from "./alternate-entries-model";
import { buildGatheringSavings, type SavingsRoute } from "./gathering-savings-model";

/** One PVP claim per [id, cost, reward TarCoins]. */
function route(spec: [string, number, number][]): SavingsRoute {
	return {
		claims: spec.map(([id, cost], index) => ({
			rewardId: id,
			profileKey: "PVP",
			profileLabel: "PVP",
			page: index + 1,
			cost: { financial: cost },
			ordinaryUsed: { financial: 0 },
			classifiedUsed: 0,
			additionalClassified: cost,
			possibleNow: false,
		})),
		selected: spec.map(([id, cost, coins]) => ({
			id,
			cost: { financial: cost },
			rewards: [{ type: "tarcoin", value: coins }],
		})),
		additionalClassified: spec.reduce((sum, [, cost]) => sum + cost, 0),
		classifiedUsed: 0,
	} as unknown as SavingsRoute;
}

test("alternate entries are undominated breakpoints of their own route", () => {
	const routes = [
		route([
			["a", 300, 0],
			["b", 300, 0],
		]),
		route([
			["a", 300, 0],
			["c", 340, 3000],
			["d", 100, 0],
		]),
	];
	const base = buildGatheringSavings(routes[0], 0, true);
	const baseline = base[0].cashCents + base[0].savingsCents;
	const entries = alternateEntries(routes, base, baseline, {}, Infinity, 0, 0, true);
	assert.ok(entries.length > 0);
	for (const entry of entries) {
		assert.equal(entry.routeIndex, 1);
		const point =
			entry.gathered === 0
				? undefined
				: buildGatheringSavings(routes[1], 0, true).find((p) => p.gathered === entry.gathered);
		if (point) assert.equal(point.cashCents, entry.cashCents);
		assert.ok(
			!base.some(
				(p) =>
					p.cashCents <= entry.cashCents &&
					p.gathered <= entry.gathered &&
					p.plan.balanceTarCoins >= entry.tarCoinsLeft,
			),
		);
		assert.ok(entry.cashCents <= baseline);
	}
});
