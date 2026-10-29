// Map overlay markers from tarkov.dev map data, and the tiered filter over them:
// a layer (Extracts, Spawns, …) holds groups (PMC, Scav, …) that switch on and off; the layer itself has no
// switch of its own, its header sets all its groups at once. A marker belongs to one layer and one or more
// groups, and shows when any of its groups is on. Layers, groups and game tables come from a `MarkerPreset`
// (`tarkovPreset` unless one is passed); markers of your own (quests, say) need only a layer in the preset.
import type { Extract, GameMapData, LooseCategory, Mob } from "./data";
import type { DocumentLocation } from "./documents";
import { containerGroup, tarkovPreset, type CategoryDef, type GroupDef, type LayerDef, type MarkerPreset } from "./markerPreset";
import type { Vec3 } from "./types";

export type { CategoryDef, GroupDef, LayerDef, MarkerPreset };

/** One row of a marker's detail card; `items` are item ids, `mono` marks a raw id with no name yet. */
export type Detail = { label: string; value?: string; items?: { id: string; count?: number }[]; mono?: boolean };

/** One boss type at a spawn point; several spawn entries of the same type are merged into one. */
export type BossInfo = {
  /** Filter group: the mob's normalized name, or "pmcs" for PMC bots. */ group: string;
  name: string; /** Map icon stem. */ icon: string; /** Portrait link. */ image?: string;
  /** Chance (0–1) that at least one of them spawns here. */ chance: number;
  /** Chance (0–1) of spawning in the raid at all; only for a single entry. */ raidChance?: number;
  /** Number of spawn entries merged in. */ entries: number;
  location: string; escorts: { name: string; count: string }[]; spawnTime?: string; trigger?: string;
};

export type MapMarker = {
  id: string;
  layer: string;
  groups: string[];
  position: Vec3;
  /** Fixed icon; without one, see `markerIcon`. */
  icon?: string;
  /** Footprint for zones (hazards, artillery), drawn in world x/z. */
  outline?: Vec3[];
  /** Name; drawn beside extract icons when zoomed in, otherwise shown on hover. */
  label?: string;
  /** What it is and extra detail, shown on hover after the label, e.g. "Container", "Flare", "Paid". */
  tags: string[];
  /** Everything else known about it, shown on the detail card. */
  details?: Detail[];
  /** Boss spawn points: one entry per boss type, shown as stacked cards instead of `details`. */
  bosses?: BossInfo[];
  /** Quest objective spots: the quest and objective they belong to. */
  quest?: { questId: string; objectiveId: string; /** tarkov.dev objective type, e.g. `shoot`. */ type: string };
  /** Battle Pass document spots: the known location here, with its reference photo. */
  document?: DocumentLocation;
  /** Floor id it is on, when set by hand rather than found from its position (see `floorOf`). */
  floor?: string;
  /** Its place among markers sharing one spot, drawn side by side. */
  slot?: { index: number; of: number };
};

export type LayerFilter = { groups: Record<string, boolean>; /** Markers on floors other than the one shown stay at 75% size with an overlaid caret. */ allFloors?: boolean };
export type Filters = Record<string, LayerFilter>;
export type Role = "pmc" | "scav" | "unknown";

/** `RaidState.player_role` → role; anything unrecognised (including null) is unknown. */
export function roleOf(playerRole: string | null | undefined): Role {
  const value = (playerRole ?? "").toLowerCase();
  return value.includes("scav") || value === "savage" ? "scav" : value.includes("pmc") || value === "usec" || value === "bear" ? "pmc" : "unknown";
}

/**
 * Each layer's own defaults; a known role also turns the other faction's groups off in factional layers.
 * Transits are PMC-only in game.
 */
export function defaultFilters(role: Role, preset: MarkerPreset = tarkovPreset): Filters {
  const off = new Set(role === "pmc" ? ["scav"] : role === "scav" ? ["pmc", "transit"] : []);
  return Object.fromEntries(preset.layers.map((layer) => [layer.key, {
    groups: Object.fromEntries(layer.groups.map((group) =>
      [group.key, !layer.off && !group.off && !(preset.factional.includes(layer.key) && off.has(group.key))])),
    allFloors: !!layer.allFloors,
  }]));
}

/**
 * Stored filters over the defaults, so layers and groups added later start in their default state.
 * Older saves had a separate layer switch; a layer saved as off now means all its groups are off.
 */
export function withDefaults(stored: Partial<Record<string, LayerFilter & { on?: boolean }>> | undefined, role: Role, preset: MarkerPreset = tarkovPreset): Filters {
  const defaults = defaultFilters(role, preset);
  return Object.fromEntries(Object.entries(defaults).map(([key, layer]) => {
    const saved = stored?.[key];
    const groups = { ...layer.groups, ...saved?.groups };
    for (const group of preset.dynamic[key]?.legacy ?? []) delete groups[group];
    if (saved?.on === false) for (const group of Object.keys(groups)) groups[group] = false;
    return [key, { groups, allFloors: typeof saved?.allFloors === "boolean" ? saved.allFloors : layer.allFloors }];
  }));
}

/** Whether a group is on; one the filter has no entry for (a boss or container type not seen before) takes its default. */
export const groupOn = (filter: LayerFilter | undefined, group: string, layer: string, preset: MarkerPreset = tarkovPreset) =>
  filter?.groups[group] ?? !preset.dynamic[layer]?.off(group);

/** Whether a layer keeps its markers on other floors; a layer the filter has no say for takes its preset default. */
export const allFloorsOn = (filter: LayerFilter | undefined, layer: string, preset: MarkerPreset = tarkovPreset) =>
  filter?.allFloors ?? !!preset.layers.find((def) => def.key === layer)?.allFloors;

/** Header state of a layer over the given groups: all on, none on, or some. */
export function layerState(filter: LayerFilter, groups: string[], layer: string, preset: MarkerPreset = tarkovPreset): "on" | "off" | "mixed" {
  const on = groups.filter((group) => groupOn(filter, group, layer, preset)).length;
  return on === 0 ? "off" : on === groups.length ? "on" : "mixed";
}

/** The header click: any of the groups on turns them all off, otherwise all on. Other groups are left alone. */
export function toggleLayer(filter: LayerFilter, groups: string[], layer: string, preset: MarkerPreset = tarkovPreset): LayerFilter {
  const on = layerState(filter, groups, layer, preset) === "off";
  return { ...filter, groups: { ...filter.groups, ...Object.fromEntries(groups.map((group) => [group, on])) } };
}

export const isVisible = (marker: MapMarker, filters: Filters, preset: MarkerPreset = tarkovPreset) => {
  const layer = filters[marker.layer];
  return !!layer && marker.groups.some((group) => groupOn(layer, group, marker.layer, preset));
};

const ROUBLES = "5449016a4bdc2d6f028b456f";
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
/** A document location within this of a spawn is that spawn. */
const SAME_SPOT_M = 1;
const posKey = ({ x, y, z }: Vec3) => `${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}`;
const percent = (chance: number) => `${Math.round(chance * 100)}%`;
const metres = (value: number) => `${+value.toFixed(1)}`;
/** "bottom–top m" for a height band, when the data has one. */
const heightDetail = (top: number | undefined, bottom: number | undefined): Detail[] =>
  typeof top === "number" && typeof bottom === "number" ? [{ label: "Height", value: `${metres(bottom)}–${metres(top)} m` }] : [];
const compact = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value);

function extractTags(name: string, transferItem: { item: string } | null | undefined) {
  const tags: string[] = [];
  if (/\(flare\)/i.test(name)) tags.push("Flare");
  if (/co-op/i.test(name)) tags.push("Co-op");
  if (transferItem) tags.push(transferItem.item === ROUBLES ? "Paid" : "Item required");
  return tags;
}

type Named = { name: string; normalizedName: string };
/** Name tables the map documents point into: `common.json` containers and guns, `mobs.json` mobs. */
export type Lookups = { containers?: Record<string, Named>; weapons?: Record<string, Named>; mobs?: Record<string, Named & Partial<Mob>>; /** Map id → name. */ maps?: Record<string, string> };

/**
 * All overlay markers for a map, unfiltered. `documents` are known document locations on this map (`documentLocations`):
 * one at a document spawn is attached to its marker; one placed where tarkov.dev has no spawn gets a marker of its own.
 */
export function buildMarkers(data: GameMapData, lookups: Lookups = {}, preset: MarkerPreset = tarkovPreset, documents: DocumentLocation[] = []): MapMarker[] {
  return [
    ...extractMarkers(data, lookups), ...spawnMarkers(data), ...bossMarkers(data, lookups, preset),
    ...zoneMarkers(data), ...pointMarkers(data, lookups, preset, documents),
  ];
}

function extractMarkers(data: GameMapData, lookups: Lookups): MapMarker[] {
  // Extracts without a faction (Night Factory, Ground Zero 21+) count as shared.
  // A PMC and a Scav extract with the same name at the same spot become one marker for both.
  const extracts: MapMarker[] = [];
  const sources = new Map<MapMarker, Extract>();
  for (const extract of data.extracts ?? []) {
    const groups = extract.faction === "pmc" ? ["pmc"] : extract.faction === "scav" ? ["scav"] : ["pmc", "scav"];
    const twin = extracts.find((other) => other.label === extract.name && distance(other.position, extract.position) < 10);
    if (twin) {
      twin.groups = [...new Set([...twin.groups, ...groups])];
      continue;
    }
    const marker: MapMarker = { id: `extract:${extract.id}`, layer: "extracts", groups, position: extract.position,
      label: extract.name, tags: extractTags(extract.name, extract.transferItem) };
    sources.set(marker, extract);
    extracts.push(marker);
  }
  // Details wait until twins have merged, so the faction reflects every group.
  const switchNames = new Map((data.switches ?? []).map((toggle) => [toggle.id, toggle.name]));
  for (const [marker, extract] of sources) marker.details = extractDetails(extract, marker.groups, switchNames);
  for (const transit of data.transits ?? []) {
    const destination = lookups.maps?.[transit.map];
    extracts.push({ id: `transit:${transit.id}`, layer: "extracts", groups: ["transit"], position: transit.position,
      label: transit.description.replace(/^Transit to /i, "→ "), tags: ["Transit"], details: [
        destination ? { label: "Destination", value: destination } : { label: "Destination", value: transit.map, mono: true },
        ...transit.conditions ? [{ label: "Condition", value: transit.conditions, mono: true }] : []] });
  }
  return extracts;
}

function extractDetails(extract: Extract, groups: string[], switchNames: Map<string, string>): Detail[] {
  const transfer = extract.transferItem;
  const switches = extract.switches ?? [];
  const named = switches.every((id) => switchNames.has(id));
  return [
    { label: "Faction", value: groups.length > 1 ? "Shared" : groups[0] === "scav" ? "Scav" : "PMC" },
    ...transfer ? [transfer.item === ROUBLES ? { label: "Requires", value: `${transfer.count.toLocaleString("en-US")} ₽` }
      : { label: "Requires", items: [{ id: transfer.item, count: transfer.count }] }] : [],
    ...switches.length ? [{ label: "Switch", value: (named ? switches.map((id) => switchNames.get(id)) : switches).join(", "), mono: !named }] : [],
  ];
}

/** Player spawns only; bot-only spawn points are a separate concern. */
function spawnMarkers(data: GameMapData): MapMarker[] {
  const markers: MapMarker[] = [];
  const seen = new Set<string>();
  for (const spawn of data.spawns ?? []) {
    if (!spawn.categories.includes("player")) continue;
    const sides = spawn.sides.includes("all") ? ["pmc", "scav"] : spawn.sides.filter((side) => side === "pmc" || side === "scav");
    if (!sides.length) continue;
    const { x, y, z } = spawn.position;
    const key = `${sides}|${x.toFixed(1)}|${z.toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    markers.push({ id: `spawn:${key}`, layer: "spawns", groups: sides, position: { x, y, z },
      tags: [`${sides.map((side) => side === "pmc" ? "PMC" : "Scav").join(" & ")} spawn`,
        ...spawn.categories.includes("sniper") ? ["Sniper"] : []],
      details: [{ label: "Sides", value: spawn.sides.join(", ") }, { label: "Categories", value: spawn.categories.join(", ") },
        { label: "Zone", value: spawn.zoneName, mono: true }] });
  }
  return markers;
}

const PMC_BOTS = new Set(["pmcBEAR", "pmcUSEC"]);
/** Filter group of a boss type; PMC bots share one. */
const bossGroup = (mob: string, normalizedName: string | undefined) => PMC_BOTS.has(mob) ? "pmcs" : normalizedName || mob;
/** Escort headcount: "2–4", or each count with its chance when there are only two. */
function escortCount(amount: { chance: number; count: number }[]) {
  const chances = new Map<number, number>();
  for (const { chance, count } of amount) chances.set(count, (chances.get(count) ?? 0) + chance);
  const counts = [...chances.keys()].sort((a, b) => a - b);
  if (counts.length <= 1) return `${counts[0] ?? 0}`;
  return counts.length === 2 ? counts.map((count) => `${count} (${percent(chances.get(count)!)})`).join(" / ") : `${counts[0]}–${counts[counts.length - 1]}`;
}
const bossTime = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** Boss spawn points; bosses sharing a point become one marker with an entry per boss type. */
function bossMarkers(data: GameMapData, lookups: Lookups, preset: MarkerPreset): MapMarker[] {
  type Type = BossInfo & { miss: number; locations: Set<string>; seen: Set<number> };
  const byPoint = new Map<string, { position: Vec3; types: Map<string, Type>; counted: Set<string> }>();
  (data.bosses ?? []).forEach((boss, index) => {
    const mob = lookups.mobs?.[boss.mob];
    const group = bossGroup(boss.mob, mob?.normalizedName);
    const time = boss.spawnTime ?? -1;
    boss.spawnLocations?.forEach((location, locationIndex) => {
      for (const position of location.positions ?? []) {
        const key = posKey(position);
        const point = byPoint.get(key) ?? { position, types: new Map(), counted: new Set() };
        byPoint.set(key, point);
        // A spot listed twice in one location is still one chance.
        if (point.counted.has(`${index}|${locationIndex}`)) continue;
        point.counted.add(`${index}|${locationIndex}`);
        let type: Type | undefined = point.types.get(group);
        if (!type) {
          type = { group, name: group === "pmcs" ? "PMC bots" : mob?.name ?? boss.mob, icon: preset.bossIcons[mob?.normalizedName ?? ""] ?? "spawn_boss",
            image: group === "pmcs" ? undefined : mob?.imagePortraitLink, chance: 0, raidChance: boss.spawnChance, entries: 0, location: "",
            escorts: [], spawnTime: time >= 0 ? `${bossTime(time)}${boss.spawnTimeRandom ? " · random" : ""}` : undefined,
            trigger: boss.spawnTrigger || undefined, miss: 1, locations: new Set(), seen: new Set() };
          point.types.set(group, type);
        }
        type.miss *= 1 - boss.spawnChance * location.chance;
        type.locations.add(location.name);
        if (type.seen.has(index)) continue;
        type.seen.add(index);
        type.entries++;
        for (const escort of boss.escorts ?? []) {
          const line = { name: lookups.mobs?.[escort.mob]?.name ?? escort.mob, count: escortCount(escort.amount) };
          if (!type.escorts.some((other) => other.name === line.name && other.count === line.count)) type.escorts.push(line);
        }
      }
    });
  });
  return [...byPoint].map(([key, { position, types }]) => {
    const bosses = [...types.values()].map(({ miss, locations, seen, ...type }): BossInfo =>
      ({ ...type, chance: 1 - miss, raidChance: type.entries === 1 ? type.raidChance : undefined, location: [...locations].join(", ") }));
    return { id: `boss:${key}`, layer: "bosses", groups: bosses.map((boss) => boss.group), position, bosses,
      label: bosses.map((boss) => boss.name).join(", "),
      tags: [...new Set(bosses.flatMap((boss) => boss.location.split(", "))), ...bosses.map((boss) => `${boss.name} ${percent(boss.chance)}`)] };
  });
}

/** Hazards and artillery strike areas: an outline with an icon at its centre. */
function zoneMarkers(data: GameMapData): MapMarker[] {
  // Hazard ids repeat within a map, so zones are keyed by index.
  const hazards = (data.hazards ?? []).map((hazard, index): MapMarker => ({
    id: `hazard:${index}`, layer: "hazards", position: hazard.position, outline: hazard.outline, icon: "hazard",
    groups: [hazard.hazardType === "minefield" || hazard.hazardType === "sniper" ? hazard.hazardType : "other"],
    tags: [hazard.name],
    details: [{ label: "Type", value: hazard.hazardType }, ...heightDetail(hazard.top, hazard.bottom)],
  }));
  const zones = data.artillery?.zones ?? [];
  const artillery = zones.map((zone, index): MapMarker => ({
    id: `artillery:${index}`, layer: "hazards", groups: ["artillery"], position: zone.position, outline: zone.outline,
    icon: "hazard_mortar", tags: ["Artillery strike zone"],
    details: [...zone.size ? [{ label: "Size", value: `${metres(zone.size.x)} × ${metres(zone.size.z)} m` }] : [], ...heightDetail(zone.top, zone.botom)],
  }));
  return [...hazards, ...artillery];
}

function pointMarkers(data: GameMapData, lookups: Lookups, preset: MarkerPreset, locations: DocumentLocation[]): MapMarker[] {
  const markers: MapMarker[] = [];
  const documentGroup = new Map(preset.documents.map(({ key, item }) => [item, key]));
  const seen = new Set<string>();
  for (const container of data.lootContainers ?? []) {
    // The data repeats some containers at the same spot.
    const id = `container:${container.lootContainer}|${posKey(container.position)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const named = lookups.containers?.[container.lootContainer];
    const name = named?.normalizedName ?? "";
    markers.push({ id, layer: "containers", groups: [name || container.lootContainer], position: container.position,
      icon: `container_${preset.containerIconAlias[name] ?? (name || "crate")}`, tags: [named?.name ?? "Container"],
      details: [{ label: "Container", value: container.lootContainer, mono: true }] });
  }
  for (const lock of data.locks ?? []) {
    const group = lock.lockType === "trunk" ? "trunk" : "door";
    markers.push({ id: `lock:${lock.id}`, layer: "access", groups: [group], position: lock.position, icon: "lock",
      tags: [group === "trunk" ? "Locked trunk" : "Locked door"], details: [
        { label: "Type", value: group === "trunk" ? "Trunk" : "Door" }, { label: "Key", items: [{ id: lock.key }] },
        { label: "Needs power", value: lock.needsPower ? "Yes" : "No" }] });
  }
  const opens = new Map<string, Set<string>>();
  for (const extract of data.extracts ?? []) for (const id of extract.switches ?? []) opens.set(id, (opens.get(id) ?? new Set()).add(extract.name));
  for (const toggle of data.switches ?? []) {
    markers.push({ id: `switch:${toggle.id}`, layer: "access", groups: ["switch"], position: toggle.position,
      icon: "switch", label: toggle.name, tags: ["Switch"], details: [
        { label: "Type", value: toggle.switchType },
        ...opens.has(toggle.id) ? [{ label: "Opens", value: [...opens.get(toggle.id)!].join(", ") }] : [],
        ...toggle.activatedBy ? [{ label: "Activated by", value: compact(toggle.activatedBy), mono: true }] : [],
        ...toggle.activates?.length ? [{ label: "Activates", value: toggle.activates.map(compact).join(", "), mono: true }] : []] });
  }
  (data.stationaryWeapons ?? []).forEach((gun, index) => markers.push({
    id: `gun:${index}`, layer: "other", groups: ["stationary"], position: gun.position, icon: "stationarygun",
    tags: [lookups.weapons?.[gun.stationaryWeapon]?.name ?? "Stationary gun"],
    details: [{ label: "Weapon", value: gun.stationaryWeapon, mono: true }],
  }));
  (data.btrStops ?? []).forEach((stop, index) => markers.push({
    id: `btr:${index}`, layer: "other", groups: ["btr"], position: { x: stop.x, y: stop.y, z: stop.z },
    icon: "btr_stop", label: stop.name, tags: ["BTR stop"],
  }));
  // Hand-made links first, so one wins a spawn over a stale automatic match there.
  const placed = locations.filter((location) => location.position).sort((a, b) => +(b.match === "manual") - +(a.match === "manual"));
  const claimed = new Set<DocumentLocation>();
  const spawnSpots: Vec3[] = [];
  (data.lootLoose ?? []).forEach((loot, index) => {
    // A spawn point that can hold a Battle Pass document is a document marker, not loose loot.
    const documents = [...new Set(loot.items.flatMap((item) => documentGroup.get(item) ?? []))];
    if (documents.length) {
      spawnSpots.push(loot.position);
      // A spawn that can hold more than one type gets a marker per type, side by side, each with its own location.
      const labels = documents.map((key) => preset.documents.find((type) => type.key === key)!.label);
      documents.forEach((type, slot) => {
        const document = placed.find((location) => !claimed.has(location) && location.type === type
          && distance(location.position as Vec3, loot.position) < SAME_SPOT_M);
        if (document) claimed.add(document);
        const shared = documents.length > 1;
        markers.push({ id: shared ? `document:${index}:${type}` : `document:${index}`, layer: "documents", groups: [type], position: loot.position,
          document, ...document?.floor ? { floor: document.floor } : {}, ...shared ? { slot: { index: slot, of: documents.length } } : {},
          tags: [`${labels[slot]} document`, ...shared ? [`Shares its spot with ${labels.filter((_, other) => other !== slot).join(", ")}`] : []],
          details: [{ label: "Document types", value: labels.join(", ") }, { label: "Possible items", items: loot.items.map((id) => ({ id })) }] });
      });
      return;
    }
    // Spawns whose items have no category (or without item enrichment) stay in the plain group.
    const categories = loot.categories?.length ? loot.categories : undefined;
    const labels = categories?.map((key) => data.looseCategories?.[key]?.label ?? key);
    markers.push({ id: `loose:${index}`, layer: "loose", groups: categories ?? ["loose"], position: loot.position, icon: "loose_loot",
      tags: ["Loose loot", `${loot.items.length} possible item${loot.items.length === 1 ? "" : "s"}`],
      details: [...labels ? [{ label: "Categories", value: labels.join(", ") }] : [],
        { label: "Possible items", items: loot.items.map((id) => ({ id })) }] });
  });
  // Placed by hand where tarkov.dev has no document spawn (Icebreaker, say).
  for (const location of placed) {
    if (claimed.has(location) || spawnSpots.some((spot) => distance(spot, location.position as Vec3) < SAME_SPOT_M)) continue;
    const label = preset.documents.find((type) => type.key === location.type)?.label ?? location.type;
    markers.push({ id: `document:${location.id}`, layer: "documents", groups: [location.type], document: location, ...location.floor ? { floor: location.floor } : {},
      position: { y: 0, ...location.position! }, tags: [`${label} document`] });
  }
  return markers;
}

/**
 * Icon key for a marker (a file stem, `item:<id>`, or an image link), given which of its groups are shown:
 * its own icon, else one picked for the built-in layers, else that of its first shown group, else its layer's.
 */
export function markerIcon(marker: MapMarker, filters: Filters, preset: MarkerPreset = tarkovPreset): string {
  if (marker.icon) return marker.icon;
  const shown = marker.groups.filter((group) => groupOn(filters[marker.layer], group, marker.layer, preset));
  if (marker.bosses) return marker.bosses.find((boss) => groupOn(filters[marker.layer], boss.group, marker.layer, preset))?.icon ?? "spawn_boss";
  if (marker.layer === "documents") return `item:${preset.documents.find((type) => type.key === shown[0])?.item}`;
  if (marker.layer === "spawns") return shown.includes("pmc") ? "spawn_pmc" : "spawn_scav";
  if (marker.layer === "extracts") {
    if (shown.includes("transit")) return "extract_transit";
    return shown.includes("pmc") && shown.includes("scav") ? "extract_shared" : shown.includes("scav") ? "extract_scav" : "extract_pmc";
  }
  const layer = preset.layers.find((other) => other.key === marker.layer);
  return layer?.groups.find((group) => group.key === (shown[0] ?? marker.groups[0]))?.icon ?? layer?.icon ?? "container_crate";
}

/** Colour behind a marker's icon, from the first of its groups that is shown. */
export function markerTint(marker: MapMarker, filters: Filters, preset: MarkerPreset = tarkovPreset): string | undefined {
  const shown = marker.groups.find((group) => groupOn(filters[marker.layer], group, marker.layer, preset));
  return preset.layers.find((layer) => layer.key === marker.layer)?.groups.find((group) => group.key === shown)?.tint;
}

/** Marker count per layer and per layer group, for the filter panel. */
export function countMarkers(markers: MapMarker[]) {
  const counts: Record<string, number> = {};
  for (const marker of markers) {
    counts[marker.layer] = (counts[marker.layer] ?? 0) + 1;
    for (const group of marker.groups) counts[`${marker.layer}.${group}`] = (counts[`${marker.layer}.${group}`] ?? 0) + 1;
  }
  return counts;
}

/**
 * Layers with the data-driven groups filled in from the map's markers: one per boss type, the default-on ones
 * first; one per container type, ordered by category then name, under its category as `parent`; one per loose
 * loot item category, under its top-level category, both by name (`looseCategories` from the map data).
 */
export function layersFor(markers: MapMarker[], looseCategories: Record<string, LooseCategory> = {}, preset: MarkerPreset = tarkovPreset): LayerDef[] {
  const bosses = new Map<string, GroupDef>();
  for (const boss of markers.flatMap((marker) => marker.bosses ?? []))
    if (!bosses.has(boss.group)) bosses.set(boss.group, { key: boss.group, label: boss.name, icon: boss.icon, image: boss.image, off: preset.bossOff.includes(boss.group) });
  const containers = new Map<string, GroupDef>();
  for (const marker of markers) {
    const key = marker.layer === "containers" ? marker.groups[0] : undefined;
    // An unnamed container has no display name, only its raw id.
    if (key !== undefined && !containers.has(key)) containers.set(key, { key, label: marker.tags[0] === "Container" ? key : marker.tags[0], icon: marker.icon ?? "container_crate",
      parent: containerGroup(preset, key), off: preset.dynamic.containers?.off(key) });
  }
  const order = preset.layers.find((layer) => layer.key === "containers")?.categories?.map((category) => category.key) ?? [];
  const types = [...containers.values()].sort((a, b) => order.indexOf(a.parent!) - order.indexOf(b.parent!) || a.label.localeCompare(b.label));
  const sorted = [...bosses.values()].sort((a, b) => Number(!!a.off) - Number(!!b.off));
  const loose = looseLayer(markers, looseCategories, preset);
  return preset.layers.map((layer) => layer.key === "bosses" ? { ...layer, groups: sorted } : layer.key === "containers" ? { ...layer, groups: types }
    : layer.key === "loose" && loose ? loose : layer);
}

/** The loose loot layer by item category; undefined when no spawn has one, which leaves the single plain group. */
function looseLayer(markers: MapMarker[], table: Record<string, LooseCategory>, preset: MarkerPreset): LayerDef | undefined {
  const base = preset.layers.find((layer) => layer.key === "loose");
  if (!base) return undefined;
  const keys = new Set(markers.filter((marker) => marker.layer === "loose").flatMap((marker) => marker.groups));
  if (![...keys].some((key) => key !== "loose")) return undefined;
  const byName = (a: { key: string; label: string }, b: { key: string; label: string }) =>
    Number(a.key === "loose") - Number(b.key === "loose") || a.label.localeCompare(b.label);
  // A category with no parent is its own top level; uncategorised spawns get a top level of their own, listed last.
  const groups: GroupDef[] = [...keys].map((key) => key === "loose" ? { ...base.groups[0], label: "Uncategorised", parent: "loose" }
    : { key, label: table[key]?.label ?? key, icon: table[key]?.icon ?? "loose_loot", parent: table[key]?.parent ?? key }).sort(byName);
  const categories: CategoryDef[] = [...new Set(groups.map((group) => group.parent!))].map((key) => key === "loose"
    ? { key, label: "Uncategorised", icon: "loose_loot" } : { key, label: table[key]?.label ?? key, icon: table[key]?.icon ?? "loose_loot" }).sort(byName);
  return { ...base, groups, categories };
}

/** Whether two filter states show the same markers' switches, ignoring key order; boss and container types missing on one side count as default. */
export function sameFilters(a: Filters, b: Filters, preset: MarkerPreset = tarkovPreset): boolean {
  return preset.layers.every((layer) => {
    const keys = new Set(layer.groups.map((group) => group.key));
    const legacy = preset.dynamic[layer.key]?.legacy;
    if (legacy) for (const side of [a, b]) for (const group of Object.keys(side[layer.key]?.groups ?? {})) if (!legacy.includes(group)) keys.add(group);
    return allFloorsOn(a[layer.key], layer.key, preset) === allFloorsOn(b[layer.key], layer.key, preset)
      && [...keys].every((group) => groupOn(a[layer.key], group, layer.key, preset) === groupOn(b[layer.key], group, layer.key, preset));
  });
}
