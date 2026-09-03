import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getTursoConfig, loadLocalEnv } from "./lib/config.mjs";
import { loadSnapshotManifest } from "./lib/snapshot.mjs";
import {
    activateRelease,
    applySchema,
    createTursoClient,
} from "./lib/turso.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const releaseDirectory = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!releaseDirectory) {
    throw new Error("Usage: npm run db:activate -- <release-directory>");
}

await loadLocalEnv(projectRoot);
const manifest = await loadSnapshotManifest(releaseDirectory);
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
        if (String(release.snapshot_sha256) !== modeEntry.sha256) {
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

