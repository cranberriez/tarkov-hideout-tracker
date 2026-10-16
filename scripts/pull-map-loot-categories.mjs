// Builds the loose-loot category table the Maps explorer filters loose loot by: each item's handbook category two levels
// deep (e.g. Barter items › Valuables), with posters split out of Barter items › Others. Port of tarkov-mappinator's
// `src-tauri/src/loose_loot.rs`. Handbook categories are the same in every mode, so the regular data set is used.
//   node scripts/pull-map-loot-categories.mjs
// Writes src/lib/data/map-loot-categories.json. Review the diff before committing.
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TARKOV_JSON_BASE_URL = "https://json.tarkov.dev";
const USER_AGENT = "TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)";
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/data/map-loot-categories.json");
const POSTERS = "posters";

const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);

async function json(path) {
	const response = await fetch(`${TARKOV_JSON_BASE_URL}/${path}`, { headers: { "User-Agent": USER_AGENT } });
	if (!response.ok) throw new Error(`${path}: ${response.status}`);
	return response.json();
}

export function buildLootCategories(data, locale) {
	const items = isRecord(data?.items) ? data.items : null;
	const handbook = isRecord(data?.handbookCategories) ? data.handbookCategories : null;
	if (!items || !Object.keys(items).length) throw new Error("Item payload has no items");
	if (!handbook || !Object.keys(handbook).length) throw new Error("Item payload has no handbook categories");
	const translate = (key) => (typeof locale?.[key] === "string" ? locale[key] : key);
	const field = (id, key) => (typeof handbook[id]?.[key] === "string" ? handbook[id][key] : undefined);
	const categories = {};
	const byItem = {};
	for (const [id, item] of Object.entries(items).sort(([a], [b]) => a.localeCompare(b))) {
		const own = Array.isArray(item?.handbookCategories) ? item.handbookCategories[0] : undefined;
		if (typeof own !== "string" || !handbook[own]) continue;
		// From the item's own category up to the top level.
		const path = [own];
		for (let parent = field(own, "parent"); parent && handbook[parent] && !path.includes(parent); parent = field(parent, "parent")) {
			path.unshift(parent);
		}
		const rootKey = field(path[0], "normalizedName");
		if (!rootKey) continue;
		categories[rootKey] ??= { label: translate(field(path[0], "name")), icon: field(path[0], "imageLink") ?? null };
		let key;
		if (Array.isArray(item.types) && item.types.includes("poster")) {
			categories[POSTERS] ??= { label: "Posters", icon: `item:${id}`, parent: rootKey };
			key = POSTERS;
		} else if (path[1]) {
			key = field(path[1], "normalizedName");
			if (!key) continue;
			categories[key] ??= { label: translate(field(path[1], "name")), icon: field(path[1], "imageLink") ?? null, parent: rootKey };
		} else {
			key = rootKey;
		}
		byItem[id] = key;
	}
	if (!Object.keys(byItem).length) throw new Error("No item has a handbook category");
	return { categories, items: byItem };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [items, locale] = await Promise.all([json("regular/items"), json("regular/items_en")]);
	const table = buildLootCategories(items.data, locale.data);
	await writeFile(OUTPUT, JSON.stringify(table) + "\n");
	console.log(`${Object.keys(table.items).length} items in ${Object.keys(table.categories).length} categories`);
}
