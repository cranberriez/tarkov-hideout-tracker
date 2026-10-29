import type { GameMode } from "../game-mode";
import { FIRST_SEASON_ID, getSeason, type SeasonId } from "./seasons";

/** Compatibility configuration for the original KORD season. */
export const SEASONAL_CONFIG = {
	...getSeason(FIRST_SEASON_ID),
	name: getSeason(FIRST_SEASON_ID).title,
	mode: "KORD" as GameMode,
};

export function getSeasonalCraftingSettings(mode: GameMode, savedLevel: number, seasonId: SeasonId = FIRST_SEASON_ID) {
	const season = getSeason(seasonId);
	const forced = mode === "KORD" && season.forceEliteCrafting;
	return {
		craftingSkillLevel: forced ? 51 : savedLevel,
		craftingSkillForced: forced,
		craftingSkillNote: forced ? `Elite crafting is required for ${season.title}.` : undefined,
	};
}
