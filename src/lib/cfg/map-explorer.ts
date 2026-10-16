// Maps explorer (/maps): the maps it lists and the built-in visibility presets. Kept free of the map library so the
// site nav can import it without pulling in calibration data.

/** Maps with interactive art, by tarkov.dev `normalizedName`, in display order. */
export const MAP_EXPLORER_MAPS = [
	{ key: "customs", name: "Customs" },
	{ key: "factory", name: "Factory" },
	{ key: "night-factory", name: "Night Factory" },
	{ key: "ground-zero", name: "Ground Zero" },
	{ key: "ground-zero-21", name: "Ground Zero 21+" },
	{ key: "interchange", name: "Interchange" },
	{ key: "lighthouse", name: "Lighthouse" },
	{ key: "reserve", name: "Reserve" },
	{ key: "shoreline", name: "Shoreline" },
	{ key: "streets-of-tarkov", name: "Streets of Tarkov" },
	{ key: "woods", name: "Woods" },
	{ key: "the-lab", name: "The Lab" },
	{ key: "the-lab-dark", name: "The Lab (Dark)" },
	{ key: "the-labyrinth", name: "The Labyrinth" },
	{ key: "icebreaker", name: "Icebreaker" },
	{ key: "terminal", name: "Terminal" },
] as const;

export type MapExplorerMapKey = (typeof MAP_EXPLORER_MAPS)[number]["key"];

export function isMapExplorerMapKey(value: string): value is MapExplorerMapKey {
	return MAP_EXPLORER_MAPS.some((map) => map.key === value);
}

export function mapExplorerHref(key: MapExplorerMapKey, preset?: MapVisibilityPresetKey | null): string {
	return `/maps/${key}${preset && preset !== DEFAULT_MAP_VISIBILITY_PRESET ? `?preset=${preset}` : ""}`;
}

/**
 * A built-in set of visible marker layers. Listed layers keep their usual group defaults (or all groups with
 * `allGroups`); every other layer is hidden. `null` layers means the map's usual defaults.
 */
export interface MapVisibilityPreset {
	key: string;
	label: string;
	description: string;
	layers: readonly string[] | null;
	allGroups?: readonly string[];
}

export const MAP_VISIBILITY_PRESETS = [
	{ key: "standard", label: "Standard", description: "Extracts, spawns, bosses, key containers and documents", layers: null },
	{
		key: "documents",
		label: "Documents",
		description: "Battle Pass document locations and extracts",
		layers: ["documents", "extracts"],
		allGroups: ["documents"],
	},
	{
		key: "extracts",
		label: "Extracts & spawns",
		description: "Extracts, transits and player spawns",
		layers: ["extracts", "spawns"],
	},
	{
		key: "loot",
		label: "Loot",
		description: "Containers and loose loot",
		layers: ["containers", "loose"],
		allGroups: ["containers", "loose"],
	},
	{
		key: "threats",
		label: "Bosses & hazards",
		description: "Boss spawns, hazards and stationary weapons",
		layers: ["bosses", "hazards", "other", "extracts"],
		allGroups: ["bosses", "hazards"],
	},
	{
		key: "keys",
		label: "Keys & switches",
		description: "Locked doors, trunks and switches",
		layers: ["access", "extracts"],
		allGroups: ["access"],
	},
] as const satisfies readonly MapVisibilityPreset[];

export type MapVisibilityPresetKey = (typeof MAP_VISIBILITY_PRESETS)[number]["key"];

export const DEFAULT_MAP_VISIBILITY_PRESET: MapVisibilityPresetKey = "standard";

export function parseMapVisibilityPreset(value: string | null | undefined): MapVisibilityPresetKey | null {
	return MAP_VISIBILITY_PRESETS.find((preset) => preset.key === value)?.key ?? null;
}
