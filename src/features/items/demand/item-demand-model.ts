import {
	buildQuestAnyOfGroups,
	buildQuestItemIndex,
	deriveQuestAnyOfGroups,
	deriveQuestItemStates,
} from "../../../lib/quests/quest-item-index";
import type { PlayerProfileState } from "@/lib/stores/useUserStore";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { UploaderSummaryData } from "@/types/uploader";
import { isCurrencyItem } from "../../hideout/station-model";

export type DemandFoundInRaid = "yes" | "no" | "unknown";

export interface SaveReason {
	id: string;
	kind: "hideout" | "quest" | "kappa";
	label: string;
	count: number;
	firCount: number;
	tool?: boolean;
	/** Accepted item types of an any-of hand-in; absent for specific requirements. */
	options?: number;
	/** Scanned copies assigned to this any-of hand-in. */
	filled?: number;
	/** The next station level, or a quest that is available now. */
	now: boolean;
	minPlayerLevel?: number | null;
	/** The hideout station this use upgrades. */
	station?: Station;
	/** The quest this use hands in to; Kappa uses point at the Collector. */
	questId?: string;
}

/** Remaining specific demand for one item after saved inventory is applied. */
export interface ItemNeed {
	reasons: SaveReason[];
	required: number;
	owned: number;
	remaining: number;
}

export type SummaryCategory = "keep" | "surplus";
export interface SummaryRow {
	item: ItemSummary;
	quantity: number;
	foundInRaid: DemandFoundInRaid;
	category: SummaryCategory;
	/** Kept for FIR demand although the FIR badge was not confirmed. */
	firUnconfirmed?: boolean;
	/** Kept copies reserved for a Kappa (Collector) hand-in, which takes them before other demand. */
	kappa?: boolean;
}

/** Collector hand-ins come from the Kappa checklist rather than quest progress. */
export interface KappaDemand {
	questId: string;
	/** Kappa checklist items already handed in. */
	completed: Readonly<Record<string, boolean>>;
	/** The player is not collecting for Kappa. */
	ignored: boolean;
}

type OwnedCounts = Readonly<Record<string, { have: number; haveFir: number } | undefined>>;
export type DemandStack = { item: ItemSummary; quantity: number; foundInRaid: DemandFoundInRaid };

export type DemandProfile = Pick<
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
>;

/**
 * Splits `stacks` into kept and surplus copies against all remaining hideout, quest,
 * and Kappa demand, after `owned` copies cover that demand first.
 */
export function buildItemDemand(
	stacks: readonly DemandStack[],
	/** Catalog for requirement items that are not in `stacks`. */
	items: readonly ItemSummary[],
	data: UploaderSummaryData,
	profile: DemandProfile,
	owned: OwnedCounts = {},
	/** Per-unit value used to spend the cheapest accepted option first. */
	unitValue: (itemId: string) => number | undefined = () => undefined,
	kappa?: KappaDemand,
) {
	const reasons = new Map<string, SaveReason[]>();
	const add = (itemId: string, reason: SaveReason) => reasons.set(itemId, [...(reasons.get(itemId) ?? []), reason]);
	const catalog = new Map(items.map((item) => [item.id, item]));
	for (const station of data.stations) {
		const current = profile.stationLevels[station.id] ?? 0;
		for (const level of station.levels) {
			if (level.level <= current) continue;
			for (const requirement of level.itemRequirements) {
				if (profile.completedRequirements[requirement.id]) continue;
				add(requirement.itemId, {
					id: requirement.id,
					kind: "hideout",
					label: `${station.name} · Level ${level.level}`,
					count: requirement.count,
					firCount: requirement.isFir && !isCurrencyItem(catalog.get(requirement.itemId)) ? requirement.count : 0,
					tool: requirement.isTool,
					now: level.level === current + 1,
					station,
				});
			}
		}
	}
	const collector = kappa && data.quests.find((quest) => quest.id === kappa.questId);
	if (kappa && collector && !kappa.ignored && !profile.completedQuests[collector.id]) {
		for (const objective of collector.objectives) {
			if (objective.type !== "giveItem" || profile.completedQuestObjectives[collector.id]?.[objective.id]) continue;
			for (const itemId of new Set(objective.itemIds)) {
				if (kappa.completed[itemId]) continue;
				add(itemId, {
					id: `${collector.id}:${objective.id}`,
					kind: "kappa",
					label: "Kappa · The Collector",
					questId: collector.id,
					count: objective.count,
					firCount: objective.foundInRaid ? objective.count : 0,
					now: false,
					minPlayerLevel: collector.minPlayerLevel,
				});
			}
		}
	}
	const quests = data.quests
		.filter((quest) => quest.id !== kappa?.questId)
		.map((quest) => ({
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
		for (const quest of state.relatedQuests) {
			if (quest.status === "ignored" || quest.status === "completed") continue;
			add(state.itemId, {
				id: quest.questId,
				kind: "quest",
				label: quest.questName,
				questId: quest.questId,
				count: quest.requiredCount,
				firCount: quest.requiredFirCount,
				now: quest.status === "available",
				minPlayerLevel: quest.minPlayerLevel,
			});
		}
	}

	// Specific demand first, covered by saved inventory before any scanned copy.
	const needs = new Map<string, ItemNeed>();
	const spare = new Map<string, { fir: number; other: number }>();
	const demand = new Map<string, { fir: number; other: number }>();
	// FIR copies still owed to Kappa; owned FIR copies cover Kappa before anything else.
	const kappaLeft = new Map<string, number>();
	const resolve = (itemId: string) => {
		const known = demand.get(itemId);
		if (known) return known;
		const tags = reasons.get(itemId) ?? [];
		const consumed = tags.filter((reason) => !reason.tool);
		const tools = tags.filter((reason) => reason.tool);
		const firNeed =
			consumed.reduce((sum, reason) => sum + reason.firCount, 0) +
			Math.max(0, ...tools.map((reason) => reason.firCount));
		const otherNeed =
			consumed.reduce((sum, reason) => sum + reason.count - reason.firCount, 0) +
			Math.max(0, ...tools.map((reason) => reason.count - reason.firCount));
		const ownedFir = Math.max(0, owned[itemId]?.haveFir ?? 0);
		const ownedOther = Math.max(0, owned[itemId]?.have ?? 0);
		const firUsed = Math.min(ownedFir, firNeed);
		const otherFromOther = Math.min(ownedOther, otherNeed);
		const otherFromFir = Math.min(ownedFir - firUsed, otherNeed - otherFromOther);
		const remaining = { fir: firNeed - firUsed, other: otherNeed - otherFromOther - otherFromFir };
		const kappaFir = tags.reduce((sum, reason) => sum + (reason.kind === "kappa" ? reason.firCount : 0), 0);
		kappaLeft.set(itemId, Math.max(0, kappaFir - ownedFir));
		demand.set(itemId, remaining);
		spare.set(itemId, { fir: ownedFir - firUsed - otherFromFir, other: ownedOther - otherFromOther });
		needs.set(itemId, {
			reasons: tags,
			required: firNeed + otherNeed,
			owned: firUsed + otherFromOther + otherFromFir,
			remaining: remaining.fir + remaining.other,
		});
		return remaining;
	};

	const rows: SummaryRow[] = [];
	const keep = (stack: DemandStack, quantity: number, firUnconfirmed = false, kappa = false) => {
		if (quantity <= 0) return;
		rows.push({
			...stack,
			quantity,
			category: "keep",
			...(firUnconfirmed && { firUnconfirmed }),
			...(kappa && { kappa }),
		});
		stack.quantity -= quantity;
	};
	const pool: DemandStack[] = stacks.map((stack) => ({ ...stack }));
	for (const itemId of new Set(pool.map(({ item }) => item.id))) {
		const need = resolve(itemId);
		const stacks = pool.filter(({ item }) => item.id === itemId);
		const fill = (status: DemandFoundInRaid, fir: boolean) => {
			for (const stack of stacks.filter((stack) => stack.foundInRaid === status)) {
				const amount = Math.min(stack.quantity, fir ? need.fir : need.other);
				const forKappa = fir ? Math.min(amount, kappaLeft.get(itemId) ?? 0) : 0;
				kappaLeft.set(itemId, (kappaLeft.get(itemId) ?? 0) - forKappa);
				keep(stack, forKappa, fir && status === "unknown", true);
				keep(stack, amount - forKappa, fir && status === "unknown");
				if (fir) need.fir -= amount;
				else need.other -= amount;
			}
		};
		fill("yes", true);
		fill("no", false);
		// Unconfirmed FIR copies cover replaceable demand first, then any FIR demand left rather than risk a sale.
		fill("unknown", false);
		fill("unknown", true);
		fill("yes", false);
	}

	// Any-of hand-ins take the cheapest accepted copies left over; narrow choices go first.
	// The shared builder trims broad groups to a display preview; demand needs every accepted item.
	const objectiveItems = new Map<string, string[]>(
		quests.flatMap((quest) =>
			quest.objectives.map((objective): [string, string[]] => [
				`${quest.id}:${objective.id}`,
				[...new Set(objective.itemIds)],
			]),
		),
	);
	const groups = deriveQuestAnyOfGroups(
		buildQuestAnyOfGroups(quests).map((group) => ({
			...group,
			itemIds: objectiveItems.get(group.groupId) ?? group.itemIds,
			isPartial: false,
		})),
		options,
	)
		.filter((group) => group.status !== "ignored" && group.status !== "completed")
		.sort((a, b) => a.itemIds.length - b.itemIds.length);
	const value = (itemId: string) => unitValue(itemId) ?? Number.POSITIVE_INFINITY;
	for (const group of groups) {
		const firOnly = group.requiredFirCount > 0;
		const accepted = new Set(group.itemIds);
		let need = group.requiredCount;
		for (const itemId of group.itemIds) {
			if (need <= 0) break;
			resolve(itemId);
			const left = spare.get(itemId)!;
			const other = firOnly ? 0 : Math.min(need, left.other);
			left.other -= other;
			const fir = Math.min(need - other, left.fir);
			left.fir -= fir;
			need -= other + fir;
		}
		const candidates = pool
			.filter((stack) => stack.quantity > 0 && accepted.has(stack.item.id) && (!firOnly || stack.foundInRaid !== "no"))
			.sort(
				(a, b) =>
					value(a.item.id) - value(b.item.id) ||
					Number(a.foundInRaid === "yes") - Number(b.foundInRaid === "yes") ||
					a.item.id.localeCompare(b.item.id),
			);
		for (const stack of candidates) {
			if (need <= 0) break;
			const amount = Math.min(stack.quantity, need);
			keep(stack, amount, firOnly && stack.foundInRaid === "unknown");
			need -= amount;
			const itemReasons = needs.get(stack.item.id)!.reasons;
			// FIR and non-FIR stacks of one item can both fill the same hand-in.
			const existing = itemReasons.find((reason) => reason.options && reason.id === group.groupId);
			if (existing) {
				existing.filled = (existing.filled ?? 0) + amount;
				continue;
			}
			itemReasons.push({
				id: group.groupId,
				kind: "quest",
				label: group.questName,
				questId: group.questId,
				count: group.requiredCount,
				firCount: group.requiredFirCount,
				options: group.itemIds.length,
				filled: amount,
				now: group.status === "available",
				minPlayerLevel: group.minPlayerLevel,
			});
		}
	}
	for (const stack of pool) if (stack.quantity > 0) rows.push({ ...stack, category: "surplus" });

	const merged = new Map<string, SummaryRow>();
	for (const row of rows) {
		const key = `${row.item.id}:${row.foundInRaid}:${row.category}:${!!row.firUnconfirmed}:${!!row.kappa}`;
		const existing = merged.get(key);
		if (existing) existing.quantity += row.quantity;
		else merged.set(key, { ...row });
	}
	return { rows: [...merged.values()], needs };
}
