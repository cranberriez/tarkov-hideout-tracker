import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildDiscoveryReconciliation, createDiscoveryExport, DISCOVERY_MODES } from "./discovery.mjs";
import { reportDiscoveryConflict } from "./discovery-diagnostics.mjs";

test("conflict CLI reporting keeps all facts in a file and bounds console output", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "discovery-report-"));
	try {
		const rows = Array.from({ length: 60 }, (_, index) => ({
			item_id: `item-${index}`,
			mode: DISCOVERY_MODES[index % 3],
			first_seen_at: 100,
			first_seen_patch: "1.1.5.0",
			first_seen_release_id: "old",
		}));
		const tracking = DISCOVERY_MODES.map((mode) => ({ mode, baseline_release_id: "baseline", initialized_at: 10 }));
		let failure;
		try {
			buildDiscoveryReconciliation(
				rows,
				createDiscoveryExport(
					rows.map((row) => ({ ...row, first_seen_at: 200 })),
					tracking,
				),
			);
		} catch (error) {
			failure = error;
		}
		assert.ok(failure);
		const messages = [];
		assert.equal(await reportDiscoveryConflict(failure, root, (message) => messages.push(message)), true);
		assert.equal(messages.length, 2);
		assert.ok(messages.join("\n").length < 1500);
		const directory = path.join(root, "db-scripts", ".generated", "diagnostics");
		const files = await readdir(directory);
		assert.equal(files.length, 1);
		const report = JSON.parse(await readFile(path.join(directory, files[0]), "utf8"));
		assert.equal(report.conflicts.length, 60);
		assert.deepEqual(report.counts, { regular: 20, pve: 20, "pvp-season": 20 });
		assert.equal(report.conflicts[0].prior.first_seen_at, 100);
		assert.equal(report.conflicts[0].incoming.first_seen_at, 200);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
