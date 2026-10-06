import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Reports contain discovery facts only, never connection configuration or credentials. */
export async function reportDiscoveryConflict(error, projectRoot, log = console.error) {
	if (!error?.diagnostic) return false;
	log(error.message);
	const directory = path.join(projectRoot, "db-scripts", ".generated", "diagnostics");
	const destination = path.join(directory, `discovery-conflicts-${Date.now()}-${randomUUID()}.json`);
	try {
		await mkdir(directory, { recursive: true });
		await writeFile(destination, `${JSON.stringify(error.diagnostic, null, 2)}\n`, { flag: "wx" });
		log(`Full discovery diagnostic: ${destination}`);
	} catch {
		log(
			"Could not write the full discovery diagnostic; check permissions/free space in db-scripts/.generated/diagnostics and retry. No records were imported.",
		);
	}
	return true;
}
