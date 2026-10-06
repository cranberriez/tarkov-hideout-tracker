import type { GameEdition } from "../stores/useUserStore";
import { STATION_IDS, type StationSlug } from "../data/static-stations";

/** A starting perk granted by a game edition. New kinds extend this union and the switch below. */
export type EditionBonus = { kind: "stationLevel"; station: StationSlug; level: number };

const stationLevel = (station: StationSlug, level: number): EditionBonus => ({ kind: "stationLevel", station, level });

/** Starting bonuses per edition. Key order is the display order. */
export const EDITION_BONUSES: Readonly<Record<GameEdition, readonly EditionBonus[]>> = {
	Standard: [stationLevel("stash", 1)],
	"Left Behind": [stationLevel("stash", 2)],
	"Prepare for Escape": [stationLevel("stash", 3)],
	"Edge of Darkness": [stationLevel("stash", 4)],
	Unheard: [stationLevel("stash", 4), stationLevel("cultist-circle", 1)],
};

export const GAME_EDITIONS = Object.keys(EDITION_BONUSES) as GameEdition[];

/** Profiles without a chosen edition get this edition's baseline. */
export const BASELINE_EDITION: GameEdition = "Standard";

/**
 * Bonus levels are floors: a higher level the player set is kept, and switching to a
 * lower edition never lowers a station. Only stations in the loaded data are touched.
 * Returns the input object unchanged when no bonus applies.
 */
export function applyEditionStationBonuses(
	stationLevels: Readonly<Record<string, number>>,
	edition: GameEdition | null,
	availableStationIds: ReadonlySet<string>,
): Readonly<Record<string, number>> {
	let next: Record<string, number> | null = null;
	for (const bonus of EDITION_BONUSES[edition ?? BASELINE_EDITION]) {
		switch (bonus.kind) {
			case "stationLevel": {
				const stationId = STATION_IDS[bonus.station];
				if (!availableStationIds.has(stationId) || (stationLevels[stationId] ?? 0) >= bonus.level) break;
				next ??= { ...stationLevels };
				next[stationId] = bonus.level;
				break;
			}
		}
	}
	return next ?? stationLevels;
}
