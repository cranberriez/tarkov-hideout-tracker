import assert from "node:assert/strict";
import test from "node:test";
import { emptyProgress, type Tile } from "./battle-pass-model";
import { mergeDocumentProgress, prepareDocumentClaim } from "./document-inventory-model";

const tile: Tile = {
	id: "reward-a",
	slot: 1,
	displayName: "Reward",
	img: "",
	bigImg: "",
	cost: { financial: 5 },
	totalDocumentCost: 5,
	rewards: [],
};
const ids = { financial: "financial-item" };
const configured = { [tile.id]: [{ key: "financial", quantity: "5" }] };

test("claim consumption uses verified costs, preserves FIR until needed, and uses shared wildcards once", () => {
	const stored = { ...emptyProgress(), classified: 4, inventory: { financial: 99 } };
	const counts = { "financial-item": { have: 1, haveFir: 2 } };
	const result = prepareDocumentClaim(stored, counts, [tile.id, tile.id], [tile], configured, ids, true, true);
	assert.deepEqual(result.progress.completed, [tile.id]);
	assert.equal(result.progress.classified, 2);
	assert.deepEqual(result.changes, [{ itemId: "financial-item", haveDelta: -1, haveFirDelta: -2 }]);
	assert.deepEqual(result.progress.inventory, { financial: 99 });
	assert.equal(stored.classified, 4);
	const repeated = prepareDocumentClaim(result.progress, counts, [tile.id], [tile], configured, ids, true, true);
	assert.deepEqual(repeated.changes, []);
	assert.equal(repeated.progress.classified, 2);
});

test("unknown or unconfigured rewards never spend documents; disabled consumption records claims only", () => {
	const stored = { ...emptyProgress(), classified: 4 };
	const counts = { "financial-item": { have: 5, haveFir: 2 } };
	const unknown = prepareDocumentClaim(stored, counts, ["unknown"], [tile], configured, ids, true, true);
	assert.deepEqual(unknown.progress.completed, []);
	assert.deepEqual(unknown.changes, []);
	const missing = prepareDocumentClaim(stored, counts, [tile.id], [tile], {}, ids, true, true);
	assert.deepEqual(missing.unconfigured, [tile.id]);
	assert.deepEqual(missing.changes, []);
	assert.equal(missing.progress.classified, 4);
	const disabled = prepareDocumentClaim(stored, counts, [tile.id], [tile], configured, ids, false, true);
	assert.deepEqual(disabled.progress.completed, [tile.id]);
	assert.deepEqual(disabled.changes, []);
	assert.equal(disabled.progress.classified, 4);
});

test("ordinary reductions preserve FIR and do not use wildcards when disabled", () => {
	const counts = { "financial-item": { have: 10, haveFir: 2 } };
	const result = prepareDocumentClaim(emptyProgress(), counts, [tile.id], [tile], configured, ids, true, false);
	assert.deepEqual(result.changes, [{ itemId: "financial-item", haveDelta: -5, haveFirDelta: 0 }]);
});

test("configured types replace snapshot types and incomplete bulk claims do not partially debit", () => {
	const itemIds = { financial: "financial-item", medical: "medical-item" };
	const counts = { "financial-item": { have: 20, haveFir: 0 }, "medical-item": { have: 8, haveFir: 0 } };
	const configuration = { [tile.id]: [{ key: "medical", quantity: "5" }] };
	const result = prepareDocumentClaim(emptyProgress(), counts, [tile.id], [tile], configuration, itemIds, true, false);
	assert.deepEqual(result.changes, [{ itemId: "medical-item", haveDelta: -5, haveFirDelta: 0 }]);
	const other = { ...tile, id: "reward-b" };
	const bulk = prepareDocumentClaim(
		emptyProgress(),
		counts,
		[tile.id, other.id],
		[tile, other],
		configuration,
		itemIds,
		true,
		false,
	);
	assert.deepEqual(bulk.progress.completed, [tile.id, other.id]);
	assert.deepEqual(bulk.unconfigured, [other.id]);
	assert.deepEqual(bulk.changes, []);
});

test("pass field edits preserve unknown records, legacy balances and goal IDs", () => {
	const original = {
		version: 1,
		future: { retained: true },
		inventory: { financial: 55 },
		goals: ["old-goal"],
		costSwaps: { "old-reward": { financial: "user" } },
	};
	const raw = mergeDocumentProgress(JSON.stringify(original), { classified: 7 });
	assert.deepEqual(JSON.parse(raw), { ...original, classified: 7 });
});
