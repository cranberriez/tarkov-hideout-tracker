import type { ItemRelationsPayload } from "@/types/contracts";
import type { PlayerProfileState } from "@/lib/stores/useUserStore";
import type { QuestItemDeriveOptions } from "@/lib/quests/quest-item-index";
import { deriveQuestAnyOfGroups, deriveQuestItemState } from "../../lib/quests/quest-item-index";
import { summarizeItemDetailDemand } from "../../features/items/item-detail/item-detail-summary";
import { computeNeeds } from "../../lib/utils/item-needs";

export function deriveItemPreviewDemand(
	itemId: string,
	relations: ItemRelationsPayload,
	profile: Pick<PlayerProfileState, "stationLevels" | "completedRequirements" | "itemCounts">,
	questOptions: Omit<QuestItemDeriveOptions, "quests">,
) {
	if (
		!relations.item ||
		relations.unresolvedItemIds.includes(itemId) ||
		relations.errors.items ||
		relations.errors.stations ||
		relations.errors.quests
	)
		return null;
	const options = { ...questOptions, quests: relations.questAvailabilityQuests };
	const entry = relations.questItemIndex.find((entry) => entry.itemId === itemId);
	const groups = deriveQuestAnyOfGroups(relations.questAnyOfGroups, options).filter((group) =>
		group.itemIds.includes(itemId),
	);
	const summary = summarizeItemDetailDemand({
		stationRequirements: [
			[
				"hideout",
				relations.hideoutRequirements.map((relation) => ({
					count: relation.requirement.count,
					isFir: relation.requirement.isFir,
					requirementId: relation.requirement.id,
					isCompleted: (profile.stationLevels[relation.station.id] ?? 0) >= relation.level,
				})),
			],
		],
		completedRequirements: profile.completedRequirements,
		questItemState: entry ? deriveQuestItemState(entry, options) : null,
	});
	const owned = profile.itemCounts[itemId] ?? { have: 0, haveFir: 0 };
	return {
		...summary,
		...computeNeeds({
			totalRequired: summary.totalRequiredCount,
			requiredFir: summary.totalRequiredFirCount,
			haveNonFir: owned.have,
			haveFir: owned.haveFir,
		}),
		hasAlternatives: groups.some((group) => group.status !== "completed" && group.requiredCount > 0),
	};
}
