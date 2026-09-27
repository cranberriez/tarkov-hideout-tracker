import test from "node:test";
import assert from "node:assert/strict";
import { encodeRecord, recordKey, stableStringify } from "./record-encoding.mjs";

test("legacy null price identity remains byte-for-byte stable across storage engines", () => {
	const encoded = encodeRecord("regular", {
		type: "entity",
		entityType: "price",
		entityId: "x",
		updatedAt: 1,
		payload: null,
	});
	assert.equal(encoded.payloadJson, "null");
	assert.equal(encoded.payloadHash, "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b");
	assert.equal(encoded.contentHash, "7c5ab9630f1c4bd53b4390c8eebe1b6b59cf60c666939422fe6dee15531757e8");
	assert.equal(recordKey(encoded), '["entity","x","price"]');
});

test("JSON object serialization order is irrelevant but array order remains content", () => {
	const base = { type: "entity", entityType: "quest", entityId: "q", payload: { z: [1, 2], a: { y: 2, x: 1 } } };
	const reordered = { ...base, payload: { a: { x: 1, y: 2 }, z: [1, 2] } };
	assert.equal(encodeRecord("regular", base).contentHash, encodeRecord("regular", reordered).contentHash);
	assert.notEqual(
		encodeRecord("regular", base).contentHash,
		encodeRecord("regular", { ...base, payload: { ...base.payload, z: [2, 1] } }).contentHash,
	);
});

test("canonical payloads deduplicate; freshness preserves availability, nested timestamps remain content", () => {
	assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
	const base = {
		type: "itemView",
		itemId: "x",
		viewType: "usage",
		updatedAt: 1,
		payload: { freshness: { itemsUpdatedAt: 123, pricesUpdatedAt: null }, data: { updatedAt: 5 } },
	};
	const a = encodeRecord("regular", base),
		b = encodeRecord("pve", {
			...base,
			updatedAt: 2,
			payload: { ...base.payload, freshness: { itemsUpdatedAt: 456, pricesUpdatedAt: null } },
		});
	assert.equal(a.payloadHash, b.payloadHash);
	assert.equal(a.contentHash, b.contentHash);
	assert.notEqual(
		a.contentHash,
		encodeRecord("regular", { ...base, payload: { ...base.payload, data: { updatedAt: 6 } } }).contentHash,
	);
	assert.notEqual(
		a.contentHash,
		encodeRecord("regular", {
			...base,
			payload: { ...base.payload, freshness: { itemsUpdatedAt: null, pricesUpdatedAt: null } },
		}).contentHash,
	);
});
