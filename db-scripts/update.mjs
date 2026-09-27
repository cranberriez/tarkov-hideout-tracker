import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { loadLocalEnv } from "./lib/config.mjs";
import { applyCatalogUpdate, MODES, readCatalogBaseline } from "./lib/postgres-catalog.mjs";
import { stripCatalogDto } from "./lib/catalog-dto.mjs";
import { loadDiscoveryInput } from "./lib/discovery-input.mjs";
import { planDiscoveryReconciliation } from "./lib/discovery.mjs";
import { reportDiscoveryConflict } from "./lib/discovery-diagnostics.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

function parseArgs(argv) {
	let patch = process.env.CURRENT_GAME_PATCH ?? "1.1.5.0";
	let dryRun = false;
	let fixturePath;
	let exportFixturePath;
	let discoveryPath;
	for (let index = 0; index < argv.length; index++) {
		if (argv[index] === "--patch") patch = argv[++index];
		else if (argv[index] === "--dry-run") dryRun = true;
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
	if (!/^\d+\.\d+\.\d+\.\d+$/.test(patch)) throw new Error("--patch must be a numeric game patch such as 1.1.5.0");
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
	return { patch, dryRun, fixturePath, exportFixturePath, discoveryPath };
}

async function loadServices() {
	const jiti = createJiti(pathToFileURL(import.meta.url).href, { alias: { "@": path.join(projectRoot, "src") } });
	const importSource = (file) => jiti.import(path.join(projectRoot, file));
	const [
		itemsService,
		hideoutService,
		questsService,
		tradersService,
		recipesService,
		relationsQuery,
		usageQuery,
		acquisitionQuery,
	] = await Promise.all([
		importSource("src/server/services/itemsJson.ts"),
		importSource("src/server/services/hideoutJson.ts"),
		importSource("src/server/services/questsJson.ts"),
		importSource("src/server/services/tradersJson.ts"),
		importSource("src/server/services/itemAcquisitionJson.ts"),
		importSource("src/server/queries/getItemRelationsData.ts"),
		importSource("src/server/queries/getItemUsageData.ts"),
		importSource("src/server/queries/getItemAcquisitionTreeData.ts"),
	]);
	return {
		itemsService,
		hideoutService,
		questsService,
		tradersService,
		recipesService,
		relationsQuery,
		usageQuery,
		acquisitionQuery,
	};
}

function makeResult(data, updatedAt) {
	return { data, updatedAt };
}
function byId(records, ids) {
	const map = new Map(records.map((row) => [row.id, row]));
	return Object.fromEntries([...new Set(ids)].flatMap((id) => (map.has(id) ? [[id, map.get(id)]] : [])));
}

function memoryRepository(data) {
	return {
		items: {
			getCatalog: async () => makeResult(data.items, data.freshness.items),
			getByIds: async (_mode, ids) => makeResult(byId(data.items, ids), data.freshness.items),
		},
		hideout: { getStations: async () => makeResult(data.stations, data.freshness.stations) },
		quests: {
			getAll: async () => makeResult(data.quests, data.freshness.quests),
			getByIds: async (_mode, ids) => makeResult(byId(data.quests, ids), data.freshness.quests),
		},
		traders: {
			getAll: async () => makeResult(data.traders, data.freshness.traders),
			getByIds: async (_mode, ids) => makeResult(byId(data.traders, ids), data.freshness.traders),
		},
		recipes: {
			getBarters: async () => makeResult(data.barters, data.freshness.barters),
			getCrafts: async () => makeResult(data.crafts, data.freshness.crafts),
		},
		prices: {
			getCurrent: async () => makeResult({}, data.freshness.items),
			getHistory: async () => {
				throw new Error("Price history is not part of catalog ingestion");
			},
		},
	};
}

async function loadModeData(mode, services) {
	const [itemResult, skillsResult, stationResult, questResult, traderResult, barterResult, craftResult] =
		await Promise.all([
			services.itemsService.getGlobalItemList(mode),
			services.itemsService.getGlobalSkillList(mode),
			services.hideoutService.getJsonHideoutStations(mode),
			services.questsService.getCurrentJsonFullQuestData(mode),
			services.tradersService.getJsonTraders(mode),
			services.recipesService.getBarterIndex(mode),
			services.recipesService.getCraftIndex(mode),
		]);
	const data = {
		items: itemResult.data.items.map((sourceItem) => {
			const item = { ...sourceItem };
			delete item.marketPrice;
			delete item.buyFromTrader;
			return item;
		}),
		skills: skillsResult.data.skills,
		stations: stationResult.data.stations,
		quests: questResult.data.quests,
		traders: traderResult.data.traders,
		barters: Object.values(barterResult.data.bartersByItemId).flat(),
		crafts: Object.values(craftResult.data.craftsByItemId).flat(),
		freshness: {
			items: itemResult.updatedAt,
			skills: skillsResult.updatedAt,
			stations: stationResult.updatedAt,
			quests: questResult.updatedAt,
			traders: traderResult.updatedAt,
			barters: barterResult.updatedAt,
			crafts: craftResult.updatedAt,
		},
	};
	return data;
}

async function prepareDetails(mode, data, services) {
	const repo = memoryRepository(data);
	data.itemDetails = [];
	const batchSize = 10;
	for (let offset = 0; offset < data.items.length; offset += batchSize) {
		const entries = await Promise.all(
			data.items.slice(offset, offset + batchSize).map(async (item) => {
				const [relations, usage, acquisition] = await Promise.all([
					services.relationsQuery.getItemRelationsData(item.id, mode, repo),
					services.usageQuery.getItemUsageData(item.id, mode, repo),
					services.acquisitionQuery.getItemAcquisitionTreeData(item.id, mode, repo),
				]);
				return {
					itemId: item.id,
					relations: stripCatalogDto(relations),
					usage: stripCatalogDto(usage),
					acquisition: stripCatalogDto(acquisition),
				};
			}),
		);
		data.itemDetails.push(...entries);
		if (offset === 0 || offset + batchSize >= data.items.length || (offset + batchSize) % 500 === 0)
			console.log(
				`  ${mode}: prepared item details ${Math.min(offset + batchSize, data.items.length)}/${data.items.length}`,
			);
	}
}

async function main() {
	await loadLocalEnv(projectRoot);
	const { patch, dryRun, fixturePath, exportFixturePath, discoveryPath } = parseArgs(process.argv.slice(2));
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
			const services = await loadServices();
			for (const mode of MODES) {
				console.log(`Fetching normalized ${mode} catalog…`);
				const data = await loadModeData(mode, services);
				await prepareDetails(mode, data, services);
				modesData[mode] = data;
				console.log(
					`  ${mode}: ${data.items.length} items, ${data.stations.length} stations, ${data.quests.length} quests`,
				);
			}
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
		const result = await applyCatalogUpdate(pool, modesData, patch, Date.now(), {
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
