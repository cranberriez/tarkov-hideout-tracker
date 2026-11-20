import { PROFILE_BASE_COLORS } from "./profile-colors";

export type SeasonId = "season-1" | "season-2";
export const FIRST_SEASON_ID: SeasonId = "season-1";
export const SEASONS = [
	{
		id: "season-1",
		name: "KORD",
		title: "Season 1 KORD Breach",
		color: PROFILE_BASE_COLORS.KORD,
		// December 7, 2026 at 01:00 America/Los_Angeles (PST, UTC−8).
		endsAt: Date.UTC(2026, 11, 7, 9),
		forceEliteCrafting: true,
	},
	{
		id: "season-2",
		name: "UNTAR",
		title: "Season 2 UNTAR Control",
		// Deeper than the logo's #3d8fe0 so it stays distinct from the PVE sky blue (#60a5fa).
		color: "#2b78d9",
		endsAt: null,
		forceEliteCrafting: false,
	},
] as const;
export function getSeason(id: SeasonId) {
	const season = SEASONS.find((entry) => entry.id === id);
	if (!season) throw new Error("Unknown season.");
	return season;
}
/**
 * Development-only "try the switch now". Set in .env (restart `pnpm run dev` after changing):
 *   NEXT_PUBLIC_SEASON_OVERRIDE="season-2"   // UNTAR Control (Season 2)
 *   NEXT_PUBLIC_SEASON_OVERRIDE="season-1"   // KORD (Season 1)
 * Ignored in production builds. Activating a character while overridden saves it in this browser only.
 */
function seasonOverride(): SeasonId | null {
	if (process.env.NODE_ENV === "production") return null;
	const id = process.env.NEXT_PUBLIC_SEASON_OVERRIDE;
	return SEASONS.some((season) => season.id === id) ? (id as SeasonId) : null;
}
/** Availability follows the previous season's end; this never activates a character. */
export function getCurrentSeason(now = Date.now()) {
	const override = seasonOverride();
	if (override) return getSeason(override);
	return SEASONS.find((season) => season.endsAt === null || now <= season.endsAt) ?? SEASONS[SEASONS.length - 1];
}
