import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDiscoveryExport } from "./lib/discovery.mjs";
import { loadLocalEnv } from "./lib/config.mjs";
import { readTursoDiscovery } from "./lib/turso-discovery.mjs";

async function readLocalDiscovery(source) {
	const { DatabaseSync } = await import("node:sqlite");
	const db = new DatabaseSync(source, { readOnly: true });
	try {
		db.exec("BEGIN");
		const rows = db
			.prepare("SELECT item_id, mode, first_seen_at, first_seen_patch, first_seen_release_id FROM item_catalog_history")
			.all();
		const tracking = db.prepare("SELECT mode, baseline_release_id, initialized_at FROM catalog_tracking").all();
		const document = createDiscoveryExport(rows, tracking);
		db.exec("COMMIT");
		return document;
	} catch (error) {
		if (error.errcode === 11 || error.errcode === 26) {
			throw new Error(
				"SQLite cannot read this database file. Both .db and .sqlite extensions are supported; renaming will not fix it. Use db:discovery:export -- --turso discovery.json to read discovery directly from Turso instead.",
			);
		}
		throw error;
	} finally {
		db.close();
	}
}

async function main() {
	const [source, destination, ...extra] = process.argv.slice(2);
	if (!source || !destination || extra.length || (source.startsWith("--") && source !== "--turso"))
		throw new Error("Usage: npm run db:discovery:export -- <source.db|--turso> <discovery.json>");
	let document;
	if (source === "--turso") {
		await loadLocalEnv(fileURLToPath(new URL("../", import.meta.url)));
		const { rows, tracking } = await readTursoDiscovery({
			url: process.env.TURSO_DATABASE_URL,
			authToken: process.env.TURSO_AUTH_TOKEN,
		});
		document = createDiscoveryExport(rows, tracking);
	} else document = await readLocalDiscovery(source);
	await writeFile(destination, `${JSON.stringify(document, null, 2)}\n`, { flag: "wx" });
	console.log(JSON.stringify({ sha256: document.sha256, coverage: document.coverage }));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : "Discovery export failed");
	process.exitCode = 1;
});
