import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDiscoveryExport, DISCOVERY_MODES } from "./discovery.mjs";
import { loadDiscoveryInput } from "./discovery-input.mjs";

test("optional discovery file distinguishes absent, valid, malformed and explicitly missing input", async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), "tarkov-discovery-input-"));
	try {
		assert.equal(await loadDiscoveryInput(directory), undefined);
		await assert.rejects(loadDiscoveryInput(directory, "missing.json"), /Cannot read discovery import/);
		const document = createDiscoveryExport(
			DISCOVERY_MODES.map((mode) => ({
				item_id: "existing",
				mode,
				first_seen_at: null,
				first_seen_patch: "pre-1.1.5",
				first_seen_release_id: "baseline",
			})),
			DISCOVERY_MODES.map((mode) => ({ mode, baseline_release_id: "baseline", initialized_at: 1000 })),
		);
		const source = path.join(directory, "discovery.json");
		await writeFile(source, JSON.stringify(document));
		assert.deepEqual(await loadDiscoveryInput(directory), document);
		await writeFile(path.join(directory, "custom.json"), JSON.stringify(document));
		assert.deepEqual(await loadDiscoveryInput(directory, "custom.json"), document);
		await writeFile(source, "{");
		await assert.rejects(loadDiscoveryInput(directory), /Invalid discovery import/);
		await writeFile(source, JSON.stringify({ ...document, sha256: "tampered" }));
		await assert.rejects(loadDiscoveryInput(directory), /checksum/);
		await rm(source);
		await mkdir(source);
		await assert.rejects(loadDiscoveryInput(directory), /Cannot read discovery import/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
