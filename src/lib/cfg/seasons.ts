import { PROFILE_BASE_COLORS } from "./profile-colors";

export type SeasonId = "season-1" | "season-2";
export const FIRST_SEASON_ID: SeasonId = "season-1";
export const SEASONS = [
	{
		id: "season-1",
		name: "KORD",
		title: "Season 1 KORD Breach",
		color: PROFILE_BASE_COLORS.KORD,
		endsAt: Date.UTC(2026, 11, 7, 23, 59, 59),
		forceEliteCrafting: true,
	},
	{
		id: "season-2",
		name: "Test",
		title: "Season 2 Test",
		color: PROFILE_BASE_COLORS.PVE,
		endsAt: null,
		forceEliteCrafting: false,
	},
] as const;
export function getSeason(id: SeasonId) {
	const season = SEASONS.find((entry) => entry.id === id);
	if (!season) throw new Error("Unknown season.");
	return season;
}
/** Availability follows the previous season's end; this never activates a character. */
export function getCurrentSeason(now = Date.now()) {
	return SEASONS.find((season) => season.endsAt === null || now <= season.endsAt) ?? SEASONS[SEASONS.length - 1];
}
