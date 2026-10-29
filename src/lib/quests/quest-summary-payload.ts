import { traderImageUrl, traderInfo } from "../data/traders";
import type { QuestSummary } from "../../types/quests";
import type { QuestSummaryPayload } from "../../types/quest-workspace";

/*
 * The quest index sends trader identities as IDs; names and images come from the bundled trader
 * list. Compact on the server read boundary, expand once per payload on the client.
 */

export function compactQuestSummary(quest: QuestSummary): QuestSummaryPayload {
	const { trader, traderRequirements, ...rest } = quest;
	return {
		...rest,
		traderId: trader.id,
		traderRequirements: traderRequirements.map(({ trader: required, ...requirement }) => ({
			...requirement,
			traderId: required.id,
		})),
	};
}

function expandTrader(id: string) {
	return { ...traderInfo(id), imageLink: traderImageUrl(id) };
}

const expanded = new WeakMap<readonly QuestSummaryPayload[], QuestSummary[]>();

/** Stable per payload array, so memoized consumers keep their identity across renders. */
export function expandQuestSummaries(quests: readonly QuestSummaryPayload[]): QuestSummary[] {
	const cached = expanded.get(quests);
	if (cached) return cached;
	const result = quests.map(({ traderId, traderRequirements, ...rest }) => ({
		...rest,
		trader: expandTrader(traderId),
		traderRequirements: traderRequirements.map(({ traderId: requiredId, ...requirement }) => ({
			...requirement,
			trader: expandTrader(requiredId),
		})),
	}));
	expanded.set(quests, result);
	return result;
}
