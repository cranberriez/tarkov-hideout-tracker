import assert from "node:assert/strict";
import test from "node:test";
import { emptyProgress, type PassPage, type Tile } from "../battle-pass/lib/battle-pass-model";
import { estimatedDaysRemaining, seasonOverview } from "./season-overview-model";

const tile = (id: string, slot: number, cost = 2): Tile => ({
	id,
	slot,
	displayName: id,
	img: "",
	bigImg: "",
	cost: { financial: cost },
	totalDocumentCost: cost,
	rewards: [],
});
const sample: PassPage[] = [
	{ num: 1, req: 0, cells: [tile("a", 1), tile("b", 2)] },
	{ num: 2, req: 2, cells: [tile("c", 1)] },
];

test("combined goals share inventory and locked rewards cannot use it prematurely", () => {
	const progress = { ...emptyProgress(), goals: ["a", "b", "c"], inventory: { financial: 3 } };
	const result = seasonOverview(progress, false, sample);
	assert.deepEqual(
		result.goals.map((goal) => goal.fraction),
		[1, 0.5, 0],
	);
	assert.equal(result.coverage.ownedUsed, 3);
	assert.equal(result.coverage.missing, 3);
	assert.deepEqual(progress.inventory, { financial: 3 });
});

test("known completion and classified preference apply while unknown goals remain explicit", () => {
	const progress = { ...emptyProgress(), completed: ["a", "unknown"], goals: ["a", "b", "lost"], classified: 1 };
	const excluded = seasonOverview(progress, false, sample);
	const included = seasonOverview(progress, true, sample);
	assert.equal(included.completed, 1);
	assert.deepEqual(included.plan.unresolvedIds, ["lost"]);
	assert.deepEqual(
		included.goals.map((goal) => goal.fraction),
		[1, 0.5],
	);
	assert.equal(excluded.goals[1].fraction, 0);
	assert.equal(included.coverage.classifiedUsed, 1);
});

test("empty goals produce no implicit whole-pass plan", () => {
	const result = seasonOverview(emptyProgress(), false, sample);
	assert.equal(result.plan.total, 0);
	assert.deepEqual(result.goals, []);
});

test("countdown uses calendar days and stops at zero on and after the estimated end date", () => {
	const endsAt = Date.UTC(2026, 11, 7);
	assert.equal(estimatedDaysRemaining(Date.UTC(2026, 9, 10, 0), endsAt), 58);
	assert.equal(estimatedDaysRemaining(Date.UTC(2026, 9, 10, 23, 59), endsAt), 58);
	assert.equal(estimatedDaysRemaining(Date.UTC(2026, 11, 7), endsAt), 0);
	assert.equal(estimatedDaysRemaining(Date.UTC(2026, 11, 8), endsAt), 0);
});
