import type { PassPage } from "./battle-pass-model";
import type { DocumentRouteInput } from "./document-route-model";

export const savedRouteKey = (seasonId: string) => `tarkov-battle-pass-route-${seasonId}-v1`;
/** Per-season device key holding the dismissed better-route suggestion's signature. */
export const routeHintKey = (seasonId: string) => `tarkov-battle-pass-route-hint-${seasonId}-v1`;

/** Route configuration choices, remembered per season across reloads. */
export interface RouteSettings {
	/** "finish", "owned", "goals" or a reward ID. */
	destination: string;
	buyAll: boolean;
	allProfiles: boolean;
}

/** A saved plan: the claims, owners and order chosen when it was saved. Never re-solved. */
export interface LockedRoute extends RouteSettings {
	savedAt: string;
	useClassified: boolean;
	claims: { rewardId: string; profileKey: string }[];
	/** Documents to gather when saved, 0 for none. */
	gathering: number;
	/** Documents the plan still had to gather or buy when saved. */
	shortfall: number;
	/** Rewards already completed when saved, to tell later off-plan claims apart. */
	completedAtSave: string[];
}

export interface SavedRoute {
	settings: RouteSettings;
	locked: LockedRoute | null;
}

export const defaultRouteSettings: RouteSettings = { destination: "finish", buyAll: false, allProfiles: true };

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const count = (value: unknown) =>
	typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

function parseSettings(value: unknown): RouteSettings {
	const raw = record(value);
	return {
		destination:
			typeof raw.destination === "string" && raw.destination ? raw.destination : defaultRouteSettings.destination,
		buyAll: typeof raw.buyAll === "boolean" ? raw.buyAll : defaultRouteSettings.buyAll,
		allProfiles: typeof raw.allProfiles === "boolean" ? raw.allProfiles : defaultRouteSettings.allProfiles,
	};
}

function parseLocked(value: unknown): LockedRoute | null {
	const raw = record(value);
	if (!Array.isArray(raw.claims)) return null;
	const claims = raw.claims.flatMap((entry) => {
		const claim = record(entry);
		return typeof claim.rewardId === "string" && typeof claim.profileKey === "string"
			? [{ rewardId: claim.rewardId, profileKey: claim.profileKey }]
			: [];
	});
	// A plan whose claims cannot all be read is not shown as if it were complete.
	if (claims.length !== raw.claims.length) return null;
	return {
		...parseSettings(raw),
		savedAt: typeof raw.savedAt === "string" ? raw.savedAt : "",
		useClassified: raw.useClassified === true,
		claims,
		gathering: count(raw.gathering),
		shortfall: count(raw.shortfall),
		completedAtSave: Array.isArray(raw.completedAtSave)
			? raw.completedAtSave.filter((id): id is string => typeof id === "string")
			: [],
	};
}

/** Normalize a saved route without rewriting the stored value; unknown fields are kept by writers. */
export function parseSavedRoute(raw: string | null): SavedRoute {
	let value: Record<string, unknown> = {};
	try {
		value = record(JSON.parse(raw ?? "null"));
	} catch {
		/* Reads never rewrite a malformed save. */
	}
	return { settings: parseSettings(value.settings), locked: parseLocked(value.locked) };
}

/** Merge a change into the latest stored value, keeping fields written by newer builds. */
export function updateSavedRoute(raw: string | null, change: Partial<SavedRoute>) {
	let current: Record<string, unknown> = {};
	try {
		current = record(JSON.parse(raw ?? "null"));
	} catch {
		/* Replace a malformed save only when the player changes it. */
	}
	return JSON.stringify({ ...current, version: 1, ...change });
}

/** The route-model flags for a destination. */
export function destinationInput(destination: string, buyAll: boolean, goals: string[]) {
	const owned = destination === "owned";
	return {
		goalIds: destination === "finish" || owned ? [] : destination === "goals" ? goals : [destination],
		finishSeason: destination === "finish",
		buyAll: owned ? false : buyAll,
		mostRewardsNow: owned,
	} satisfies Partial<DocumentRouteInput>;
}

export type LockedRouteStatus =
	/** The saved claims cannot be replayed: a reward or claiming profile is unavailable. */
	| { kind: "broken"; reason: string }
	| {
			kind: "ok";
			/** Saved claims still to do, in saved order. */
			remaining: LockedRoute["claims"];
			completedCount: number;
			/** Rewards completed since saving that the plan did not include. */
			offPlan: string[];
	  };

/** Compare a saved plan with current progress. Pure: no solving. */
export function lockedRouteStatus(
	locked: LockedRoute,
	pages: PassPage[],
	profileKeys: string[],
	completedIds: string[],
): LockedRouteStatus {
	const known = new Set(pages.flatMap((page) => page.cells.map((tile) => tile.id)));
	const missing = locked.claims.filter((claim) => !known.has(claim.rewardId));
	if (missing.length)
		return {
			kind: "broken",
			reason: `${missing.length === 1 ? "A planned reward is" : "Planned rewards are"} no longer in this season.`,
		};
	const completed = new Set(completedIds);
	const remaining = locked.claims.filter((claim) => !completed.has(claim.rewardId));
	const unavailable = [...new Set(remaining.map((claim) => claim.profileKey))].filter(
		(key) => !profileKeys.includes(key),
	);
	if (unavailable.length)
		return {
			kind: "broken",
			reason: "A profile the plan claims with is not available. Re-optimize with the current profiles.",
		};
	const planned = new Set(locked.claims.map((claim) => claim.rewardId));
	const before = new Set(locked.completedAtSave);
	return {
		kind: "ok",
		remaining,
		completedCount: locked.claims.length - remaining.length,
		offPlan: completedIds.filter((id) => !planned.has(id) && !before.has(id)),
	};
}
