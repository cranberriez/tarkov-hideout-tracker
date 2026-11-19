/** Ordinary document acquisition cap per profile, across types, per 24-hour window. */
export const GATHERING_DAILY_CAPS = { PVP: 25, PVE: 15, seasonal: 40 } as const;

/** Documents left unplanned per window with daily headroom on: raids spawn far
 * fewer documents once a profile nears its cap, so the last few are slow. */
export const DAILY_HEADROOM = 5;

/** The cap a plan gathers to; `reserve` documents stay unplanned (never below 1). */
export function gatheringDailyCap(profileKey: string, reserve = 0) {
	const cap =
		profileKey === "PVP" || profileKey === "PVE" ? GATHERING_DAILY_CAPS[profileKey] : GATHERING_DAILY_CAPS.seasonal;
	return Math.max(1, cap - reserve);
}
