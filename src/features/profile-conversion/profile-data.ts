import type { PlayerProfileState } from "../../lib/stores/useUserStore";
import { STATIC_STATIONS } from "../../lib/data/static-stations";

// Match setup metadata without waiting for the conversion query to load.
const STASH_ID = STATIC_STATIONS.find((station) => station.normalizedName === "stash")?.id;

export function hasProfileData(profile: PlayerProfileState) {
	const hasStationProgress = Object.entries(profile.stationLevels).some(
		([id, level]) => level > (id === STASH_ID ? 1 : 0),
	);
	const hasItems = Object.values(profile.itemCounts).some(({ have, haveFir }) => have !== 0 || haveFir !== 0);
	const hasQuestProgress = [
		profile.completedQuests,
		profile.completedRequirements,
		profile.failedQuests,
		profile.questsWithItems,
		profile.pinnedQuests,
	].some((record) => Object.values(record).some(Boolean));

	return (
		profile.hasCompletedSetup ||
		profile.gameEdition !== null ||
		profile.playerLevel > 1 ||
		profile.prestigeLevel > 0 ||
		profile.questFenceReputation !== 0 ||
		Object.values(profile.questTraderLoyaltyLevels).some((level) => level > 1) ||
		hasStationProgress ||
		hasItems ||
		hasQuestProgress ||
		profile.questChangeHistory.length > 0 ||
		Object.values(profile.completedQuestObjectives).some((objectives) => Object.values(objectives).some(Boolean)) ||
		profile.questShowKappa ||
		profile.questShowLightkeeper
	);
}
