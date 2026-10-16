// Game knowledge the overlay markers are built and filtered with: which layers and groups exist, how tarkov.dev's
// ids map onto them, and what starts hidden. Kept apart from the logic in `markers.ts` so season changes are
// edits here, and so a consumer can extend it (its own layers for quest markers, say) and pass it in.

/** `icon` is a file stem in `src/maps/assets/icons`, `item:<tarkov.dev item id>`, or an image link. */
export type GroupDef = { key: string; label: string; icon: string; /** Colour behind the icon. */ tint?: string; /** Hidden until switched on. */ off?: boolean;
  /** Portrait link shown instead of the icon (boss types). */ image?: string;
  /** Key of the layer category it sits under in the panel (container types). */ parent?: string };
/** A panel-only level between a layer and its groups; it has no filter state of its own. */
export type CategoryDef = { key: string; label: string; icon: string };
export type LayerDef = {
  key: string; label: string; icon: string; groups: GroupDef[];
  /** Groups are listed under these, in this order, by their `parent`. */ categories?: CategoryDef[];
  /** All groups hidden until switched on. */ off?: boolean;
  /** Folded in the panel until opened. */ folded?: boolean;
  /** Kept on every floor by default: markers on other floors stay, smaller and with a caret. */ allFloors?: boolean;
};

/** A layer whose groups come from the map's data, so its `LayerDef` can't list them. */
export type DynamicLayer = {
  /** Whether a group not seen before starts off. */ off: (group: string) => boolean;
  /** Old group keys that mean nothing now (saves from before they were split up). */ legacy: string[];
};

export type DocumentType = { key: string; label: string; /** tarkov.dev item id. */ item: string; tint: string };

export type MarkerPreset = {
  /** Every layer, in panel order. Marker layers not listed here are never shown. */
  layers: LayerDef[];
  dynamic: Record<string, DynamicLayer>;
  /** Layers whose `pmc`/`scav`/`transit` groups follow the player's side. */
  factional: string[];
  /** Loose loot spawns that can hold one of these items are document markers instead. */
  documents: DocumentType[];
  /** Container `normalizedName`s by category key (the containers layer's categories); unlisted ones are "general". */
  containerGroups: Record<string, string[]>;
  /** Containers without an icon of their own borrow a close one. */
  containerIconAlias: Record<string, string>;
  /** Boss icon stems by mob `normalizedName`; others use `spawn_boss`. */
  bossIcons: Record<string, string>;
  /** Boss filter groups that start off: normalized names, "pmcs", and raw mob ids when a mob has no lookup. */
  bossOff: string[];
};

/** Battle Pass document items (tarkov.dev ids) by group; each map spawns two of these. Season-specific. */
const documents: DocumentType[] = [
  { key: "financial", label: "Financial", item: "6a31807f17005505b70d5827", tint: "#7cc39a" },
  { key: "project", label: "Project", item: "6a3181f178450ec91c0ea1aa", tint: "#dbb36b" },
  { key: "blueprints", label: "Blueprints", item: "6a31824878450ec91c0ea1ae", tint: "#6fa8dc" },
  { key: "test", label: "Test", item: "6a31828557705071410ca00e", tint: "#a78bd6" },
  { key: "user", label: "User", item: "6a3182b72fd891345e047eef", tint: "#5fc4c0" },
  { key: "medical", label: "Medical", item: "6a3182dc6cd8de21cf0a3a7d", tint: "#e37b6c" },
  { key: "technical", label: "Technical", item: "6a31830dde69ceafd805afa0", tint: "#e8985a" },
  { key: "personnel", label: "PMC personnel", item: "6a317b9692cfdcddcb02a58e", tint: "#d98fb3" },
];

const containerGroups: Record<string, string[]> = {
  valuables: ["safe", "bank-safe", "shturmans-stash", "pc-block", "weapon-box", "cash-register", "bank-cash-register", "jacket", "plastic-suitcase"],
  medical: ["medbag", "medcase", "medical-supply-crate"],
  ammo: ["grenade-box", "wooden-ammo-box"],
  caches: ["buried-barrel-cache", "ground-cache"],
  supply: ["technical-supply-crate", "ration-supply-crate"],
  bodies: ["dead-scav", "scav-body", "pmc-body", "civilian-body", "lab-technician-body"],
};

/** Category key of a container type in a preset. */
export const containerGroup = (preset: Pick<MarkerPreset, "containerGroups">, name: string) =>
  Object.entries(preset.containerGroups).find(([, names]) => names.includes(name))?.[0] ?? "general";

/** Container categories that start off. */
const containerOff = new Set(["supply", "bodies", "general"]);
const bossOff = ["pmcs", "raider", "rogue", "black-div", "af", "pmcBot", "exUsec", "arenaFighter", "arenaFighterEvent"];

export const tarkovPreset: MarkerPreset = {
  layers: [
    { key: "extracts", label: "Extracts", icon: "extract_pmc", allFloors: true, groups: [
      { key: "pmc", label: "PMC", icon: "extract_pmc" },
      { key: "scav", label: "Scav", icon: "extract_scav" },
      { key: "transit", label: "Transit", icon: "extract_transit" },
    ] },
    { key: "spawns", label: "Spawns", icon: "spawn_pmc", groups: [
      { key: "pmc", label: "PMC", icon: "spawn_pmc" },
      { key: "scav", label: "Scav", icon: "spawn_scav" },
    ] },
    // One group per boss type on the map, filled in by `layersFor`.
    { key: "bosses", label: "Bosses", icon: "spawn_boss", folded: true, groups: [] },
    { key: "hazards", label: "Hazards", icon: "hazard", folded: true, groups: [
      { key: "minefield", label: "Minefields", icon: "hazard" },
      { key: "sniper", label: "Sniper zones", icon: "hazard" },
      { key: "artillery", label: "Artillery", icon: "hazard_mortar" },
      { key: "other", label: "Other", icon: "hazard" },
    ] },
    // One group per container type on the map, filled in by `layersFor`.
    { key: "containers", label: "Containers", icon: "container_safe", folded: true, groups: [], categories: [
      { key: "valuables", label: "Valuables", icon: "container_safe" },
      { key: "medical", label: "Medical", icon: "container_medbag" },
      { key: "ammo", label: "Ammo & grenades", icon: "container_grenade-box" },
      { key: "caches", label: "Caches", icon: "container_buried-barrel-cache" },
      { key: "supply", label: "Supply crates", icon: "container_crate" },
      { key: "bodies", label: "Bodies", icon: "container_dead-scav" },
      { key: "general", label: "General", icon: "container_duffle-bag" },
    ] },
    { key: "access", label: "Keys & switches", icon: "key", folded: true, groups: [
      { key: "door", label: "Locked doors", icon: "lock" },
      { key: "trunk", label: "Locked trunks", icon: "lock" },
      { key: "switch", label: "Switches", icon: "switch" },
    ] },
    { key: "other", label: "Weapons & BTR", icon: "stationarygun", folded: true, groups: [
      { key: "stationary", label: "Stationary guns", icon: "stationarygun" },
      { key: "btr", label: "BTR stops", icon: "btr_stop" },
    ] },
    { key: "documents", label: "Battle Pass documents", icon: "quest_item", groups: documents.map(({ key, label, item, tint }) => ({ key, label, tint, icon: `item:${item}` })) },
    // With item enrichment, one group per item category its spawns may hold, filled in by `layersFor`.
    { key: "loose", label: "Loose loot", icon: "loose_loot", off: true, folded: true, groups: [
      { key: "loose", label: "Loose loot", icon: "loose_loot" },
    ] },
  ],
  dynamic: {
    bosses: { off: (group) => bossOff.includes(group), legacy: ["bosses", "raiders"] },
    containers: { off: (group) => containerOff.has(containerGroup({ containerGroups }, group)), legacy: ["valuables", "medical", "ammo", "caches", "supply", "bodies", "general"] },
    loose: { off: () => true, legacy: [] },
  },
  factional: ["extracts", "spawns"],
  documents,
  containerGroups,
  containerIconAlias: {
    "bank-safe": "safe", "shturmans-stash": "safe", "bank-cash-register": "cash-register",
    "technical-supply-crate": "crate", "ration-supply-crate": "crate", "medical-supply-crate": "crate",
    "scav-body": "dead-scav", "pmc-body": "dead-scav", "civilian-body": "dead-scav", "lab-technician-body": "dead-scav",
  },
  bossIcons: {
    "cultist-priest": "spawn_cultist-priest", rogue: "spawn_rogue", raider: "spawn_rogue",
    "black-div": "spawn_black-div", af: "spawn_af", bear: "spawn_pmc", usec: "spawn_pmc",
  },
  bossOff,
};
