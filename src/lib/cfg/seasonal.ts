import type { GameMode } from "../game-mode";

// THIS IS FOR SEASON 1 KORD BREACH CONFIGURATION
// Update this configuration when the active season or its rules change.
export const SEASONAL_CONFIG = {
  name: "Season 1 KORD Breach",
  mode: "KORD" as GameMode,
  forceEliteCrafting: true,
};

export function getSeasonalCraftingSettings(mode: GameMode, savedLevel: number) {
  const forced = mode === SEASONAL_CONFIG.mode && SEASONAL_CONFIG.forceEliteCrafting;
  return {
    craftingSkillLevel: forced ? 51 : savedLevel,
    craftingSkillForced: forced,
    craftingSkillNote: forced ? `Elite crafting is required for ${SEASONAL_CONFIG.name}.` : undefined,
  };
}
