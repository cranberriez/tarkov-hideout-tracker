import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";

/** Never uses DATABASE_URL: every fixture owns a unique disposable schema. */
export async function postgresFixture() {
	const connectionString = process.env.TEST_DATABASE_URL;
	if (!connectionString) throw new Error("TEST_DATABASE_URL must name a disposable PostgreSQL database");
	const schema = `test_${randomUUID().replaceAll("-", "")}`;
	const admin = new Pool({ connectionString, max: 1 });
	await admin.query(`CREATE SCHEMA "${schema}"`);
	const pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 5 });
	try {
		const directory = new URL("../migrations/", import.meta.url);
		for (const name of (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort()) {
			await pool.query(await readFile(new URL(name, directory), "utf8"));
		}
	} catch (error) {
		await pool.end();
		await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
		await admin.end();
		throw error;
	}
	return {
		pool,
		schema,
		async close() {
			await pool.end();
			await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
			await admin.end();
		},
	};
}
