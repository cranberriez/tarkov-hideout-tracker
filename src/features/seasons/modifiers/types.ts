import type { SeasonId } from "@/lib/cfg/seasons";

/**
 * Seasonal modifiers are static, hand-maintained content: no database or provider reads.
 *
 * - One file per season (season-1.ts, season-2.ts); each season keeps its own copy, even for repeats.
 * - `id` is stable within a season and will key builder selections in share URLs: never rename one.
 * - The same `id` in two seasons means the same modifier; that link drives "changed since" comparisons.
 * - Personal `points` keep the posters' sign: positives cost points (negative), negatives grant them.
 *   A character starts at 0 and is valid while the total stays at 0 or above.
 */
export type ModifierKind = "global" | "positive" | "negative";

export type SeasonModifier = {
	id: string;
	name: string;
	kind: ModifierKind;
	/** Personal modifiers only. */
	points?: number;
	effects: string[];
	/** Public path; omitted when no artwork is available. */
	icon?: string;
	/** Share of players who picked it, in percent, when Battlestate published it. */
	pickRate?: number;
	/**
	 * Hand-written previous-season values, shown as "S1: was <points>, <note>". Use it when the
	 * automatically derived number would be ambiguous (several stats) or misses a reworded change.
	 */
	previousNote?: string;
};

export type SeasonModifierSet = {
	seasonId: SeasonId;
	source: { label: string; url?: string };
	note?: string;
	/** Where the published pick rates come from. */
	pickRateSource?: string;
	/**
	 * Bit position of every personal modifier in compact share links (`?b=`). APPEND-ONLY: add new
	 * IDs at the end and never reorder or remove entries, or existing share links change meaning.
	 */
	shareOrder: readonly string[];
	modifiers: SeasonModifier[];
	/** Personal modifiers that can't be combined; omitted when the season has none. */
	incompatibilities?: ModifierIncompatibilities;
};

/**
 * - `hard`: the game refuses the combination, so the builder blocks picking a conflicting card.
 * - `soft`: unconfirmed rules, so the builder only warns and any combination can still be picked.
 */
export type IncompatibilityMode = "hard" | "soft";
/**
 * Where a rule comes from: `confirmed` in the live game, `carried` over from an earlier season and
 * likely to repeat, or `speculative` (our guess). Only soft seasons should use carried/speculative.
 */
export type IncompatibilityBasis = "confirmed" | "carried" | "speculative";
/** At most one of `ids` may be picked (a pair is the common case). */
export type IncompatibilityRule = { ids: readonly string[]; basis: IncompatibilityBasis };
export type ModifierIncompatibilities = { mode: IncompatibilityMode; rules: IncompatibilityRule[] };

/** `id` conflicts with each of `others` (but `others` may combine with each other). */
export const excludes = (id: string, others: readonly string[], basis: IncompatibilityBasis): IncompatibilityRule[] =>
	others.map((other) => ({ ids: [id, other], basis }));
/** Every listed ID conflicts with every other one: only one can be picked. */
export const oneOf = (ids: readonly string[], basis: IncompatibilityBasis): IncompatibilityRule[] => [{ ids, basis }];

/** Builds personal modifiers of one kind from compact entries. */
export function personal(
	kind: "positive" | "negative",
	entries: { id: string; name: string; points: number; effects: string[] }[],
	icon?: (id: string) => string | undefined,
): SeasonModifier[] {
	return entries.map((entry) => ({ ...entry, kind, icon: icon?.(entry.id) }));
}

/** Poster sign convention with a typographic minus: positives cost (−n), negatives grant (+n). */
export const formatPoints = (points: number) => (points < 0 ? `−${-points}` : `+${points}`);
