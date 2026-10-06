import type { QuestAvailabilityQuest } from "@/lib/quests/quest-availability";
import type { Station } from "./hideout";
import type { QuestObjectiveItemType } from "./quests";

export type UploaderQuest = QuestAvailabilityQuest & {
	name: string;
	normalizedName: string;
	objectives: QuestObjectiveItemType[];
};

/** Requirement metadata only: no item catalog or prices. */
export interface UploaderSummaryData {
	stations: Station[];
	quests: UploaderQuest[];
}
