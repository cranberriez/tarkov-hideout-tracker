import assert from "node:assert/strict";
import test from "node:test";
import { mergeDocumentProgress } from "./document-inventory-model";

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
