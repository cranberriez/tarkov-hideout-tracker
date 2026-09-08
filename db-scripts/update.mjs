import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTursoConfig, loadLocalEnv, parseModes } from "./lib/config.mjs";
import { createReleaseId, assertSafeReleaseId, loadSnapshotManifest, validateSnapshotFiles } from "./lib/snapshot.mjs";
import { CURRENT_GAME_PATCH, assertGamePatch } from "./lib/catalog-history.mjs";
import { createTursoClient } from "./lib/turso.mjs";
import { compareSnapshot } from "./lib/release-diff.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function run(script, args) {
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [path.join(directory, script), ...args], {
			cwd: root,
			stdio: "inherit",
			windowsHide: true,
		});
		child.on("error", reject);
		child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} failed (${code})`))));
	});
}

async function main() {
	let modes = parseModes(),
		releaseId = createReleaseId(),
		patch = CURRENT_GAME_PATCH;
	const args = process.argv.slice(2);
	for (let index = 0; index < args.length; index++) {
		if (args[index] === "--modes") modes = parseModes(args[++index]);
		else if (args[index] === "--release") releaseId = assertSafeReleaseId(args[++index]);
		else if (args[index] === "--patch") patch = assertGamePatch(args[++index]);
		else throw new Error(`Unknown argument: ${args[index]}`);
	}
	await loadLocalEnv(root);
	await run("init-catalog.mjs", ["--modes", modes.join(",")]);
	await run("generate.mjs", ["--modes", modes.join(","), "--release", releaseId, "--preserve-prices"]);
	const releaseDirectory = path.join(directory, ".generated", releaseId);
	const manifest = await loadSnapshotManifest(releaseDirectory);
	await validateSnapshotFiles(releaseDirectory, manifest);
	const client = createTursoClient(getTursoConfig());
	try {
		const report = await compareSnapshot(client, releaseDirectory, manifest);
		await fs.writeFile(path.join(releaseDirectory, "changes.json"), `${JSON.stringify(report, null, 2)}\n`);
		for (const mode of report.modes) {
			console.log(`${mode.mode}: ${mode.newItems.length} never-seen items`);
			for (const [domain, changes] of Object.entries(mode.changes)) {
				console.log(`  ${domain}: +${changes.added.length} added, ~${changes.changed.length} changed, -${changes.removed.length} removed`);
			}
		}
	} finally {
		client.close();
	}
	await run("upload.mjs", ["--release-dir", releaseDirectory, "--patch", patch, "--activate"]);
	console.log(`Full data update complete. Prices preserved. Change report: ${path.join(releaseDirectory, "changes.json")}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
