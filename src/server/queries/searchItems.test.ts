import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import type { Client } from "@libsql/client";
import { createJiti } from "jiti";
import { ITEM_SEARCH_MAX_QUERY_LENGTH } from "../../types/contracts";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
    alias: {
        "@": path.join(process.cwd(), "src"),
        "server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
    },
});
const {
    isValidItemSearchQuery,
    searchItems,
} = await jiti.import<typeof import("./searchItems")>("./searchItems.ts");

test("item search validates normalized query text and length", () => {
    assert.equal(isValidItemSearchQuery("bolts"), true);
    assert.equal(isValidItemSearchQuery("  pack of sugar  "), true);
    assert.equal(isValidItemSearchQuery("   "), false);
    assert.equal(
        isValidItemSearchQuery("x".repeat(ITEM_SEARCH_MAX_QUERY_LENGTH + 1)),
        false,
    );
});

test("item search resolves the active release before reading previews", async () => {
    let previewRead = false;
    const database = {
        execute: async (statement: { sql: string }) => {
            if (statement.sql.includes("SELECT active.release_id")) {
                return { rows: [{ release_id: "release-current" }] };
            }
            previewRead = true;
            return { rows: [] };
        },
    } as unknown as Client;

    await assert.rejects(searchItems("bolts", "regular", 10, database), /No ready data release/);
    assert.equal(previewRead, true);
});
