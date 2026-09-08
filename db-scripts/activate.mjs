import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getTursoConfig, loadLocalEnv, parseModes } from "./lib/config.mjs";
import { assertSafeReleaseId, loadSnapshotManifest } from "./lib/snapshot.mjs";
import { activateRelease, applySchema, createTursoClient } from "./lib/turso.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const args = process.argv.slice(2);
let manifest;
if (args[0] === "--release") {
	if (args.length !== 2 && !(args.length === 4 && args[2] === "--modes")) {
		throw new Error("Usage: db:activate -- --release <id> [--modes regular,pve,pvp-season]");
	}
	manifest = { releaseId: assertSafeReleaseId(args[1]), modes: parseModes(args[3]).map((mode) => ({ mode })) };
} else {
	if (args.length !== 1) throw new Error("Usage: db:activate -- <release-directory> OR --release <id> [--modes ...]");
	manifest = await loadSnapshotManifest(path.resolve(args[0]));
}
await loadLocalEnv(projectRoot);
const client = createTursoClient(getTursoConfig());
try {
	await applySchema(client, path.join(scriptDirectory, "schema.sql"));
	for (const modeEntry of manifest.modes) {
		const result = await client.execute({
			sql: `
                SELECT status, snapshot_sha256
                FROM data_releases
                WHERE mode = ? AND release_id = ?
            `,
			args: [modeEntry.mode, manifest.releaseId],
		});
		const release = result.rows[0];
		if (!release || release.status !== "ready") {
			throw new Error(`${modeEntry.mode}/${manifest.releaseId} is not ready`);
		}
		if (modeEntry.sha256 && String(release.snapshot_sha256) !== modeEntry.sha256) {
			throw new Error(`${modeEntry.mode}/${manifest.releaseId} checksum does not match`);
		}
	}
	await activateRelease(
		client,
		manifest.releaseId,
		manifest.modes.map((entry) => entry.mode),
	);
	process.stdout.write(`Activated release ${manifest.releaseId}.\n`);
} finally {
	client.close();
}
