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
 * The current catalog version. Without an explicit database this is served from a per-instance memo
 * backed by the tagged data cache, so steady-state requests do not query PostgreSQL for it.
 */
export async function getCatalogVersion(mode: TarkovDataMode, db?: PostgresDatabase): Promise<string> {
	if (db) return readCatalogVersion(mode, db);
	return memoizedRead(`catalog-version:${mode}`, VERSION_MEMO_MS, () =>
		boundedReadCache(
			["catalog-version", mode],
			() => readCatalogVersion(mode, getPostgresDb()),
			VERSION_REVALIDATE_SECONDS,
			{
				tags: [CATALOG_VERSION_TAG],
			},
		),
	);
}

/** Drop cached version identities so the next read observes the committed catalog. */
export async function invalidateCatalogVersion(mode?: TarkovDataMode): Promise<void> {
	evictMemoizedReads((key) => (mode ? key === `catalog-version:${mode}` : key.startsWith("catalog-version:")));
	try {
		const { revalidateTag } = await import("next/cache");
		revalidateTag(CATALOG_VERSION_TAG, { expire: 0 });
	} catch {
		// Outside a request scope (tests, scripts, render) only the local memo can be cleared.
	}
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
