import type { GameEdition, PlayerProfileState } from "@/lib/stores/useUserStore";

const EDITION_GRANTED_UPGRADES: Record<GameEdition, number> = {
    Standard: 0,
    "Left Behind": 1,
    "Prepare for Escape": 2,
    "Edge of Darkness": 3,
    Unheard: 4,
};

export function countCompletedQuests(profile: PlayerProfileState) {
    return Object.values(profile.completedQuests).filter(Boolean).length;
}

export function countCompletedHideoutUpgrades(profile: PlayerProfileState) {
    const currentLevels = Object.values(profile.stationLevels).reduce(
        (total, level) => total + Math.max(0, level),
        0,
    );
    const editionGranted = profile.gameEdition
        ? EDITION_GRANTED_UPGRADES[profile.gameEdition]
        : 0;

    // Stash level 1 is the standard baseline and is not an earned upgrade.
    return Math.max(0, currentLevels - 1 - editionGranted);
}
