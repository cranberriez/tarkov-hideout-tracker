// Shapes of the tarkov.dev map documents (`/<mode>/maps`, one map each) with translation keys already replaced
// by English names. Only fields the map uses are typed; the documents carry more.
import type { Vec3 } from "./types";

export type { Vec3 };

/** tarkov.dev data set. */
export type DataMode = "pve" | "regular" | "pvp-season";

/** Volume: footprint polygon in world x/z plus a height band. */
export type Zone = { position: Vec3; outline?: Vec3[]; top?: number; bottom?: number };

/** An item handed over to use an extract; roubles (and other currencies) are items too. */
export type TransferItem = { item: string; count: number };

export type Extract = Zone & {
  id: string;
  name: string;
  faction: "pmc" | "scav" | "shared" | string;
  switch?: boolean;
  switches?: string[];
  transferItem?: TransferItem | null;
};

/** `map` is the destination map's id. */
export type Transit = Zone & { id: string; description: string; map: string; conditions?: string | null };
export type Spawn = { position: Vec3; sides: string[]; categories: string[]; zoneName: string };
export type Lock = { id: string; lockType: string; key: string; needsPower: boolean; position: Vec3 };
export type Hazard = Zone & { id?: string; hazardType: string; name: string };
export type MapSwitch = Zone & { id: string; name: string; switchType: string; activatedBy: unknown; activates: unknown[] };
export type ContainerSpawn = { lootContainer: string; position: Vec3 };
/** `categories` are keys into `GameMapData.looseCategories`; present only with item enrichment on (see `src-tauri/src/loose_loot.rs`). */
export type LooseLoot = { position: Vec3; items: string[]; categories?: string[] };
export type BossSpawn = {
  /** Mob id, a key into `mobs.json`. */
  mob: string;
  spawnChance: number;
  spawnLocations?: { name: string; chance: number; positions?: Vec3[] }[];
  escorts?: { mob: string; amount: { chance: number; count: number }[] }[];
  /** Seconds into the raid; -1 at the start. */
  spawnTime?: number;
  spawnTimeRandom?: boolean;
  spawnTrigger?: string | null;
};
/** `stationaryWeapon` is a key into `CommonData.stationaryWeapons`. */
export type StationaryWeaponSpawn = { stationaryWeapon: string; position: Vec3 };
/** BTR stops carry x/y/z flat rather than under `position`. */
export type BtrStop = { name: string; x: number; y: number; z: number };
/** `botom` is tarkov.dev's spelling. */
export type ArtilleryZone = Zone & { id?: string; size?: Vec3; botom?: number };

/** A loose loot category; `icon` is an image link or `item:<id>`, a top-level category has no parent. */
export type LooseCategory = { label: string; icon?: string | null; parent?: string | null };

export type GameMapData = {
  id: string;
  name: string;
  normalizedName: string;
  nameId: string;
  scenePath: string;
  wiki: string;
  raidDuration: number;
  players: string;
  /** Degrees from world axes to the in-game compass. */
  coordinateToCardinalRotation: number;
  enemies: string[];
  bosses: BossSpawn[];
  spawns: Spawn[];
  extracts: Extract[];
  transits: Transit[];
  locks: Lock[];
  hazards: Hazard[];
  switches: MapSwitch[];
  lootContainers: ContainerSpawn[];
  lootLoose: LooseLoot[];
  /** The categories `lootLoose` uses, and their parents, by key. */
  looseCategories?: Record<string, LooseCategory>;
  stationaryWeapons: StationaryWeaponSpawn[];
  btrStops: BtrStop[];
  artillery?: { zones?: ArtilleryZone[] } | null;
  minPlayerLevel: number;
  maxPlayerLevel: number;
  accessKeys: string[];
  accessKeysMinPlayerLevel: number;
};

export type LootContainer = { id: string; name: string; normalizedName: string };
export type StationaryWeapon = { id: string; name: string; shortName: string; normalizedName: string };

export type CommonData = {
  lootContainers: Record<string, LootContainer>;
  stationaryWeapons: Record<string, StationaryWeapon>;
  goonReports: { map: string; timestamp: string }[];
};

/** One `mobs.json` entry (boss, follower, PMC bot), keyed by mob id such as "bossBully". */
export type Mob = {
  id: string; name: string; normalizedName: string; imagePortraitLink?: string; imagePosterLink?: string;
  health?: { bodyPart: string; id: string; max: number }[];
  /** Loadout tree of `{ attributes, contains?, count, item }`, item ids. */
  equipment?: unknown[];
  items?: { id: string; attributes?: { difficulty?: string; prevalence?: number } }[];
};
