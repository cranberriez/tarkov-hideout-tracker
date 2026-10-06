import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { loadLocalEnv } from "./lib/config.mjs";

await loadLocalEnv(fileURLToPath(new URL("../", import.meta.url)));
if (process.argv.slice(2).some((arg) => arg !== "--storage"))
	throw new Error("Usage: npm run db:status -- [--storage]");
const jiti = createJiti(import.meta.url);
const { getPostgresPool, closePostgresPool } = await jiti.import("../src/server/postgres/connection.ts");
try {
	const pool = getPostgresPool();
	const { rows } = await pool.query(`SELECT c.*,
  (SELECT count(*)::int FROM item_modes i WHERE i.mode=c.mode) AS items,
  (SELECT count(*)::int FROM item_details d WHERE d.mode=c.mode) AS item_details,
  (SELECT count(*)::int FROM item_prices p WHERE p.mode=c.mode AND p.catalog_reference_updated_at IS NOT NULL) AS priced_items,
  p.last_started_at, p.last_completed_at, p.last_summary, p.lease_owner, p.lease_expires_at
  FROM catalog_status c LEFT JOIN price_refresh_state p USING(mode) ORDER BY c.mode`);
	console.log(
		JSON.stringify(
			{
				modes: rows,
				...(process.argv.includes("--storage")
					? {
							storage: (
								await pool.query(`SELECT relname, pg_total_relation_size(relid)::text AS bytes
   FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC`)
							).rows,
						}
					: {}),
			},
			null,
			2,
		),
	);
} finally {
	await closePostgresPool();
}
