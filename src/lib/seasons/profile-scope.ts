import type { GameMode } from "../game-mode";
import { FIRST_SEASON_ID, type SeasonId } from "../cfg/seasons";
export type ProfileStorageScope = GameMode | `KORD:${SeasonId}`;
export function profileStorageScope(mode: GameMode, seasonId: SeasonId = FIRST_SEASON_ID): ProfileStorageScope {
	return mode === "KORD" && seasonId !== FIRST_SEASON_ID ? `KORD:${seasonId}` : mode;
}
