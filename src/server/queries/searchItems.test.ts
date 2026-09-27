import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createJiti } from "jiti";
import path from "node:path";
import { ITEM_SEARCH_MAX_QUERY_LENGTH } from "../../types/contracts";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { isValidItemSearchQuery } = await jiti.import<typeof import("./searchItems")>("./searchItems.ts");

test("item search validates normalized query text and length", () => {
	assert.equal(isValidItemSearchQuery("bolts"), true);
	assert.equal(isValidItemSearchQuery("  pack of sugar  "), true);
	assert.equal(isValidItemSearchQuery("   "), false);
	assert.equal(isValidItemSearchQuery("x".repeat(ITEM_SEARCH_MAX_QUERY_LENGTH + 1)), false);
});
