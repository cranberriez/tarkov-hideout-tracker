import { toQuestAvailabilityQuest } from "../../lib/quests/quest-availability";
import { prepareQuestDataForMode } from "../../lib/quests/quest-preparation";
import { excludeRemovedQuests } from "../../lib/quests/removed-quests";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { QuestObjectiveItemType } from "@/types/quests";
import type { UploaderSummaryData } from "@/types/uploader";
import { getDefaultRepository } from "./query-utils";

export async function getUploaderSummaryData(
	mode: TarkovDataMode,
	repository?: TarkovDataRepository,
): Promise<UploaderSummaryData> {
	const source = repository ?? (await getDefaultRepository());
	// Both sources must succeed: absent requirements must never look like surplus.
	const [stations, quests] = await Promise.all([source.hideout.getStations(mode), source.quests.getAll(mode)]);
	return {
		stations: stations.data,
		quests: excludeRemovedQuests(prepareQuestDataForMode(quests.data, mode)).map((quest) => ({
			...toQuestAvailabilityQuest(quest),
			name: quest.name,
			normalizedName: quest.normalizedName,
			objectives: quest.objectives
				.filter(
					(objective): objective is QuestObjectiveItemType =>
						(objective.type === "giveItem" || objective.type === "plantItem") && "itemIds" in objective,
				)
				.map(
					({ id, type, description, optional, count, foundInRaid, itemIds, itemScope, isPartial, totalItemCount }) => ({
						id,
						type,
						description,
						optional,
						count,
						foundInRaid,
						itemIds,
						itemScope,
						isPartial,
						totalItemCount,
					}),
				),
		})),
	};
}
