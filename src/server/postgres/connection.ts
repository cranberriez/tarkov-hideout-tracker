import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { postgresSchema } from "./schema";
import { enableQueryLogging } from "./query-logging";

export const CATALOG_ADVISORY_LOCK_KEY = 7_416_203_911_027_441;
export type PostgresDatabase = NodePgDatabase<typeof postgresSchema>;

type PostgresGlobal = typeof globalThis & {
	__tarkovPostgresPool?: Pool;
	__tarkovPostgresDb?: PostgresDatabase;
};

function createPool(): Pool {
	const connectionString = process.env.DATABASE_URL?.trim();
	if (!connectionString) throw new Error("DATABASE_URL is required to connect to PostgreSQL");
	const max = Number(process.env.PG_POOL_MAX ?? "10");
	if (!Number.isInteger(max) || max < 1 || max > 50) throw new Error("PG_POOL_MAX must be an integer from 1 to 50");
	const statementTimeout = Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? "30000");
	if (!Number.isSafeInteger(statementTimeout) || statementTimeout < 1)
		throw new Error("PG_STATEMENT_TIMEOUT_MS must be a positive safe integer");
	const pool = new Pool({
		connectionString,
		max,
		idleTimeoutMillis: 30_000,
		connectionTimeoutMillis: 10_000,
		statement_timeout: statementTimeout,
	});
	// An idle client dropped by the server (Neon pooler, suspended function) emits `error` on the pool.
	// Unhandled, that event crashes the process and fails unrelated in-flight requests; pg already
	// discards the broken client, so log only the message (the error object includes connection details).
	pool.on("error", (error) => {
		console.error("[postgres] Idle client error:", error.message);
	});
	// On Vercel, keeps the instance alive long enough to close idle clients before suspension. No-op elsewhere.
	attachDatabasePool(pool);
	enableQueryLogging(pool);
	return pool;
}

export function getPostgresPool(): Pool {
	const global = globalThis as PostgresGlobal;
	return (global.__tarkovPostgresPool ??= createPool());
}

export function getPostgresDb(): PostgresDatabase {
	const global = globalThis as PostgresGlobal;
	return (global.__tarkovPostgresDb ??= drizzle(getPostgresPool(), { schema: postgresSchema }));
}

export async function closePostgresPool(): Promise<void> {
	const global = globalThis as PostgresGlobal;
	await global.__tarkovPostgresPool?.end();
	delete global.__tarkovPostgresPool;
	delete global.__tarkovPostgresDb;
}
