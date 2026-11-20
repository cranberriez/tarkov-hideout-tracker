import assert from "node:assert/strict";
import test from "node:test";
import { documentItemIds, itemCountChange, profileDocumentCounts } from "./battle-pass-inventory";

const financialId = documentItemIds.financial;

test("profile totals add FIR and non-FIR stock; absent or negative records count as zero", () => {
	assert.equal(profileDocumentCounts({ [financialId]: { have: 2, haveFir: 3 } }).financial, 5);
	assert.equal(profileDocumentCounts({}).financial, 0);
	assert.equal(profileDocumentCounts({ [financialId]: { have: -5, haveFir: 3 } }).financial, 3);
});

test("owned edits preserve FIR stock until non-FIR stock runs out", () => {
	const counts = { have: 2, haveFir: 3 };
	assert.deepEqual(itemCountChange(financialId, counts, 4), { itemId: financialId, haveDelta: -1, haveFirDelta: 0 });
	assert.deepEqual(itemCountChange(financialId, counts, 1), { itemId: financialId, haveDelta: -2, haveFirDelta: -2 });
	assert.deepEqual(itemCountChange(financialId, counts, 8), { itemId: financialId, haveDelta: 3, haveFirDelta: 0 });
});
