import data from "./calibration.json";
import type { GameMap, MapCalibration } from "./types";

export const mapSources = data.source;
export const maps = data.maps as unknown as Record<string, MapCalibration>;
export const games = data.games as GameMap[];

/** A map identifier lowercased and trimmed, without the `maps/<scene>.bundle` wrapping scene paths have in logs. */
export const normalizeMapName = (name: string) => name.trim().toLowerCase().replace(/^maps\//, "").replace(/\.bundle$/, "");

const byAlias = new Map<string, GameMap>();
for (const game of games) {
  for (const alias of [game.key, game.nameId, game.scene, game.name]) byAlias.set(normalizeMapName(alias), game);
}

/**
 * The game map for any identifier it goes by: tarkov.dev key ("customs"), location id ("bigmap"),
 * scene ("customs_preset", "maps/customs_preset.bundle") or English name ("Customs"). Case-insensitive.
 */
export function resolveGame(name: string | null | undefined): GameMap | null {
  return name ? byAlias.get(normalizeMapName(name)) ?? null : null;
}

/** Art calibration for any game map identifier, or a calibration key. */
export function resolveMap(name: string | null | undefined): MapCalibration | null {
  const art = resolveGame(name)?.art ?? (name ? normalizeMapName(name) : null);
  return art ? maps[art] ?? null : null;
}

/** English name for a map identifier; unknown identifiers are returned as given. */
export function mapName(name: string | null | undefined): string | null {
  return name ? resolveGame(name)?.name ?? name : null;
}
