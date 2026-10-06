import type { TarkovDataMode } from "@/types/common";
import type { QuestWorkspaceIndexData } from "@/types/quest-workspace";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import { toQuestSummary } from "../../lib/quests/quest-summary";
import { prepareQuestDataForMode } from "../../lib/quests/quest-preparation";
import { prepareQuestsForDisplay } from "../../lib/quests/removed-quests";
import { orderQuestsByPrerequisites } from "../../lib/quests/quest-ordering";
import { getDefaultRepository } from "./query-utils";
import type { QuestWorkspaceQueryOptions } from "./getQuestWorkspacePageData";

/** No item, offer, price, reward, or full objective reads on the workspace entry path. */
export async function getQuestWorkspaceIndex(
	mode: TarkovDataMode,
	repository?: TarkovDataRepository,
	options: Omit<QuestWorkspaceQueryOptions, "includePrices"> = {},
): Promise<QuestWorkspaceIndexData> {
	try {
		const repo = repository ?? (await getDefaultRepository());
		if (!repo.quests.getIndexSource) throw new Error("Quest index projection is unavailable");
		const source = await repo.quests.getIndexSource(mode);
		const quests = orderQuestsByPrerequisites([
			...prepareQuestsForDisplay(prepareQuestDataForMode(source.data, mode), options.showRemovedQuests ?? false),
			...(options.displayQuestAdditions ?? []),
		]);
		return { quests: quests.map(toQuestSummary), updatedAt: source.updatedAt, error: null };
	} catch {
		return { quests: null, updatedAt: null, error: "Quest index could not be loaded." };
	}
}
