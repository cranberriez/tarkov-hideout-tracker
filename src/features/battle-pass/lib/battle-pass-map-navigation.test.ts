import assert from "node:assert/strict";
import test from "node:test";
import {
	DOCUMENT_MAP_HISTORY_KEY,
	defaultDocumentMapSnapshot,
	documentMapHistoryState,
	documentMapUrl,
	readDocumentMapSnapshot,
} from "./battle-pass-map-navigation";

const maps = [
	{ id: "ground_zero", slug: "ground-zero", floorIds: ["ground", "underground"] },
	{ id: "factory", slug: "factory", floorIds: ["ground", "unknown"] },
];
const keys = ["project", "medical"];
const url = (slug?: string) => new URL(`https://example.com/battle-pass/map${slug ? `?map=${slug}` : ""}`);

test("shareable map slugs select maps, with safe missing/invalid fallback", () => {
	assert.equal(readDocumentMapSnapshot(url("factory"), null, maps, keys).mapId, "factory");
	assert.equal(readDocumentMapSnapshot(url("invalid"), null, maps, keys).mapId, "ground_zero");
	assert.equal(readDocumentMapSnapshot(url(), [], maps, keys).mapId, "ground_zero");
	assert.equal(readDocumentMapSnapshot(url(), null, [], keys).mapId, "");
});

test("URL selection wins over a different map's history snapshot", () => {
	const saved = {
		...defaultDocumentMapSnapshot("factory"),
		hiddenFloors: ["ground"],
		view: { scale: 4, x: 12, y: 13 },
	};
	assert.deepEqual(
		readDocumentMapSnapshot(url("ground-zero"), { [DOCUMENT_MAP_HISTORY_KEY]: saved }, maps, keys),
		defaultDocumentMapSnapshot("ground_zero"),
	);
});

test("matching entries restore exact zoom, pan and filters independently", () => {
	const first = {
		...defaultDocumentMapSnapshot("factory"),
		view: { scale: 3, x: -45, y: 23 },
		hiddenFloors: ["unknown"],
		hiddenTypes: ["medical"],
	};
	const second = {
		...defaultDocumentMapSnapshot("factory"),
		view: { scale: 7, x: 240, y: -120 },
		hiddenTypes: ["project"],
	};
	const firstEntry = documentMapHistoryState({ __NA: true, tree: { route: "map" } }, first);
	const secondEntry = documentMapHistoryState(firstEntry, second);
	assert.deepEqual(readDocumentMapSnapshot(url("factory"), firstEntry, maps, keys), first);
	assert.deepEqual(readDocumentMapSnapshot(url("factory"), secondEntry, maps, keys), second);
	assert.deepEqual(firstEntry.tree, { route: "map" });
	assert.equal(firstEntry.__NA, true);
});

test("malformed entry fields cannot inject invalid map controls or nonfinite transforms", () => {
	const saved = {
		mapId: "factory",
		view: { scale: Infinity, x: NaN, y: "12" },
		hiddenFloors: ["unknown", "invalid", "unknown", 42],
		hiddenTypes: ["medical", "medical", {}, "invalid"],
	};
	assert.deepEqual(readDocumentMapSnapshot(url("factory"), { [DOCUMENT_MAP_HISTORY_KEY]: saved }, maps, keys), {
		mapId: "factory",
		view: { scale: 1, x: 0, y: 0 },
		hiddenFloors: ["unknown"],
		hiddenTypes: ["medical"],
	});
	const bounded = readDocumentMapSnapshot(
		url("factory"),
		{ [DOCUMENT_MAP_HISTORY_KEY]: { ...saved, view: { scale: 99, x: 1e9, y: -1e9 } } },
		maps,
		keys,
	);
	assert.deepEqual(bounded.view, { scale: 8, x: 100_000, y: -100_000 });
	assert.deepEqual(
		readDocumentMapSnapshot(url("factory"), { [DOCUMENT_MAP_HISTORY_KEY]: [] }, maps, keys),
		defaultDocumentMapSnapshot("factory"),
	);
});

test("map URLs preserve other query fields and fragments, while snapshots merge history internals", () => {
	assert.equal(
		documentMapUrl(new URL("https://example.com/battle-pass/map?other=1&map=old#controls"), maps[0]),
		"/battle-pass/map?other=1&map=ground-zero#controls",
	);
	const previous = { __NA: true, tree: { value: 1 }, anotherFeature: "retained" };
	const merged = documentMapHistoryState(previous, defaultDocumentMapSnapshot("factory"));
	assert.equal(merged.tree, previous.tree);
	assert.equal(merged.anotherFeature, "retained");
	assert.equal(DOCUMENT_MAP_HISTORY_KEY in previous, false);
});
