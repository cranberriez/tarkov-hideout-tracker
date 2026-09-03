import assert from "node:assert/strict";
import test from "node:test";
import type { ItemSummary } from "@/types/items";
import {
    ITEM_CATALOG_MANIFEST_SCHEMA,
    parseItemCatalogChunk,
    parseItemCatalogManifest,
    serializeItemCatalogChunks,
} from "./itemCatalogCache";

const generation = "1788100000000-deadbeef";

test("catalog chunks remain inside the UTF-8 byte budget and reconstruct exactly", () => {
    const items: ItemSummary[] = Array.from({ length: 12 }, (_, index) => ({
        id: `item-${index}`,
        name: `Батарея ${index}`,
        normalizedName: `battery-${index}`,
        wikiLink: `https://example.test/${"x".repeat(60)}`,
    }));
    const maxBytes = 500;
    const chunks = serializeItemCatalogChunks(items, generation, maxBytes);

    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
        assert.ok(new TextEncoder().encode(chunk).byteLength <= maxBytes);
    }
    assert.deepEqual(
        chunks.flatMap((chunk) => parseItemCatalogChunk(chunk, generation) ?? []),
        items,
    );
});

test("catalog chunk validation rejects mixed generations and malformed items", () => {
    const [chunk] = serializeItemCatalogChunks(
        [{ id: "item-1", name: "Item", normalizedName: "item" }],
        generation,
    );
    assert.equal(parseItemCatalogChunk(chunk, "1788100000001-cafebabe"), null);
    assert.equal(
        parseItemCatalogChunk({ generation, items: [{ id: "item-1" }] }, generation),
        null,
    );
});

test("catalog manifest validation accepts only complete bounded manifests", () => {
    const manifest = {
        schema: ITEM_CATALOG_MANIFEST_SCHEMA,
        generation,
        slot: 1,
        chunkCount: 3,
        itemCount: 25,
        updatedAt: 1_788_100_000_000,
        diagnostics: { provider: "json" as const, upstreamStatus: "ok" as const },
    };
    assert.deepEqual(parseItemCatalogManifest(JSON.stringify(manifest)), manifest);
    assert.equal(parseItemCatalogManifest({ ...manifest, chunkCount: 0 }), null);
    assert.equal(parseItemCatalogManifest({ ...manifest, slot: 2 }), null);
    assert.equal(parseItemCatalogManifest({ ...manifest, generation: "invalid" }), null);
});
