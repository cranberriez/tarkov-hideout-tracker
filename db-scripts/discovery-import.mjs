import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { loadLocalEnv } from "./lib/config.mjs";
import { importDiscovery } from "./lib/discovery.mjs";
import { reportDiscoveryConflict } from "./lib/discovery-diagnostics.mjs";

const [source, ...extra] = process.argv.slice(2);
if (!source || extra.length) throw new Error("Usage: node db-scripts/discovery-import.mjs <discovery.json>");
await loadLocalEnv(fileURLToPath(new URL("../", import.meta.url)));
const jiti = createJiti(import.meta.url);
const { getPostgresPool, closePostgresPool } = await jiti.import("../src/server/postgres/connection.ts");
try {
	console.log(
		JSON.stringify(await importDiscovery(getPostgresPool(), JSON.parse(await readFile(source, "utf8"))), null, 2),
	);
} catch (error) {
	if (!(await reportDiscoveryConflict(error, fileURLToPath(new URL("../", import.meta.url)))))
		console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
} finally {
	await closePostgresPool();
}
