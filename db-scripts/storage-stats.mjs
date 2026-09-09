import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv, getTursoConfig } from "./lib/config.mjs";
import { createTursoClient } from "./lib/turso.mjs";

await loadLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const client = createTursoClient(getTursoConfig());
try {
	const current =
		(await client.execute("SELECT name FROM sqlite_master WHERE type='view' AND name='data_entities'")).rows.length > 0;
	const result = { storage: current ? "current" : "legacy", tables: {} };
	for (const [table, payload] of current
		? [
				["current_records", null],
				["data_payloads", "payload_json"],
			]
		: [
				["data_entities", "payload_json"],
				["item_views", "payload_json"],
				["item_search", "preview_json"],
				["data_manifests", "payload_json"],
			]) {
		result.tables[table] = (
			await client.execute(
				`SELECT COUNT(*) AS rows${payload ? `,SUM(length(CAST(${payload} AS BLOB))) AS json_bytes` : ""} FROM ${table}`,
			)
		).rows[0];
	}
	result.revisions = (await client.execute("SELECT mode,COUNT(*) AS revisions FROM data_releases GROUP BY mode")).rows;
	result.prices = (await client.execute("SELECT mode,COUNT(*) AS items FROM item_prices GROUP BY mode")).rows;
	result.pricePoints = (
		await client.execute("SELECT mode,COUNT(*) AS points FROM item_price_points GROUP BY mode")
	).rows;
	result.catalogHistory = (
		await client.execute("SELECT mode,COUNT(*) AS items FROM item_catalog_history GROUP BY mode")
	).rows;
	const pageCount = Number((await client.execute("PRAGMA page_count")).rows[0].page_count);
	const pageSize = Number((await client.execute("PRAGMA page_size")).rows[0].page_size);
	const freePages = Number((await client.execute("PRAGMA freelist_count")).rows[0].freelist_count);
	const tableIndexBytes = Number((await client.execute("SELECT SUM(pgsize) AS bytes FROM dbstat")).rows[0].bytes);
	result.pages = { tableIndexBytes, allocatedBytes: pageCount * pageSize, reusableBytes: freePages * pageSize };
	console.log(JSON.stringify(result, null, 2));
} finally {
	client.close();
}
