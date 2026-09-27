import "server-only";

import { eq } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import { catalogStatus } from "@/server/postgres/schema";
import { getPostgresDb, type PostgresDatabase } from "@/server/postgres/connection";
import { DatabaseConfigurationError, DatabaseTransientReadError } from "./errors";

export function getDatabase(db?: PostgresDatabase): PostgresDatabase {
	return db ?? getPostgresDb();
}

export async function getCatalogVersion(mode: TarkovDataMode, db?: PostgresDatabase): Promise<string> {
	const row = await getDatabase(db)
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

/** Assert that a composed read still belongs to the catalog version selected by its caller. */
export async function assertCatalogVersion(
	mode: TarkovDataMode,
	expectedVersion: string,
	db?: PostgresDatabase,
): Promise<void> {
	if ((await getCatalogVersion(mode, db)) !== expectedVersion) {
		throw new DatabaseTransientReadError("The current data changed while loading. Retry the request.");
	}
}

export async function withStableCatalogRead<T>(
	mode: TarkovDataMode,
	read: (db: PostgresDatabase, contentVersion: string) => Promise<T>,
	database?: PostgresDatabase,
	expectedVersion?: string,
): Promise<{ data: T; contentVersion: string }> {
	const db = getDatabase(database);
	const before = expectedVersion ?? (await getCatalogVersion(mode, db));
	await assertCatalogVersion(mode, before, db);
	const data = await read(db, before);
	await assertCatalogVersion(mode, before, db);
	return { data, contentVersion: before };
}
