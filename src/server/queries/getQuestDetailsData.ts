import { CUSTOM_QUEST_MANIFEST, getCustomQuestAnchorIds } from "../../lib/quests/custom-quests";
import { prepareQuestDataForMode } from "../../lib/quests/quest-preparation";
import { prepareQuestsForDisplay } from "../../lib/quests/removed-quests";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { QuestDetailsData } from "@/types/quest-workspace";
import type { FullQuest } from "@/types/quests";
import { getDefaultRepository } from "./query-utils";
import { getQuestWorkspaceItemIds, toQuestWorkspaceItem } from "./quest-workspace-items";

export type { QuestDetailsData } from "@/types/quest-workspace";

export interface QuestDetailsQueryOptions {
	showRemovedQuests?: boolean;
	displayQuestAdditions?: readonly FullQuest[];
}

export async function getQuestDetailsData(
	mode: TarkovDataMode,
	questIds: readonly string[],
	repository?: TarkovDataRepository,
	options: QuestDetailsQueryOptions = {},
): Promise<QuestDetailsData> {
	const requestedQuestIds = [...new Set(questIds)].sort();
	const requested = new Set(requestedQuestIds);
	const applicableCustomDefs = CUSTOM_QUEST_MANIFEST.quests.filter(
		(def) => requested.has(def.id) && (!def.modes || def.modes.includes(mode)),
	);
	const readIds = [
		...new Set([
			...requestedQuestIds.flatMap((id) => [id, ...getCustomQuestAnchorIds(id, mode)]),
			...applicableCustomDefs.flatMap((def) => def.requires ?? []),
		]),
	];
	const dataRepository = repository ?? (await getDefaultRepository());
	const questsResult = await Promise.allSettled([dataRepository.quests.getByIds(mode, readIds)]).then(
		([result]) => result,
	);

	if (questsResult.status === "rejected") {
		return {
			quests: null,
			items: null,
			requestedQuestIds,
			unresolvedQuestIds: requestedQuestIds,
			unresolvedItemIds: [],
			errors: {
				quests: "Quest details could not be loaded.",
				items: "Quest item data could not be loaded without quests.",
			},
			freshness: { questsUpdatedAt: null, itemsUpdatedAt: null },
		};
	}

	const prepared = prepareQuestsForDisplay(
		prepareQuestDataForMode(Object.values(questsResult.value.data), mode),
		options.showRemovedQuests ?? false,
	);
	const additions = options.displayQuestAdditions ?? [];
	const byId = new Map([...prepared, ...additions].map((quest) => [quest.id, quest]));
	const quests = requestedQuestIds.flatMap((id) => {
		const quest = byId.get(id);
		return quest && requested.has(quest.id) ? [quest] : [];
	});
	const unresolvedQuestIds = requestedQuestIds.filter((id) => !byId.has(id));
	const itemIds = getQuestWorkspaceItemIds(quests);
	const itemsResult = await Promise.allSettled([
		dataRepository.items.getByIds(mode, itemIds, { includeOffers: false }),
	]).then(([result]) => result);

	if (itemsResult.status === "rejected") {
		return {
			quests,
			items: null,
			requestedQuestIds,
			unresolvedQuestIds,
			unresolvedItemIds: itemIds,
			errors: { quests: null, items: "Quest item summaries could not be loaded." },
			freshness: { questsUpdatedAt: questsResult.value.updatedAt, itemsUpdatedAt: null },
		};
	}

	const items = itemIds.flatMap((id) => {
		const item = itemsResult.value.data[id];
		return item ? [toQuestWorkspaceItem(item)] : [];
	});
	return {
		quests,
		items,
		requestedQuestIds,
		unresolvedQuestIds,
		unresolvedItemIds: itemIds.filter((id) => !itemsResult.value.data[id]),
		errors: { quests: null, items: null },
		freshness: {
			questsUpdatedAt: questsResult.value.updatedAt,
			itemsUpdatedAt: itemsResult.value.updatedAt,
		},
	};
}
