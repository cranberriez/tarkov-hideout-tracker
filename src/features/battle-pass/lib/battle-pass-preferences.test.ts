import assert from "node:assert/strict";
import test from "node:test";
import { defaultPreferences, parsePreferences, updatePreference } from "./battle-pass-preferences";

test("inventory expansion defaults open and roundtrips independently of location visibility and player preferences", () => {
	assert.equal(parsePreferences(null).documentInventoryExpanded, true);
	assert.equal(parsePreferences(JSON.stringify({ showMaps: false })).documentInventoryExpanded, true);
	let raw = JSON.stringify({ showMaps: true, consumeDocs: true, future: { retained: true } });
	for (const expanded of [false, true]) {
		raw = updatePreference(raw, "documentInventoryExpanded", expanded);
		const restored = parsePreferences(raw);
		assert.equal(restored.documentInventoryExpanded, expanded);
		assert.equal(restored.showMaps, true);
		assert.equal(restored.consumeDocs, true);
		assert.deepEqual(restored.future, { retained: true });
	}
	assert.equal(parsePreferences('{"documentInventoryExpanded":"false"}').documentInventoryExpanded, true);
});

test("document locations default collapsed and remember both toggle states without replacing preferences", () => {
	assert.equal(parsePreferences(null).showMaps, false);
	assert.equal(parsePreferences(JSON.stringify({ listMode: true })).showMaps, false);
	let raw = JSON.stringify({ listMode: true, future: { retained: true } });
	for (const expanded of [true, false]) {
		raw = updatePreference(raw, "showMaps", expanded);
		const restored = parsePreferences(raw);
		assert.equal(restored.showMaps, expanded);
		assert.equal(restored.listMode, true);
		assert.deepEqual(restored.future, { retained: true });
	}
});

test("preference reads normalize fields independently without changing saved bytes", () => {
	assert.deepEqual(parsePreferences(null), defaultPreferences);
	assert.deepEqual(parsePreferences("invalid"), defaultPreferences);
	assert.deepEqual(parsePreferences("[]"), defaultPreferences);
	const raw = JSON.stringify({ requestedScope: "other", listMode: 1, consumeDocs: true, future: { value: 5 } });
	const result = parsePreferences(raw);
	assert.equal(result.requestedScope, "goals");
	assert.equal(result.listMode, false);
	assert.equal(result.consumeDocs, true);
	assert.deepEqual(result.future, { value: 5 });
	assert.equal(raw, JSON.stringify({ requestedScope: "other", listMode: 1, consumeDocs: true, future: { value: 5 } }));
});

test("all shared UI preferences survive edits and reload while retaining unknown preferences", () => {
	let raw = JSON.stringify({ future: ["retained"] });
	raw = updatePreference(raw, "requestedScope", "all");
	for (const key of [
		"useClassified",
		"cumulative",
		"showPossibleProgress",
		"listMode",
		"consumeDocs",
		"showMaps",
		"documentsOpen",
	] as const) {
		raw = updatePreference(raw, key, true);
	}
	const restored = parsePreferences(raw);
	assert.equal(restored.requestedScope, "all");
	assert.equal(restored.consumeDocs, true);
	assert.equal(restored.documentsOpen, true);
	assert.deepEqual(restored.future, ["retained"]);
	assert.deepEqual(parsePreferences(JSON.stringify(restored)), restored);
	const updated = parsePreferences(updatePreference(raw, "showPossibleProgress", false));
	assert.equal(updated.showPossibleProgress, false);
	assert.equal(updated.consumeDocs, true);
	assert.equal(updated.requestedScope, "all");
	assert.deepEqual(updated.future, ["retained"]);
});
