import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { loadLocalEnv } from "./lib/config.mjs";
import { applyCatalogUpdate, MODES, readCatalogBaseline } from "./lib/postgres-catalog.mjs";
import { prepareCatalog, prepareDetails } from "../src/server/catalog/preparation.mjs";
import { stripCatalogDto } from "./lib/catalog-dto.mjs";
import { loadDiscoveryInput } from "./lib/discovery-input.mjs";
import { planDiscoveryReconciliation } from "./lib/discovery.mjs";
import { reportDiscoveryConflict } from "./lib/discovery-diagnostics.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

function parseArgs(argv) {
	let dryRun = false;
	let fixturePath;
	let exportFixturePath;
	let discoveryPath;
	for (let index = 0; index < argv.length; index++) {
		if (argv[index] === "--dry-run") dryRun = true;
		else if (argv[index] === "--fixture") fixturePath = argv[++index];
		else if (argv[index] === "--export-fixture") exportFixturePath = argv[++index];
		else if (argv[index] === "--discovery") discoveryPath = argv[++index];
		else if (argv[index] === "--modes") {
			const modes = (argv[++index] ?? "")
				.split(",")
				.map((mode) => mode.trim())
				.filter(Boolean);
			if (modes.length !== MODES.length || MODES.some((mode) => !modes.includes(mode))) {
				throw new Error("Catalog updates require all modes: regular,pve,pvp-season");
			}
		} else throw new Error(`Unknown argument: ${argv[index]}`);
	}
	if (fixturePath && exportFixturePath) throw new Error("--fixture and --export-fixture cannot be used together");
	if (exportFixturePath && !dryRun)
		throw new Error("--export-fixture requires --dry-run so exporting can never publish data");
	if (
		argv.some(
			(argument, index) =>
				["--fixture", "--export-fixture", "--discovery"].includes(argument) &&
				(!argv[index + 1] || argv[index + 1].startsWith("--")),
		)
	) {
		throw new Error("--fixture, --export-fixture and --discovery each require a file path");
	}
	return { dryRun, fixturePath, exportFixturePath, discoveryPath };
}

async function loadServices() {
	const jiti = createJiti(pathToFileURL(import.meta.url).href, { alias: { "@": path.join(projectRoot, "src") } });
	return jiti.import(path.join(projectRoot, "src/server/catalog/services.ts"));
}

async function main() {
	await loadLocalEnv(projectRoot);
	const { dryRun, fixturePath, exportFixturePath, discoveryPath } = parseArgs(process.argv.slice(2));
	const discoveryDocument = await loadDiscoveryInput(projectRoot, discoveryPath);
	console.log(
		discoveryDocument
			? `Verified discovery import (${discoveryDocument.rows.length} records); ${dryRun ? "preview only" : "will reconcile with this catalog update"}.`
			: "No discovery.json found; existing discovery is preserved and uninitialized modes will use an unknown-date baseline.",
	);
	const connectionString = process.env.DATABASE_URL?.trim();
	if (!connectionString) throw new Error("DATABASE_URL is required in .env.local, .env, or the process environment");
	const jiti = createJiti(pathToFileURL(import.meta.url).href, { alias: { "@": path.join(projectRoot, "src") } });
	const connection = await jiti.import(path.join(projectRoot, "src/server/postgres/connection.ts"));
	const pool = connection.getPostgresPool();
	try {
		const baseline = await readCatalogBaseline(pool);
		if (discoveryDocument) {
			const plan = await planDiscoveryReconciliation(pool, discoveryDocument);
			console.log(
				`Discovery preflight: ${plan.additions.length} additions, ${plan.enrichments.length} unknown records to enrich, ${plan.preserved} known records preserved. Rechecked under the catalog lock before writing.`,
			);
		}
		const modesData = {};
		if (fixturePath) {
			const source = path.resolve(projectRoot, fixturePath);
			const fixture = JSON.parse(await fs.readFile(source, "utf8"));
			if (fixture.schemaVersion !== 1 || !fixture.modes) throw new Error("Unsupported or malformed catalog fixture");
			for (const mode of MODES) {
				if (!fixture.modes[mode]) throw new Error(`Catalog fixture is missing ${mode}`);
				modesData[mode] = fixture.modes[mode];
			}
			const incompleteDetails = MODES.some((mode) => {
				const details = modesData[mode].itemDetails;
				return (
					!Array.isArray(details) ||
					details.length !== modesData[mode].items?.length ||
					details.some(
						(detail) =>
							![detail?.relations, detail?.usage, detail?.acquisition].every(
								(payload) => payload?.freshness && typeof payload.freshness === "object",
							),
					)
				);
			});
			if (incompleteDetails) {
				console.log(
					"Debug fixture lacks detail freshness contracts; rebuilding its item projections from the fixture data…",
				);
				const services = await loadServices();
				for (const mode of MODES) await prepareDetails(mode, modesData[mode], services);
			} else {
				for (const mode of MODES)
					modesData[mode].itemDetails = modesData[mode].itemDetails.map((detail) => ({
						...detail,
						relations: stripCatalogDto(detail.relations),
						usage: stripCatalogDto(detail.usage),
						acquisition: stripCatalogDto(detail.acquisition),
					}));
			}
			console.log(`Loaded normalized debug fixture ${source}`);
		} else {
			Object.assign(modesData, await prepareCatalog(await loadServices()));
		}
		if (exportFixturePath) {
			const destination = path.resolve(projectRoot, exportFixturePath);
			await fs.mkdir(path.dirname(destination), { recursive: true });
			await fs.writeFile(
				destination,
				`${JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), modes: modesData })}\n`,
				"utf8",
			);
			console.log(`Wrote debug fixture ${destination}`);
		}
		const result = await applyCatalogUpdate(pool, modesData, Date.now(), {
			dryRun,
			baseline,
			discoveryDocument,
		});
		console.log(
			`${dryRun ? "Dry run validated" : "Catalog update committed"}. ${result.changed ? "Content changed." : "No catalog content changes."}`,
		);
		console.log(JSON.stringify(result.counts, null, 2));
		if (result.newItems)
			for (const mode of MODES) {
				const names = new Map(modesData[mode].items.map((item) => [item.id, item.name]));
				console.log(`${mode}: ${result.newItems[mode].length} first-seen items`);
				for (const id of result.newItems[mode]) console.log(`  ${names.get(id) ?? id} (${id})`);
			}
	} finally {
		await connection.closePostgresPool();
	}
}

main().catch(async (error) => {
	if (await reportDiscoveryConflict(error, projectRoot)) {
		// The bounded summary and complete report replace an unbounded exception dump.
	} else if (error?.code === "42P01") {
		console.error(
			"PostgreSQL schema is missing. Run npm run db:migrate against the same database/schema as DATABASE_URL, then retry db:update. Discovery import is optional.",
		);
	} else console.error(error instanceof Error ? error.stack : String(error));
	process.exitCode = 1;
});
