import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { DatabaseTransientReadError } from "./errors";

type CacheStub = { entries: Map<string, unknown>; insideCachedScope: boolean };
const g = globalThis as typeof globalThis & { __nextCacheStub?: CacheStub; __tarkovPostgresDb?: unknown };

// Stand-in for next/cache: a tagged data cache whose revalidateTag fails inside cached scopes, as Next's does.
const stubDir = mkdtempSync(path.join(tmpdir(), "next-cache-stub-"));
const stubPath = path.join(stubDir, "next-cache.mjs");
writeFileSync(
	stubPath,
	`const stub = () => globalThis.__nextCacheStub;
export function unstable_cache(read, keys) {
	return async () => {
		const key = JSON.stringify(keys);
		if (!stub().entries.has(key)) stub().entries.set(key, await read());
		return stub().entries.get(key);
	};
}
export function revalidateTag() {
	if (stub().insideCachedScope) throw new Error("revalidateTag used inside unstable_cache");
	stub().entries.clear();
}
`,
);

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
		"next/cache": stubPath,
	},
});
const { assertCatalogVersion, getCatalogVersion } =
	await jiti.import<typeof import("./postgres-read")>("./postgres-read.ts");
const { evictMemoizedReads } = await jiti.import<typeof import("./read-cache")>("./read-cache.ts");

test("a version mismatch seen inside a cached scope self-heals on the next version read", async (t) => {
	t.after(() => {
		delete g.__nextCacheStub;
		delete g.__tarkovPostgresDb;
		evictMemoizedReads(() => true);
		rmSync(stubDir, { recursive: true, force: true });
	});
	let contentVersion = 3;
	g.__tarkovPostgresDb = {
		select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ contentVersion }] }) }) }),
	};
	const stub: CacheStub = (g.__nextCacheStub = { entries: new Map(), insideCachedScope: false });
	const expireMemo = () => evictMemoizedReads(() => true);

	assert.equal(await getCatalogVersion("regular"), "3");
	contentVersion = 4;
	stub.insideCachedScope = true;
	await assert.rejects(assertCatalogVersion("regular", "3"), DatabaseTransientReadError);
	assert.equal(await getCatalogVersion("regular"), "4", "bypasses the stale tagged entry");
	assert.deepEqual([...stub.entries.values()], ["3"], "revalidation still disallowed");

	stub.insideCachedScope = false;
	expireMemo();
	assert.equal(await getCatalogVersion("regular"), "4");
	assert.equal(stub.entries.size, 0, "tag revalidated once a scope allows it");
	expireMemo();
	assert.equal(await getCatalogVersion("regular"), "4");
	assert.deepEqual([...stub.entries.values()], ["4"], "back on the tagged cache");
});
