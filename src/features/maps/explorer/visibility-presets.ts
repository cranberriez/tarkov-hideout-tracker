import type { MapVisibilityPreset } from "@/lib/cfg/map-explorer";
import { defaultFilters, groupOn, sameFilters, type Filters, type LayerDef } from "../tarkov-map";

/**
 * The filters a built-in visibility preset stands for on one map. `layers` are the map's layer definitions
 * (`layersFor`), so groups that only exist in its data (bosses, container types, loot categories) are set too.
 */
export function presetFilters(preset: MapVisibilityPreset, layers: LayerDef[]): Filters {
	const base = defaultFilters("unknown");
	if (!preset.layers) return base;
	const shown = new Set(preset.layers);
	const all = new Set(preset.allGroups ?? []);
	return Object.fromEntries(
		Object.entries(base).map(([key, filter]) => {
			const known = layers.find((layer) => layer.key === key)?.groups.map((group) => group.key) ?? [];
			const keys = new Set([...Object.keys(filter.groups), ...known]);
			const groups = Object.fromEntries(
				[...keys].map((group) => [group, shown.has(key) && (all.has(key) || groupOn(filter, group, key))]),
			);
			return [key, { ...filter, groups }];
		}),
	);
}

/** The built-in preset the filters match on this map, if any. */
export function matchingPreset<T extends MapVisibilityPreset>(
	presets: readonly T[],
	filters: Filters,
	layers: LayerDef[],
): T | undefined {
	return presets.find((preset) => sameFilters(presetFilters(preset, layers), filters));
}
