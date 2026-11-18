/** Ordinary document acquisition cap per profile, across types, per 24-hour window. */
export const GATHERING_DAILY_CAPS = { PVP: 25, PVE: 15, seasonal: 40 } as const;

export function gatheringDailyCap(profileKey: string) {
	return profileKey === "PVP" || profileKey === "PVE"
		? GATHERING_DAILY_CAPS[profileKey]
		: GATHERING_DAILY_CAPS.seasonal;
}
