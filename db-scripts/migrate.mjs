import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadLocalEnv } from "./lib/config.mjs";
import { matchesAppliedChecksum, migrationChecksum } from "./lib/migration-checksum.mjs";

const { Client } = pg;
const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, "..");
const migrationDirectory = path.join(directory, "migrations");
const lockKey = "7416203911027441";

async function main() {
	await loadLocalEnv(projectRoot);
	const connectionString = process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim();
	if (!connectionString)
		throw new Error(
			"DATABASE_URL or DATABASE_MIGRATION_URL is required in .env.local, .env, or the process environment",
		);
	const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
	await client.connect();
	try {
		await client.query("SELECT pg_advisory_lock($1::bigint)", [lockKey]);
		await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_name text PRIMARY KEY,
            applied_at bigint NOT NULL,
            checksum text NOT NULL
        )`);
		await client.query("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text");
		const applied = new Map(
			(await client.query("SELECT migration_name, checksum FROM schema_migrations")).rows.map((row) => [
				row.migration_name,
				row.checksum,
			]),
		);
		const files = (await fs.readdir(migrationDirectory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort();
		for (const filename of files) {
			const source = await fs.readFile(path.join(migrationDirectory, filename), "utf8");
			const checksum = migrationChecksum(source);
			if (applied.has(filename)) {
				if (applied.get(filename) === null) {
					await client.query("UPDATE schema_migrations SET checksum=$2 WHERE migration_name=$1 AND checksum IS NULL", [
						filename,
						checksum,
					]);
				} else if (!matchesAppliedChecksum(source, applied.get(filename)))
					throw new Error(`Applied migration ${filename} was modified; add a new migration instead`);
				continue;
			}
			await client.query("BEGIN");
			try {
				await client.query(source);
				await client.query("INSERT INTO schema_migrations(migration_name, applied_at, checksum) VALUES($1,$2,$3)", [
					filename,
					Date.now(),
					checksum,
				]);
				await client.query("COMMIT");
				console.log(`Applied ${filename}`);
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			}
		}
		console.log(`Database schema ready (${files.length} migration${files.length === 1 ? "" : "s"}).`);
	} finally {
		await client.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]).catch(() => {});
		await client.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.stack : String(error));
	process.exitCode = 1;
});
