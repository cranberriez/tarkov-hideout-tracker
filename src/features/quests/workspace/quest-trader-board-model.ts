import type { QuestWorkspaceQuest } from "@/types/quests";
import { compareQuestTradersByOrder } from "../../../lib/cfg/questTraderOrder";
import { getQuestTraderTabLoyaltyLevel } from "../../../lib/quests/quest-trader-completion-gates";
import { isEssentialQuest } from "../../../lib/quests/quest-series";
import { buildEssentialQuestSeries, type QuestWorkspaceStatusInfo } from "./quest-workspace-utils";

export type TraderBoardSectionKey = 1 | 2 | 3 | 4 | "essential";

export interface TraderBoardGroup {
	id: string;
	/** Essential series name; `null` for a loyalty level or ungrouped Essential quests. */
	title: string | null;
	/** Display order including resolved quests: series chain order, otherwise active → upcoming → locked → resolved. */
	questIds: string[];
}

export interface TraderBoardSection {
	id: string;
	key: TraderBoardSectionKey;
	groups: TraderBoardGroup[];
	/** Completed and failed quests, folded behind a count. */
	doneQuestIds: string[];
	totalCount: number;
}

export interface TraderBoardColumn {
	trader: QuestWorkspaceQuest["trader"];
	sections: TraderBoardSection[];
	doneCount: number;
	totalCount: number;
}

export interface BuildQuestTraderBoardOptions {
	quests: readonly QuestWorkspaceQuest[];
	statusByQuestId: ReadonlyMap<string, QuestWorkspaceStatusInfo>;
	upcomingLockedQuestIds: ReadonlySet<string>;
	hiddenQuests: Readonly<Record<string, boolean>>;
	pinnedQuests?: Readonly<Record<string, boolean>>;
	showPinnedOnly?: boolean;
	questOrderById: ReadonlyMap<string, number>;
}

/**
 * Whole-profile overview: honors pinned-only visibility, but otherwise ignores workspace filters and leaves out quests the player can never
 * take (removed, other faction, excluded branch) or chose to hide.
 */
export function buildQuestTraderBoard({
	quests,
	statusByQuestId,
	upcomingLockedQuestIds,
	hiddenQuests,
	pinnedQuests,
	showPinnedOnly,
	questOrderById,
}: BuildQuestTraderBoardOptions): TraderBoardColumn[] {
	const isDone = (questId: string) => !!statusByQuestId.get(questId)?.terminal;
	const rank = (questId: string) => {
		if (isDone(questId)) return 3;
		if (statusByQuestId.get(questId)?.status === "active") return 0;
		return upcomingLockedQuestIds.has(questId) ? 1 : 2;
	};
	const order = (questId: string) => questOrderById.get(questId) ?? Number.MAX_SAFE_INTEGER;
	const byStatus = (questIds: string[]) =>
		questIds.sort((left, right) => rank(left) - rank(right) || order(left) - order(right));
	// Same series as the list's Essential category, so chains read in order instead of by status.
	const essentialSeries = buildEssentialQuestSeries(quests.filter((quest) => isEssentialQuest(quest.id)));
	const questsByTraderId = new Map<string, QuestWorkspaceQuest[]>();

	for (const quest of quests) {
		if (showPinnedOnly && !pinnedQuests?.[quest.id]) continue;
		const status = statusByQuestId.get(quest.id);
		if (!status || quest.removed || hiddenQuests[quest.id]) continue;
		const unreachable =
			!status.terminal && status.reasons.some((reason) => reason.kind === "faction" || reason.kind === "branch");
		if (unreachable) continue;
		questsByTraderId.set(quest.trader.id, [...(questsByTraderId.get(quest.trader.id) ?? []), quest]);
	}

	const buildGroups = (sectionId: string, key: TraderBoardSectionKey, questIds: string[]): TraderBoardGroup[] => {
		if (key !== "essential") return [{ id: sectionId, title: null, questIds: byStatus(questIds) }];

		const sectionQuestIds = new Set(questIds);
		const groups: TraderBoardGroup[] = [];
		for (const series of essentialSeries) {
			const seriesQuestIds = series.questIds.filter((questId) => sectionQuestIds.has(questId));
			if (seriesQuestIds.length === 0) continue;
			groups.push({ id: `${sectionId}:${series.id}`, title: series.title, questIds: seriesQuestIds });
			for (const questId of seriesQuestIds) sectionQuestIds.delete(questId);
		}
		if (sectionQuestIds.size > 0) {
			groups.push({ id: `${sectionId}:ungrouped`, title: null, questIds: byStatus([...sectionQuestIds]) });
		}
		return groups;
	};

	return [...questsByTraderId.values()]
		.map((traderQuests) => {
			const trader = traderQuests[0].trader;
			const questIdsByKey = new Map<TraderBoardSectionKey, string[]>();
			for (const quest of traderQuests) {
				const key: TraderBoardSectionKey = isEssentialQuest(quest.id)
					? "essential"
					: getQuestTraderTabLoyaltyLevel(quest);
				questIdsByKey.set(key, [...(questIdsByKey.get(key) ?? []), quest.id]);
			}

			const sections = [...questIdsByKey.entries()]
				.sort(([left], [right]) => {
					if (left === "essential") return 1;
					if (right === "essential") return -1;
					return left - right;
				})
				.map(([key, questIds]): TraderBoardSection => {
					const id = `${trader.id}:${key}`;
					return {
						id,
						key,
						groups: buildGroups(id, key, questIds),
						doneQuestIds: questIds.filter(isDone).sort((left, right) => order(left) - order(right)),
						totalCount: questIds.length,
					};
				});
			const doneCount = sections.reduce((total, section) => total + section.doneQuestIds.length, 0);

			return { trader, sections, doneCount, totalCount: traderQuests.length };
		})
		.sort((left, right) => compareQuestTradersByOrder(left.trader.name, right.trader.name));
}
