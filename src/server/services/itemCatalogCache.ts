import type { DataDiagnostics } from "@/types/common";
import type { ItemSummary } from "@/types/items";

export const ITEM_CATALOG_CHUNK_MAX_BYTES = 750 * 1024;
export const ITEM_CATALOG_MANIFEST_SCHEMA = 1;

export interface ItemCatalogManifest {
    schema: typeof ITEM_CATALOG_MANIFEST_SCHEMA;
    generation: string;
    slot: 0 | 1;
    chunkCount: number;
    itemCount: number;
    updatedAt: number;
    diagnostics?: DataDiagnostics;
}

interface ItemCatalogChunk {
    generation: string;
    items: ItemSummary[];
}

const encoder = new TextEncoder();

function byteLength(value: string) {
    return encoder.encode(value).byteLength;
}

export function serializeItemCatalogChunks(
    items: ItemSummary[],
    generation: string,
    maxBytes = ITEM_CATALOG_CHUNK_MAX_BYTES,
): string[] {
    if (!generation || items.length === 0 || maxBytes <= 0) return [];

    const prefix = `{"generation":${JSON.stringify(generation)},"items":[`;
    const suffix = "]}";
    const fixedBytes = byteLength(prefix) + byteLength(suffix);
    const chunks: string[] = [];
    let entries: string[] = [];
    let currentBytes = fixedBytes;

    for (const item of items) {
        const serialized = JSON.stringify(item);
        const entryBytes = byteLength(serialized) + (entries.length > 0 ? 1 : 0);
        if (fixedBytes + byteLength(serialized) > maxBytes) {
            throw new Error(`Catalog item ${item.id} exceeds the Redis chunk budget`);
        }
        if (entries.length > 0 && currentBytes + entryBytes > maxBytes) {
            chunks.push(`${prefix}${entries.join(",")}${suffix}`);
            entries = [];
            currentBytes = fixedBytes;
        }
        entries.push(serialized);
        currentBytes += byteLength(serialized) + (entries.length > 1 ? 1 : 0);
    }
    if (entries.length > 0) chunks.push(`${prefix}${entries.join(",")}${suffix}`);
    return chunks;
}

export function parseItemCatalogManifest(value: unknown): ItemCatalogManifest | null {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== "object") return null;
        const manifest = parsed as Partial<ItemCatalogManifest>;
        if (
            manifest.schema !== ITEM_CATALOG_MANIFEST_SCHEMA ||
            typeof manifest.generation !== "string" ||
            !/^\d{10,}-[a-f0-9]{8}$/.test(manifest.generation) ||
            (manifest.slot !== 0 && manifest.slot !== 1) ||
            !Number.isInteger(manifest.chunkCount) ||
            (manifest.chunkCount ?? 0) <= 0 ||
            (manifest.chunkCount ?? 0) > 10_000 ||
            !Number.isInteger(manifest.itemCount) ||
            (manifest.itemCount ?? 0) <= 0 ||
            typeof manifest.updatedAt !== "number" ||
            !Number.isFinite(manifest.updatedAt)
        ) return null;
        return manifest as ItemCatalogManifest;
    } catch {
        return null;
    }
}

export function parseItemCatalogChunk(
    value: unknown,
    expectedGeneration: string,
): ItemSummary[] | null {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== "object") return null;
        const chunk = parsed as Partial<ItemCatalogChunk>;
        if (chunk.generation !== expectedGeneration || !Array.isArray(chunk.items)) return null;
        if (
            chunk.items.length === 0 ||
            chunk.items.some(
                (item) =>
                    !item ||
                    typeof item.id !== "string" ||
                    !item.id ||
                    typeof item.name !== "string" ||
                    typeof item.normalizedName !== "string",
            )
        ) return null;
        return chunk.items;
    } catch {
        return null;
    }
}
