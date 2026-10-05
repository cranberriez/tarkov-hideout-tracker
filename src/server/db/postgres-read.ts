import "server-only";

import { eq } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import { catalogStatus } from "@/server/postgres/schema";
import { getPostgresDb, type PostgresDatabase } from "@/server/postgres/connection";
import { DatabaseConfigurationError, DatabaseTransientReadError } from "./errors";
import { boundedReadCache, evictMemoizedReads, memoizedRead } from "./read-cache";

/** Invalidated by the catalog cron after a committed update, or when a read observes a newer version. */
export const CATALOG_VERSION_TAG = "postgres-catalog-version";
// The catalog only changes through the nightly cron, which invalidates the tag. The TTLs are safety nets.
const VERSION_MEMO_MS = 60_000;
const VERSION_REVALIDATE_SECONDS = 7 * 24 * 60 * 60;

export function getDatabase(db?: PostgresDatabase): PostgresDatabase {
	return db ?? getPostgresDb();
}

async function readCatalogVersion(mode: TarkovDataMode, db: PostgresDatabase): Promise<string> {
	const row = await db
		.select({ contentVersion: catalogStatus.contentVersion })
		.from(catalogStatus)
		.where(eq(catalogStatus.mode, mode))
		.limit(1)
		.then((rows) => rows[0]);
	if (!row || !Number.isSafeInteger(row.contentVersion) || row.contentVersion <= 0) {
		throw new DatabaseConfigurationError(`No initialized PostgreSQL catalog exists for ${mode}. Run db:update.`);
	}
	return String(row.contentVersion);
}

/**
 * Modes ("*" for all) whose tagged version entry is known to be stale but could not be invalidated
 * where the mismatch was observed. Version reads for them bypass the data cache until revalidation succeeds.
 */
function staleCatalogVersions(): Set<TarkovDataMode | "*"> {
	const g = globalThis as typeof globalThis & { __tarkovStaleCatalogVersions?: Set<TarkovDataMode | "*"> };
	return (g.__tarkovStaleCatalogVersions ??= new Set());
}

async function revalidateCatalogVersionTag(): Promise<boolean> {
	try {
		const { revalidateTag } = await import("next/cache");
		revalidateTag(CATALOG_VERSION_TAG, { expire: 0 });
		return true;
	} catch {
		// Next rejects revalidation during render, inside cached functions (closing checks run inside the
		// cached builds that call them), and outside a request scope.
		return false;
	}
}

/**
 * The current catalog version. Without an explicit database this is served from a per-instance memo
 * backed by the tagged data cache, so steady-state requests do not query PostgreSQL for it.
 */
export async function getCatalogVersion(mode: TarkovDataMode, db?: PostgresDatabase): Promise<string> {
	if (db) return readCatalogVersion(mode, db);
	return memoizedRead(`catalog-version:${mode}`, VERSION_MEMO_MS, async () => {
		const stale = staleCatalogVersions();
		if (stale.has(mode) || stale.has("*")) {
			// The tag covers every mode, so one successful revalidation repairs all of them.
			if (await revalidateCatalogVersionTag()) stale.clear();
			return readCatalogVersion(mode, getPostgresDb());
		}
		return boundedReadCache(
			["catalog-version", mode],
			() => readCatalogVersion(mode, getPostgresDb()),
			VERSION_REVALIDATE_SECONDS,
			{
				tags: [CATALOG_VERSION_TAG],
			},
		);
	});
}

/** Drop cached version identities so the next read observes the committed catalog. */
export async function invalidateCatalogVersion(mode?: TarkovDataMode): Promise<void> {
	evictMemoizedReads((key) => (mode ? key === `catalog-version:${mode}` : key.startsWith("catalog-version:")));
	if (!(await revalidateCatalogVersionTag())) staleCatalogVersions().add(mode ?? "*");
}

/** Assert that a composed read still belongs to the catalog version selected by its caller. */
export async function assertCatalogVersion(
	mode: TarkovDataMode,
	expectedVersion: string,
	db?: PostgresDatabase,
): Promise<void> {
	if ((await readCatalogVersion(mode, getDatabase(db))) !== expectedVersion) {
		await invalidateCatalogVersion(mode);
		throw new DatabaseTransientReadError("The current data changed while loading. Retry the request.");
	}
}

/**
 * Catalog updates bump content_version in the same transaction as their row writes, and versions only
 * increase. A read that finishes while the version still equals the one it started from is therefore
 * consistent, so a caller-supplied version needs only the closing check.
 */
export async function withStableCatalogRead<T>(
	mode: TarkovDataMode,
	read: (db: PostgresDatabase, contentVersion: string) => Promise<T>,
	database?: PostgresDatabase,
	expectedVersion?: string,
): Promise<{ data: T; contentVersion: string }> {
	const db = getDatabase(database);
	const before = expectedVersion ?? (await readCatalogVersion(mode, db));
	const data = await read(db, before);
	await assertCatalogVersion(mode, before, db);
	return { data, contentVersion: before };
}
