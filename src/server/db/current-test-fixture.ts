import { createHash } from "node:crypto";
import type { Client } from "@libsql/client";

export async function insertCurrentTestRecord(
	db: Client,
	mode: string,
	type: string,
	id: string,
	variant: string,
	payload: unknown,
) {
	const json = JSON.stringify(payload);
	const hash = createHash("sha256").update(json).digest("hex");
	await db.execute({ sql: "INSERT OR IGNORE INTO data_payloads VALUES (?, ?)", args: [hash, json] });
	await db.execute({
		sql: `INSERT OR REPLACE INTO current_records (mode, record_type, record_id, variant, payload_hash, content_hash, sort_key, normalized_name, compact_name, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'test', 'test-item', 'testitem', 1)`,
		args: [mode, type, id, variant, hash, hash],
	});
}
