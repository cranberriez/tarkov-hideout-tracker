import assert from "node:assert/strict";
import test from "node:test";
import { applyClaims, parseClaimDeductions, type ClaimRow } from "./claim-deduction-model";

const row = (rewardId: string, cost: Record<string, number>, have: Record<string, number>) =>
	({ rewardId, profileKey: "PVP", profileLabel: "PVP", cost, expected: have, planIndex: 1, have }) as ClaimRow & {
		have: Record<string, number>;
	};

test("owned documents are consumed and classified fill only what is missing", () => {
	const outcome = applyClaims(
		[row("a", { medical: 5, test: 2 }, { medical: 2, test: 2 })],
		{ PVP: { medical: 4, test: 6 } },
		10,
	);
	// Having 2 of 5 means the player had exactly 2: the stale 4 all go.
	assert.deepEqual(outcome.inventories.PVP, { medical: 0, test: 4 });
	assert.deepEqual(outcome.deductions.a, { profileKey: "PVP", documents: { medical: 4, test: 2 }, classified: 3 });
	assert.equal(outcome.classified, 7);
	assert.equal(outcome.classifiedShort, 0);
});

test("rows share stock in order and report a classified shortfall", () => {
	const outcome = applyClaims(
		[row("a", { test: 3 }, { test: 3 }), row("b", { test: 3 }, { test: 1 })],
		{ PVP: { test: 4 } },
		1,
	);
	assert.equal(outcome.inventories.PVP.test, 0);
	assert.equal(outcome.deductions.b.documents.test, 1);
	assert.equal(outcome.classifiedShort, 1);
});

test("deduction records parse defensively", () => {
	const raw = JSON.stringify({
		claimDeductions: { a: { profileKey: "PVE", documents: { test: 2, bad: -1 }, classified: 1 }, b: { documents: {} } },
	});
	assert.deepEqual(parseClaimDeductions(raw), { a: { profileKey: "PVE", documents: { test: 2 }, classified: 1 } });
	assert.deepEqual(parseClaimDeductions("not json"), {});
});
