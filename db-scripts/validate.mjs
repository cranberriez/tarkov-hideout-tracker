import path from "node:path";
import process from "node:process";
import {
    loadSnapshotManifest,
    validateSnapshotFiles,
} from "./lib/snapshot.mjs";

const releaseDirectory = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!releaseDirectory) {
    process.stderr.write("Usage: npm run db:validate -- <release-directory>\n");
    process.exitCode = 1;
} else {
    const manifest = await loadSnapshotManifest(releaseDirectory);
    await validateSnapshotFiles(releaseDirectory, manifest);
    process.stdout.write(
        `Valid snapshot ${manifest.releaseId}: ${manifest.modes.map((entry) => entry.mode).join(", ")}\n`,
    );
}

