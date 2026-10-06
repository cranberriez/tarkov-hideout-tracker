import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateDiscoveryExport } from "./discovery.mjs";

/** Missing default input is optional; explicitly requested or invalid input is not. */
export async function loadDiscoveryInput(projectRoot, requestedPath) {
	const source = path.resolve(projectRoot, requestedPath ?? "discovery.json");
	let contents;
	try {
		contents = await readFile(source, "utf8");
	} catch (error) {
		if (error.code === "ENOENT" && requestedPath === undefined) return undefined;
		throw new Error(`Cannot read discovery import ${source}: ${error.message}`, { cause: error });
	}
	try {
		return validateDiscoveryExport(JSON.parse(contents));
	} catch (error) {
		throw new Error(`Invalid discovery import ${source}: ${error.message}`, { cause: error });
	}
}
