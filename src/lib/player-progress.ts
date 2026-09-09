import type { PlayerProfileState } from "./stores/useUserStore";

/** Explicit allowlist: never include view preferences or planning filters. */
export const PROGRESS_KEYS = [
	"stationLevels",
	"completedRequirements",
	"completedQuests",
	"completedQuestObjectives",
	"failedQuests",
	"questsWithItems",
	"questChangeHistory",
	"itemCounts",
	"playerLevel",
	"prestigeLevel",
	"questTraderLoyaltyLevels",
	"questFenceReputation",
	"questFaction",
	"gameEdition",
	"editionBonusesAppliedFor",
	"hasCompletedSetup",
] as const satisfies readonly (keyof PlayerProfileState)[];

export type PlayerProgress = Pick<PlayerProfileState, (typeof PROGRESS_KEYS)[number]>;

export function pickPlayerProgress(profile: PlayerProfileState): PlayerProgress {
	return Object.fromEntries(PROGRESS_KEYS.map((key) => [key, profile[key]])) as PlayerProgress;
}
