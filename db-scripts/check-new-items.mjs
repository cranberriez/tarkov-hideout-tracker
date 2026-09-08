import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { getTursoConfig, loadLocalEnv, parseModes } from "./lib/config.mjs";
import { createTursoClient } from "./lib/turso.mjs";
import { getKnownItemIds, newCatalogItems } from "./lib/catalog-history.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
	const args = process.argv.slice(2);
	if (args.length && (args.length !== 2 || args[0] !== "--modes")) {
		throw new Error("Usage: npm run db:items:check -- [--modes regular,pve,pvp-season]");
	}
	const modes = parseModes(args[1]);
	await loadLocalEnv(root);
	const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") } });
	const { getGlobalItemList } = await jiti.import(path.join(root, "src/server/services/itemsJson.ts"));
	const client = createTursoClient(getTursoConfig());
	try {
		for (const mode of modes) {
			const knownIds = await getKnownItemIds(client, mode);
			const result = await getGlobalItemList(mode);
			const items = newCatalogItems(result.data.items, knownIds);
			console.log(JSON.stringify({ mode, newItemCount: items.length, items }, null, 2));
		}
		console.log("Read-only check complete. No discovery dates or database rows changed.");
	} finally {
		client.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
