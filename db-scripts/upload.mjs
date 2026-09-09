import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getTursoConfig, loadLocalEnv } from "./lib/config.mjs";
import { loadSnapshotManifest, validateSnapshotFiles } from "./lib/snapshot.mjs";
import { applySchema, createTursoClient } from "./lib/turso.mjs";
import { CURRENT_GAME_PATCH, assertGamePatch } from "./lib/catalog-history.mjs";
import { publishSnapshot } from "./lib/current-storage.mjs";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
function parseArguments(argv) {
	const options = {
		releaseDirectory: null,
		patch: CURRENT_GAME_PATCH,
		batchSize: 100,
		batchBytes: 1_000_000,
		dryRun: false,
	};
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === "--release-dir") options.releaseDirectory = path.resolve(argv[++index]);
		else if (argument === "--patch") options.patch = assertGamePatch(argv[++index]);
		else if (argument === "--activate") {
			/* Publication is always immediate. */
		} else if (argument === "--dry-run") options.dryRun = true;
		else if (argument === "--batch-size") options.batchSize = Number(argv[++index]);
		else if (argument === "--batch-bytes") options.batchBytes = Number(argv[++index]);
		else throw new Error(`Unknown argument: ${argument}`);
	}
	if (!options.releaseDirectory) throw new Error("--release-dir must point to a generated snapshot directory");
	if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500)
		throw new Error("--batch-size must be an integer between 1 and 500");
	if (!Number.isInteger(options.batchBytes) || options.batchBytes < 100_000)
		throw new Error("--batch-bytes must be an integer of at least 100000");
	return options;
}
export async function uploadSnapshot(client, releaseDirectory, manifest, options = {}) {
	await validateSnapshotFiles(releaseDirectory, manifest);
	const legacy = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='data_entities'");
	if (legacy.rows.length) throw new Error("Legacy snapshots detected; run db:compact before publishing.");
	if (!options.dryRun) await applySchema(client, path.join(scriptDirectory, "schema.sql"));
	let publicationClient = client;
	let temporaryClient;
	try {
		if (options.dryRun) {
			const tables = await client.execute(
				"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('data_releases','active_data_releases','current_records')",
			);
			if (!tables.rows.length) {
				temporaryClient = createTursoClient({ url: "file::memory:" });
				await applySchema(temporaryClient, path.join(scriptDirectory, "schema.sql"));
				publicationClient = temporaryClient;
			}
		}
		return await publishSnapshot(publicationClient, releaseDirectory, manifest, options);
	} finally {
		temporaryClient?.close();
	}
}
async function main() {
	await loadLocalEnv(path.resolve(scriptDirectory, ".."));
	const options = parseArguments(process.argv.slice(2));
	const manifest = await loadSnapshotManifest(options.releaseDirectory);
	const client = createTursoClient(getTursoConfig());
	try {
		process.stdout.write(
			JSON.stringify(await uploadSnapshot(client, options.releaseDirectory, manifest, options), null, 2) + "\n",
		);
	} finally {
		client.close();
	}
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
	main().catch((error) => {
		process.stderr.write(String(error.stack ?? error) + "\n");
		process.exitCode = 1;
	});
