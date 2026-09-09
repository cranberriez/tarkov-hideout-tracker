import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { createRequire } from "node:module";
import path from "node:path";
import { createJiti } from "jiti";
const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { getEntitiesByIds } = await jiti.import<typeof import("./entity-data")>("./entity-data.ts");
import { insertCurrentTestRecord } from "./current-test-fixture";

test("bounded entity reads use indexed current records and isolate mode, type and revision", async () => {
	const db = createClient({ url: "file::memory:" });
	try {
		await db.executeMultiple(await readFile("db-scripts/schema.sql", "utf8"));
		for (const mode of ["regular", "pve"]) {
			await db.execute({
				sql: `INSERT INTO data_releases VALUES (?, 'current', 1, 1, 'hash', '{"items":123}', '{}', 'ready', 1)`,
				args: [mode],
			});
			await db.execute({ sql: "INSERT INTO active_data_releases VALUES (?, 'current', 1)", args: [mode] });
			await insertCurrentTestRecord(db, mode, "entity", "same", "price", { mode });
			await insertCurrentTestRecord(db, mode, "entity", "same", "item", { wrongType: true });
			await insertCurrentTestRecord(db, mode, "entity", "other", "price", { wrongId: true });
		}
		const captured: InStatement[] = [];
		const instrumented = new Proxy(db, {
			get(target, key) {
				if (key === "execute")
					return (statement: InStatement) => {
						captured.push(statement);
						return target.execute(statement);
					};
				return Reflect.get(target, key);
			},
		}) as Client;
		const result = await getEntitiesByIds("regular", "price", "items", ["same", "missing"], instrumented, "current");
		assert.deepEqual(result, { data: { same: { mode: "regular" } }, updatedAt: 123 });
		const statement = captured[0];
		assert.equal(typeof statement, "object");
		if (typeof statement === "string") throw new Error("Expected parameterized entity query");
		const plan = await db.execute({ ...statement, sql: "EXPLAIN QUERY PLAN " + statement.sql });
		const details = plan.rows.map((row) => String(row.detail));
		assert.ok(
			details.some((detail) => /SEARCH entity USING INDEX/.test(detail)),
			details.join("\n"),
		);
		assert.ok(
			details.some((detail) => /SEARCH entity .*record_id=\?/.test(detail)),
			details.join("\n"),
		);
		assert.ok(
			details.every((detail) => !/MATERIALIZE|SCAN entity|SCAN current_records/.test(detail)),
			details.join("\n"),
		);
		await assert.rejects(
			getEntitiesByIds("regular", "price", "items", ["same"], db, "obsolete"),
			/No ready data release/,
		);
		assert.deepEqual((await getEntitiesByIds("regular", "price", "items", [], db, "current")).data, {});
	} finally {
		db.close();
	}
});
