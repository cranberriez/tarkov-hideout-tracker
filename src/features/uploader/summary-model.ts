import {
	buildQuestAnyOfGroups,
	buildQuestItemIndex,
	deriveQuestAnyOfGroups,
	deriveQuestItemStates,
} from "../../lib/quests/quest-item-index";
import type { PlayerProfileState } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";
import type { UploaderSummaryData } from "@/types/uploader";
import { isCurrencyItem } from "../hideout/station-model";
import { summarizeReview, type ReviewEntry } from "./review-model";

export interface SaveReason {
	id: string;
	kind: "hideout" | "quest";
	label: string;
	count: number;
	firCount: number;
	tool?: boolean;
	choice?: boolean;
}

export type SummaryCategory = "save" | "needed" | "review" | "pricing";
export interface SummaryRow {
	item: ItemSummary;
	quantity: number;
	foundInRaid: ReviewEntry["foundInRaid"];
	category: SummaryCategory;
	reasons: SaveReason[];
}

export function buildUploaderSummary(
	entries: readonly ReviewEntry[],
	items: readonly ItemSummary[],
	data: UploaderSummaryData,
	profile: Pick<
		PlayerProfileState,
		| "stationLevels"
		| "completedRequirements"
		| "completedQuests"
		| "completedQuestObjectives"
		| "failedQuests"
		| "ignoredQuests"
		| "playerLevel"
		| "prestigeLevel"
		| "questFaction"
		| "questTraderLoyaltyLevels"
		| "questFenceReputation"
	>,
) {
	const summary = summarizeReview(entries, items);
	const reasons = new Map<string, SaveReason[]>();
	const add = (itemId: string, reason: SaveReason) => reasons.set(itemId, [...(reasons.get(itemId) ?? []), reason]);
	const catalog = new Map(items.map((item) => [item.id, item]));
	for (const station of data.stations) {
		for (const level of station.levels) {
			if (level.level <= (profile.stationLevels[station.id] ?? 0)) continue;
			for (const requirement of level.itemRequirements) {
				if (profile.completedRequirements[requirement.id]) continue;
				add(requirement.itemId, {
					id: requirement.id,
					kind: "hideout",
					label: `${station.name} · Level ${level.level}`,
					count: requirement.count,
					firCount: requirement.isFir && !isCurrencyItem(catalog.get(requirement.itemId)) ? requirement.count : 0,
					tool: requirement.isTool,
				});
			}
		}
	}
	const quests = data.quests.map((quest) => ({
		...quest,
		objectives: quest.objectives.filter((objective) => !profile.completedQuestObjectives[quest.id]?.[objective.id]),
	}));
	const options = {
		completedQuests: profile.completedQuests,
		failedQuests: profile.failedQuests,
		ignoredQuests: profile.ignoredQuests,
		pinnedQuests: {},
		playerLevel: profile.playerLevel,
		prestigeLevel: profile.prestigeLevel,
		faction: profile.questFaction,
		traderLoyaltyLevels: profile.questTraderLoyaltyLevels,
		fenceReputation: profile.questFenceReputation,
		quests: data.quests,
		visibilityMode: "allFuture" as const,
	};
	for (const state of deriveQuestItemStates(buildQuestItemIndex(quests), options)) {
		for (const quest of state.relatedQuests)
			add(state.itemId, {
				id: quest.questId,
				kind: "quest",
				label: quest.questName,
				count: quest.requiredCount,
				firCount: quest.requiredFirCount,
			});
	}
	// Alternatives are reasons to review, never independent mandatory item counts.
	const groups = deriveQuestAnyOfGroups(buildQuestAnyOfGroups(quests), options);
	for (const group of groups) {
		for (const itemId of group.itemIds)
			add(itemId, {
				id: group.groupId,
				kind: "quest",
				label: `${group.questName} · One of several options`,
				count: group.requiredCount,
				firCount: group.requiredFirCount,
				choice: true,
			});
	}
	const rows: SummaryRow[] = [];
	const itemIds = [...new Set(summary.totals.map(({ item }) => item.id))];
	for (const itemId of itemIds) {
		const tags = reasons.get(itemId) ?? [];
		const required = tags.filter((reason) => !reason.choice && !reason.tool);
		const tools = tags.filter((reason) => reason.tool);
		let firNeed =
			required.reduce((sum, reason) => sum + reason.firCount, 0) +
			Math.max(0, ...tools.map((reason) => reason.firCount));
		let otherNeed =
			required.reduce((sum, reason) => sum + reason.count - reason.firCount, 0) +
			Math.max(0, ...tools.map((reason) => reason.count - reason.firCount));
		const stacks = summary.totals.filter(({ item }) => item.id === itemId).map((stack) => ({ ...stack }));
		const take = (stack: (typeof stacks)[number], quantity: number, category: SummaryCategory) => {
			if (quantity <= 0) return;
			rows.push({ ...stack, quantity, category, reasons: tags });
			stack.quantity -= quantity;
		};
		for (const stack of stacks.filter((stack) => stack.foundInRaid === "yes")) {
			const amount = Math.min(stack.quantity, firNeed);
			take(stack, amount, "save");
			firNeed -= amount;
		}
		for (const status of ["no", "unknown", "yes"] as const) {
			for (const stack of stacks.filter((stack) => stack.foundInRaid === status)) {
				// Do not spend an unverified FIR stack on replaceable demand while FIR demand remains.
				if (status === "unknown" && firNeed > 0) {
					take(stack, stack.quantity, "review");
					continue;
				}
				const amount = Math.min(stack.quantity, otherNeed);
				take(stack, amount, "needed");
				otherNeed -= amount;
				const hasChoice = tags.some((reason) => reason.choice && (reason.firCount === 0 || status !== "no"));
				take(stack, stack.quantity, hasChoice ? "review" : "pricing");
			}
		}
	}
	return { rows, unresolved: summary.unresolved, hasPartialChoices: groups.some((group) => group.isPartial) };
}
