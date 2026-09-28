import type { AcquisitionPlan, LockReason, RecipeEvaluation } from "@/lib/price-calculation";
import type { ProfitPageKind, RouteContext } from "../types";

export const NO_ROUTE_MESSAGE = "No accessible priced acquisition route";
/** Matches the minimum flea level applied in price-calculation availability. */
export const FLEA_UNLOCK_LEVEL = 15;

/** Summary diagnostics that only restate the specific reasons beside them. */
const GENERIC_UNAVAILABLE_MESSAGES = new Set([
	NO_ROUTE_MESSAGE,
	"No available route",
	"No acquisition route available",
	"Recipe ingredients have no accessible priced route",
	"Required reusable tool has no accessible acquisition route",
]);

/** Short chip labels for specific data problems; the full message stays in the title. */
const UNAVAILABLE_LABELS: Record<string, string> = {
	"Flea purchase price unavailable": "No price",
	"Item data unavailable": "No item data",
	"Production input costs unavailable": "Inputs unpriced",
	"Quest item input costs unavailable": "Quest items unpriced",
	"Invalid recipe output quantity": "Invalid output",
};

const CHIP_ORDER: Record<LockReason["kind"], number> = { station: 0, vendor: 1, quest: 2, flea: 3, unavailable: 4 };

export interface LockChip {
	key: string;
	kind: LockReason["kind"];
	/** "lock" is a normal profile gate; "problem" is missing data or no route at all. */
	tone: "lock" | "problem";
	label: string;
	/** Full explanation for hover text. */
	title: string;
	/** Short current-state note for detailed lists, e.g. "currently lvl 0". */
	detail?: string;
	questId?: string;
}

export interface LockChipNames {
	station?: (id: string) => string | undefined;
	trader?: (id: string) => string | undefined;
}

export interface LockChipOptions {
	/** Omit flea chips at or below this level; the page banner already explains the general flea unlock. */
	coveredFleaLevel?: number;
}

/**
 * Collapses lock reasons into one compact chip per requirement. Levels keep the
 * highest requirement because every gate must be met; generic "no route"
 * summaries are dropped when a specific reason already explains the lock.
 */
export function summarizeLockReasons(
	reasons: readonly LockReason[],
	names: LockChipNames = {},
	options: LockChipOptions = {},
): LockChip[] {
	const chips = new Map<string, LockChip>();
	const levels = new Map<string, number>();
	const raise = (key: string, chip: LockChip, level: number) => {
		if (chips.has(key) && (levels.get(key) ?? 0) >= level) return;
		chips.set(key, chip);
		levels.set(key, level);
	};
	for (const reason of reasons) {
		switch (reason.kind) {
			case "flea": {
				if (reason.message === "Not on flea") {
					raise(
						"flea",
						{ key: "flea", kind: "flea", tone: "lock", label: "No flea", title: "Not sold on the flea market" },
						Infinity,
					);
					break;
				}
				const level = reason.requiredLevel;
				if (level !== undefined && options.coveredFleaLevel !== undefined && level <= options.coveredFleaLevel) {
					// Keep the lock counted so a lone "no route" summary is not shown instead.
					levels.set("flea:covered", level);
					break;
				}
				raise(
					"flea",
					{
						key: "flea",
						kind: "flea",
						tone: "lock",
						label: level === undefined ? "Flea locked" : `Flea lvl ${level}`,
						title: reason.message,
					},
					level ?? 0,
				);
				break;
			}
			case "station":
			case "vendor": {
				const id = reason.sourceId ?? reason.message;
				const level = reason.requiredLevel;
				const name =
					reason.sourceId === undefined
						? undefined
						: reason.kind === "station"
							? names.station?.(reason.sourceId)
							: names.trader?.(reason.sourceId);
				const fallbackName = reason.kind === "station" ? "Station" : "Trader";
				const label =
					level === undefined
						? reason.message
						: reason.kind === "station"
							? `${name ?? fallbackName} ${level}`
							: `${name ?? fallbackName} LL${level}`;
				const title = level === undefined ? reason.message : `Requires ${label} · ${reason.message}`;
				raise(
					`${reason.kind}:${id}`,
					{
						key: `${reason.kind}:${id}`,
						kind: reason.kind,
						tone: "lock",
						label,
						title,
						detail: level === undefined ? undefined : reason.message.replace(/^(Station|Trader) is /, "currently "),
					},
					level ?? 0,
				);
				break;
			}
			case "quest": {
				const key = `quest:${reason.questId ?? reason.message}`;
				chips.set(key, {
					key,
					kind: "quest",
					tone: "lock",
					label: "Quest",
					title: reason.message,
					questId: reason.questId,
				});
				break;
			}
			case "unavailable": {
				const generic = GENERIC_UNAVAILABLE_MESSAGES.has(reason.message);
				const key = generic ? "unavailable:route" : `unavailable:${reason.message}`;
				const label = generic ? "No route" : (UNAVAILABLE_LABELS[reason.message] ?? reason.message);
				chips.set(key, {
					key,
					kind: "unavailable",
					tone: "problem",
					label,
					title: reason.message,
					detail: label === reason.message ? undefined : reason.message,
				});
				break;
			}
		}
	}
	const result = [...chips.values()];
	const hasSpecific = levels.has("flea:covered") || result.some((chip) => chip.key !== "unavailable:route");
	return result
		.filter((chip) => !hasSpecific || chip.key !== "unavailable:route")
		.sort((left, right) => CHIP_ORDER[left.kind] - CHIP_ORDER[right.kind]);
}

/**
 * Reasons that explain the ingredient's selected route only. The optimizer's
 * aggregate `lockReasons` also carries every locked alternative and nested
 * recipe diagnostic (kept for filters and the route menu), which is too noisy
 * for the row itself.
 */
export function ingredientLockReasons(plan: AcquisitionPlan): LockReason[] {
	if (plan.method === "unavailable") {
		const direct = (plan.lockedAlternatives ?? [])
			.filter((route) => route.method === "flea" || route.method === "trader")
			.flatMap((route) => route.lockReasons);
		return [...direct, { kind: "unavailable", message: NO_ROUTE_MESSAGE }];
	}
	if (!plan.lockReasons?.length) return [];
	const selected = plan.lockedAlternatives?.find(
		(route) => route.method === plan.method && route.sourceId === plan.sourceId,
	);
	return selected?.lockReasons ?? plan.lockReasons;
}

export interface RequirementGroup {
	key: string;
	title: string;
	chips: LockChip[];
}

export interface RecipeRequirements {
	/** One-line summary after the source label; the popup lists every group. */
	line: LockChip[];
	groups: RequirementGroup[];
	hasProblem: boolean;
}

/** Output flea locks describe selling, not buying. */
function saleChip(chip: LockChip): LockChip {
	if (chip.kind !== "flea") return { ...chip, key: `sale:${chip.key}` };
	return {
		...chip,
		key: `sale:${chip.key}`,
		label: chip.label === "No flea" ? "No flea sale" : chip.label.replace("Flea lvl", "Flea sale lvl"),
		title: chip.label === "No flea" ? "Cannot be sold on the flea market" : chip.title.replace("Flea", "Flea selling"),
	};
}

/**
 * Everything that gates one recipe row: its own recipe lock, the output sale
 * lock and each ingredient's selected-route locks, as one summary line plus
 * grouped detail for the popup.
 */
export function summarizeRecipeRequirements(
	evaluation: RecipeEvaluation,
	{
		names = {},
		options = {},
		itemName = (itemId: string) => itemId,
	}: { names?: LockChipNames; options?: LockChipOptions; itemName?: (itemId: string) => string } = {},
): RecipeRequirements {
	const ownSourceKey = evaluation.craft
		? `station:${evaluation.craft.stationId}`
		: evaluation.barter
			? `vendor:${evaluation.barter.traderId}`
			: undefined;
	const recipe = summarizeLockReasons(evaluation.lockReasons ?? [], names, options);
	const sale = summarizeLockReasons(evaluation.outputLockReasons ?? [], names, options).map(saleChip);
	const ingredients = evaluation.requiredItems
		.map((plan) => ({ plan, reasons: ingredientLockReasons(plan) }))
		.map(({ plan, reasons }) => ({ plan, reasons, chips: summarizeLockReasons(reasons, names, options) }))
		.filter(({ chips }) => chips.length > 0);
	const ingredientLine = summarizeLockReasons(
		ingredients.flatMap(({ reasons }) => reasons),
		names,
		options,
	);
	const line = [...recipe.filter((chip) => chip.key !== ownSourceKey), ...sale, ...ingredientLine].filter(
		(chip, index, all) => all.findIndex((other) => other.label === chip.label) === index,
	);
	const groups: RequirementGroup[] = [
		...(recipe.length ? [{ key: "recipe", title: "Recipe", chips: recipe }] : []),
		...(sale.length ? [{ key: "sale", title: "Selling the output", chips: sale }] : []),
		...ingredients.map(({ plan, chips }) => ({
			key: `item:${plan.itemId}:${plan.isTool === true}`,
			title: `${itemName(plan.itemId)}${plan.isTool ? " (tool)" : ""}`,
			chips,
		})),
	];
	return {
		line,
		groups,
		hasProblem: groups.some((group) => group.chips.some((chip) => chip.tone === "problem")),
	};
}

export interface LockedSourceReason {
	text: string;
	questId?: string;
	tone: LockChip["tone"];
}

const PLAIN_UNAVAILABLE_REASONS: Record<string, string> = {
	"Flea purchase price unavailable": "No flea price is available",
	"Item data unavailable": "Item data is missing",
};

/**
 * Plain-language reasons the ingredient's selected route is locked. Recipe
 * routes keep only their own gates (station/trader level, unlock quest); their
 * ingredient and tool gaps belong to that recipe. With no route at all, the
 * locked direct purchases explain why.
 */
export function describeSelectedLock(plan: AcquisitionPlan, context: RouteContext): LockedSourceReason[] {
	const traderName = (id: string) => context.tradersById[id]?.name ?? "Unknown trader";
	const unavailable = plan.method === "unavailable";
	const routes = unavailable
		? (plan.lockedAlternatives ?? []).filter((route) => route.method === "flea" || route.method === "trader")
		: (plan.lockedAlternatives ?? []).filter(
				(route) => route.method === plan.method && route.sourceId === plan.sourceId,
			);
	const reasons: LockedSourceReason[] = [];
	for (const route of routes) {
		const barter = route.method === "barter" && route.sourceId ? context.bartersById[route.sourceId] : undefined;
		const craft = route.method === "craft" && route.sourceId ? context.craftsById[route.sourceId] : undefined;
		const recipe = route.method === "barter" || route.method === "craft";
		const ownGate = (reason: LockReason) =>
			(reason.kind === "station" && reason.sourceId === craft?.stationId) ||
			(reason.kind === "vendor" && reason.sourceId === barter?.traderId) ||
			(reason.kind === "quest" && reason.questId === (barter ?? craft)?.taskUnlockId);
		for (const reason of route.lockReasons) {
			if (recipe && !ownGate(reason)) continue;
			const current = reason.message.replace(/^(Station|Trader) is /, "");
			const text =
				reason.kind === "flea"
					? reason.message === "Not on flea"
						? "Can't be bought on the flea market"
						: `${unavailable ? "Flea market unlocks" : "Unlocks"} at level ${reason.requiredLevel ?? "?"}`
					: reason.kind === "station"
						? `Needs station level ${reason.requiredLevel ?? "?"} (yours: ${current})`
						: reason.kind === "vendor"
							? `${unavailable && reason.sourceId ? `${traderName(reason.sourceId)} needs` : "Needs"} LL${reason.requiredLevel ?? "?"} (yours: ${current})`
							: reason.kind === "quest"
								? "Complete"
								: GENERIC_UNAVAILABLE_MESSAGES.has(reason.message)
									? ""
									: (PLAIN_UNAVAILABLE_REASONS[reason.message] ?? reason.message);
			if (!text || reasons.some((existing) => existing.text === text && existing.questId === reason.questId)) continue;
			reasons.push({ text, questId: reason.questId, tone: reason.kind === "unavailable" ? "problem" : "lock" });
		}
	}
	return reasons;
}

/** Non-tool ingredients whose selected route has no price, blocking cost and profit. */
export function unpricedIngredientIds(evaluation: RecipeEvaluation) {
	return evaluation.requiredItems.filter((plan) => !plan.isTool && plan.totalCost === null).map((plan) => plan.itemId);
}

export interface ProfileLockGap {
	key: "player" | "hideout" | "traders";
	label: string;
}

/** Profile-wide gaps that lock most rows; shown once instead of on every row. */
export function getProfileLockGaps(
	kind: ProfitPageKind,
	profile: {
		playerLevel: number;
		stationLevels: Readonly<Record<string, number>>;
		traderLoyaltyLevels: Readonly<Record<string, number>>;
	},
): ProfileLockGap[] {
	const gaps: ProfileLockGap[] = [];
	if (profile.playerLevel < FLEA_UNLOCK_LEVEL)
		gaps.push({
			key: "player",
			label: `PMC lvl ${profile.playerLevel} (flea unlocks at ${FLEA_UNLOCK_LEVEL})`,
		});
	if (kind === "craft" && !Object.values(profile.stationLevels).some((level) => level > 0))
		gaps.push({ key: "hideout", label: "Hideout levels not set" });
	if (!Object.values(profile.traderLoyaltyLevels).some((level) => level > 1))
		gaps.push({ key: "traders", label: "All traders LL1" });
	return gaps;
}
