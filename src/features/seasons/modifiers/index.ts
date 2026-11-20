import { SEASONS, type SeasonId } from "@/lib/cfg/seasons";
import { SEASON_1_MODIFIERS } from "./season-1";
import { SEASON_2_MODIFIERS } from "./season-2";
import type { ModifierKind, SeasonModifier, SeasonModifierSet } from "./types";

export * from "./types";

export const SEASON_MODIFIERS: Record<SeasonId, SeasonModifierSet> = {
	"season-1": SEASON_1_MODIFIERS,
	"season-2": SEASON_2_MODIFIERS,
};

export const modifiersOfKind = (set: SeasonModifierSet, kind: ModifierKind) =>
	set.modifiers.filter((modifier) => modifier.kind === kind);

export type PreviousVersion = {
	seasonId: SeasonId;
	modifier: SeasonModifier;
	pointsChanged: boolean;
	effectsChanged: boolean;
	/** The earlier value of the first changed number in the effects, if any. */
	oldStat: string | null;
};

/** The same modifier ID in the nearest earlier season, with what changed since. */
export function previousVersion(seasonId: SeasonId, modifier: SeasonModifier): PreviousVersion | null {
	const index = SEASONS.findIndex((season) => season.id === seasonId);
	for (let i = index - 1; i >= 0; i--) {
		const earlier = SEASON_MODIFIERS[SEASONS[i].id].modifiers.find((entry) => entry.id === modifier.id);
		if (!earlier) continue;
		return {
			seasonId: SEASONS[i].id,
			modifier: earlier,
			pointsChanged: earlier.points !== modifier.points,
			effectsChanged: earlier.effects.join("\n") !== modifier.effects.join("\n"),
			oldStat: changedStat(earlier.effects, modifier.effects),
		};
	}
	return null;
}

type StatToken = { value: number; unit: string; text: string };
const STAT = /(level\s+)?([+-]?\d+(?:\.\d+)?)\s*(%|kg|seconds?|points?)?/gi;

function statTokens(effects: string[]): StatToken[] {
	return [...effects.join("\n").matchAll(STAT)].map(([, level, number, suffix = ""]) => {
		const unit = level ? "level" : suffix.toLowerCase().replace(/s$/, "");
		const text =
			unit === "level"
				? `level ${number}`
				: unit === "%"
					? `${number}%`
					: unit === "second"
						? `${number}s`
						: unit
							? `${number} ${suffix.toLowerCase()}`
							: number;
		return { value: Number(number), unit, text };
	});
}

/**
 * The earlier season's value for the first number that changed, e.g. "25%" when 25% became 70%.
 * Numbers pair by unit and position (the n-th percentage with the n-th percentage), falling back
 * to overall position. Null when every number matches, even if the wording changed.
 */
export function changedStat(previous: string[], current: string[]): string | null {
	const before = statTokens(previous);
	const after = statTokens(current);
	const seen = new Map<string, number>();
	for (const [index, token] of after.entries()) {
		const nth = seen.get(token.unit) ?? 0;
		seen.set(token.unit, nth + 1);
		const match = before.filter((entry) => entry.unit === token.unit)[nth] ?? before[index];
		if (match && match.value !== token.value) return match.text;
	}
	return null;
}

/** Highest published pick rates of one kind, most picked first. */
export function mostPicked(set: SeasonModifierSet, kind: ModifierKind) {
	return modifiersOfKind(set, kind)
		.filter((modifier) => modifier.pickRate !== undefined)
		.sort((a, b) => b.pickRate! - a.pickRate!);
}
