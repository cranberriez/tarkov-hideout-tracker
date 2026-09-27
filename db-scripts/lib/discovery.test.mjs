import assert from "node:assert/strict";
import test from "node:test";
import {
	createDiscoveryExport,
	validateDiscoveryExport,
	buildDiscoveryReconciliation,
	DISCOVERY_MODES,
} from "./discovery.mjs";

const tracking = DISCOVERY_MODES.map((mode) => ({ mode, baseline_release_id: "baseline", initialized_at: 100 }));
const rows = DISCOVERY_MODES.flatMap((mode, index) => [
	{
		mode,
		item_id: "baseline-item",
		first_seen_at: null,
		first_seen_patch: "pre-1.1.5",
		first_seen_release_id: "baseline",
	},
	{
		mode,
		item_id: "removed-item",
		first_seen_at: 200 + index,
		first_seen_patch: "1.1.5.0",
		first_seen_release_id: "later",
	},
]);
test("discovery exports preserve baseline nulls, mode dates, and removed IDs", () => {
	const document = createDiscoveryExport(rows, tracking, 1000);
	assert.deepEqual(validateDiscoveryExport(document), document);
	assert.equal(document.rows.length, 6);
	assert.equal(document.rows.filter((row) => row.first_seen_at === null).length, 3);
	assert.deepEqual(
		new Set(document.rows.filter((row) => row.item_id === "removed-item").map((row) => row.first_seen_at)),
		new Set([200, 201, 202]),
	);
});
test("discovery exports preserve an explicitly unknown baseline", () => {
	const unknown = DISCOVERY_MODES.map((mode) => ({
		item_id: `unknown-${mode}`,
		mode,
		first_seen_at: null,
		first_seen_patch: null,
		first_seen_release_id: null,
	}));
	const document = createDiscoveryExport(unknown, tracking, 1000);
	assert.deepEqual(validateDiscoveryExport(document), document);
	assert.ok(
		document.rows.every(
			(row) => row.first_seen_at === null && row.first_seen_patch === null && row.first_seen_release_id === null,
		),
	);
});
test("discovery refuses absent baselines, duplicate IDs, invalid dates, and tampering", () => {
	assert.throws(() => createDiscoveryExport(rows, tracking.slice(1)), /initialization decision/);
	assert.throws(() => createDiscoveryExport([...rows, rows[0]], tracking), /Duplicate/);
	assert.throws(
		() => createDiscoveryExport([{ ...rows[0], first_seen_at: 10 }, ...rows.slice(1)], tracking),
		/Invalid/,
	);
	const document = createDiscoveryExport(rows, tracking, 1000);
	document.rows[0].first_seen_patch = "changed";
	assert.throws(() => validateDiscoveryExport(document));
});

test("reconciliation enriches only wholly unknown bootstrap facts and preserves arbitrary stable IDs", () => {
	const incoming = rows.map((row) => ({
		...row,
		item_id: row.item_id === "baseline-item" ? "customdogtags12345678910" : "707265736574-any-preset",
	}));
	const existing = incoming.map((row) => ({
		...row,
		first_seen_at: null,
		first_seen_patch: null,
		first_seen_release_id: null,
	}));
	existing.push({ ...rows[0], item_id: "removed-known-item" });
	const plan = buildDiscoveryReconciliation(existing, createDiscoveryExport(incoming, tracking));
	assert.deepEqual(plan.enrichments, createDiscoveryExport(incoming, tracking).rows);
	assert.equal(plan.additions.length, 0);
	assert.equal(existing.length, 7);
});

test("unknown imports cannot erase known facts; identical bigint timestamps are idempotent", () => {
	const unknown = rows.map((row) => ({
		...row,
		first_seen_at: null,
		first_seen_patch: null,
		first_seen_release_id: null,
	}));
	const plan = buildDiscoveryReconciliation(rows, createDiscoveryExport(unknown, tracking));
	assert.equal(plan.preserved, 6);
	assert.equal(plan.enrichments.length, 0);
	const identical = buildDiscoveryReconciliation(
		rows.map((row) => ({ ...row, first_seen_at: row.first_seen_at?.toString() ?? null })),
		createDiscoveryExport(rows, tracking),
	);
	assert.equal(identical.enrichments.length, 0);
});

test("known baselines and local observations conflict atomically with bounded error and complete facts", () => {
	const many = Array.from({ length: 120 }, (_, index) => ({ ...rows[index % rows.length], item_id: `item-${index}` }));
	const existing = many.map((row, index) =>
		index % 2
			? { ...row, first_seen_at: 9999, first_seen_release_id: null }
			: { ...row, first_seen_release_id: "different-baseline" },
	);
	assert.throws(
		() => buildDiscoveryReconciliation(existing, createDiscoveryExport(many, tracking)),
		(error) => {
			assert.match(error.message, /Discovery conflicts: 120/);
			assert.ok(error.message.length < 1200);
			assert.equal(error.diagnostic.conflicts.length, 120);
			assert.equal(error.diagnostic.conflicts.filter((entry) => entry.kind === "local-observation").length, 60);
			assert.equal(
				Object.values(error.diagnostic.counts).reduce((sum, count) => sum + count),
				120,
			);
			assert.ok(!error.message.includes("item-99"));
			return true;
		},
	);
});
