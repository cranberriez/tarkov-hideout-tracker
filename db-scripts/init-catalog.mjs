import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTursoConfig, loadLocalEnv, parseModes } from "./lib/config.mjs";
import { applySchema, createTursoClient } from "./lib/turso.mjs";
import { BASELINE_RELEASE_ID, initializeCatalogHistory } from "./lib/catalog-history.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--modes")) {
	throw new Error("Usage: npm run db:catalog:init -- [--modes regular,pve,pvp-season]");
}
const modes = parseModes(args[1]);
await loadLocalEnv(path.resolve(directory, ".."));
const client = createTursoClient(getTursoConfig());
try {
	await applySchema(client, path.join(directory, "schema.sql"));
	await initializeCatalogHistory(client, modes);
	// Preserve existing operational choices; only fill previously missing pointers.
	await client.batch(
		modes.map((mode) => ({
			sql: `INSERT INTO active_data_releases (mode, release_id, activated_at)
              SELECT mode, release_id, ? FROM data_releases
              WHERE mode = ? AND release_id = ? AND status = 'ready'
              ON CONFLICT (mode) DO NOTHING`,
			args: [Date.now(), mode, BASELINE_RELEASE_ID],
		})),
		"write",
	);
	console.log("Catalog baseline initialized; existing history and active releases preserved.");
} finally {
	client.close();
}
