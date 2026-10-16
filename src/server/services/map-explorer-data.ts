import "server-only";
import lootCategories from "@/lib/data/map-loot-categories.json";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { CommonData, GameMapData, LooseCategory, Mob } from "@/features/maps/tarkov-map/data";
import type { Lookups } from "@/features/maps/tarkov-map/markers";
import { translate } from "@/features/maps/tarkov-map/translate";
import { TARKOV_API_USER_AGENT } from "./tarkovApi";

/** One map's tarkov.dev document for the Maps explorer, with only the name lookups it points into. */
export interface MapExplorerPayload {
	map: GameMapData;
	lookups: Lookups;
}

const TARKOV_JSON_BASE_URL = "https://json.tarkov.dev";
/** How long one instance reuses a mode's split maps before fetching again. */
const MEMO_TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_AFTER_MS = 5 * 60 * 1000;
const ARRAY_FIELDS = [
	"bosses", "spawns", "extracts", "transits", "locks", "hazards", "switches", "lootContainers", "lootLoose",
	"stationaryWeapons", "btrStops", "enemies", "accessKeys",
] as const;

type Named = { name: string; normalizedName: string };
type MapsData = CommonData & { maps: Record<string, unknown>; mobs: Record<string, Mob> };
type LootTable = { categories: Record<string, LooseCategory>; items: Record<string, string> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === "object" && !Array.isArray(value);

async function fetchJson(path: string): Promise<Record<string, unknown>> {
	const response = await fetch(`${TARKOV_JSON_BASE_URL}/${path}`, {
		headers: { "User-Agent": TARKOV_API_USER_AGENT },
		// Responses exceed the data cache's item limit; the memo below and the route's CDN headers cache instead.
		cache: "no-store",
	});
	if (!response.ok) throw new Error(`tarkov.dev ${path}: ${response.status}`);
	const body: unknown = await response.json();
	if (!isRecord(body)) throw new Error(`tarkov.dev ${path}: not an object`);
	return body;
}

/** A map document with every array field present and the identifiers the explorer keys on, or null. */
function normalizeMap(value: unknown): GameMapData | null {
	if (!isRecord(value)) return null;
	if (typeof value.id !== "string" || !value.id) return null;
	if (typeof value.normalizedName !== "string" || !value.normalizedName) return null;
	if (typeof value.name !== "string" || !value.name) return null;
	const map = { ...value } as Record<string, unknown>;
	for (const field of ARRAY_FIELDS) if (!Array.isArray(map[field])) map[field] = [];
	return map as GameMapData;
}

/** Gives each loose loot spawn the categories its possible items fall in, and the map the categories it uses. */
function attachLootCategories(map: GameMapData, table: LootTable) {
	const used: Record<string, LooseCategory> = {};
	map.lootLoose = map.lootLoose.map((spawn) => {
		const keys = [...new Set((spawn.items ?? []).map((id) => table.items[id]).filter((key): key is string => !!key))];
		for (const key of keys) {
			for (let next: string | null | undefined = key; next && !used[next] && table.categories[next]; ) {
				used[next] = table.categories[next];
				next = table.categories[next].parent;
			}
		}
		return { ...spawn, categories: keys };
	});
	map.looseCategories = used;
}

const pick = <T extends Named>(table: Record<string, T> | undefined, ids: Iterable<string>) => {
	const out: Record<string, Named> = {};
	for (const id of ids) {
		const entry = table?.[id];
		if (entry) out[id] = { name: entry.name, normalizedName: entry.normalizedName };
	}
	return out;
};

/** Only the containers, guns and mobs this map refers to, so each response stays small. */
function lookupsFor(map: GameMapData, data: MapsData, mapNames: Record<string, string>): Lookups {
	const mobIds = new Set(map.bosses.flatMap((boss) => [boss.mob, ...(boss.escorts ?? []).map((escort) => escort.mob)]));
	const mobs: NonNullable<Lookups["mobs"]> = {};
	for (const id of mobIds) {
		const mob = data.mobs?.[id];
		if (mob) mobs[id] = { name: mob.name, normalizedName: mob.normalizedName, imagePortraitLink: mob.imagePortraitLink };
	}
	return {
		containers: pick(data.lootContainers, new Set(map.lootContainers.map((spawn) => spawn.lootContainer))),
		weapons: pick(data.stationaryWeapons, new Set(map.stationaryWeapons.map((spawn) => spawn.stationaryWeapon))),
		mobs,
		maps: mapNames,
	};
}

/** Fetches, translates, validates and splits one mode's maps. Throws rather than returning an empty set. */
async function loadMode(mode: TarkovJsonGameMode): Promise<Map<string, MapExplorerPayload>> {
	const [response, names] = await Promise.all([fetchJson(`${mode}/maps`), fetchJson(`${mode}/maps_en`)]);
	if (!isRecord(names.data) || !Object.keys(names.data).length) throw new Error(`tarkov.dev ${mode}/maps_en: empty`);
	translate(response as { translations?: string[] }, names.data);
	const data = response.data as MapsData | undefined;
	if (!isRecord(data) || !isRecord(data.maps)) throw new Error(`tarkov.dev ${mode}/maps: missing data.maps`);
	const maps = Object.values(data.maps).map(normalizeMap).filter((map): map is GameMapData => map !== null);
	if (!maps.length) throw new Error(`tarkov.dev ${mode}/maps: no valid maps`);
	const mapNames = Object.fromEntries(maps.map((map) => [map.id, map.name]));
	const split = new Map<string, MapExplorerPayload>();
	for (const map of maps) {
		attachLootCategories(map, lootCategories as LootTable);
		split.set(map.normalizedName, { map, lookups: lookupsFor(map, data, mapNames) });
	}
	return split;
}

type Memo = { at: number; maps: Promise<Map<string, MapExplorerPayload>> };
const memo = new Map<TarkovJsonGameMode, Memo>();

/** A mode's split maps: reused for six hours per instance; a failed refresh keeps serving the previous good set. */
async function modeMaps(mode: TarkovJsonGameMode): Promise<Map<string, MapExplorerPayload>> {
	const current = memo.get(mode);
	if (current && Date.now() - current.at < MEMO_TTL_MS) return current.maps;
	const next: Memo = { at: Date.now(), maps: loadMode(mode) };
	memo.set(mode, next);
	try {
		return await next.maps;
	} catch (error) {
		if (current) {
			// Retry in a few minutes rather than on every request while tarkov.dev is failing.
			memo.set(mode, { at: Date.now() - MEMO_TTL_MS + RETRY_AFTER_MS, maps: current.maps });
			return current.maps;
		}
		memo.delete(mode);
		throw error;
	}
}

/** One map's explorer payload by tarkov.dev `normalizedName`; null when the mode has no such map. */
export async function getMapExplorerData(
	mode: TarkovJsonGameMode,
	normalizedName: string,
): Promise<MapExplorerPayload | null> {
	return (await modeMaps(mode)).get(normalizedName) ?? null;
}
