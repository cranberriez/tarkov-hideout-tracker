import type { GameEdition, GameMode, PlayerProfileState } from "@/lib/stores/useUserStore";
import type { Station } from "@/types/hideout";
import { applyEditionStationBonuses } from "@/lib/cfg/editionBonuses";

type EditionBonusStation = Pick<Station, "id">;
type SetupProfiles = Record<GameMode, PlayerProfileState>;

/** Setup modal edits, committed to the chosen profile only when setup is saved. */
export interface SetupDraft {
	gameMode: GameMode;
	gameEdition: GameEdition | null;
	editionBonusesAppliedFor: GameEdition | null;
	stationLevels: Record<string, number>;
}

/** Edition is account-wide, so any completed profile tells us the player's edition. */
export function findKnownEdition(profiles: SetupProfiles): GameEdition | null {
	return (
		Object.values(profiles).find((profile) => profile.hasCompletedSetup && profile.gameEdition)?.gameEdition ?? null
	);
}

/** First-time setup of another profile only needs hideout levels once the edition is known. */
export function shouldStartOnHideoutLevels(profiles: SetupProfiles, mode: GameMode): boolean {
	return !profiles[mode].hasCompletedSetup && findKnownEdition(profiles) !== null;
}

function withEdition(draft: SetupDraft, edition: GameEdition | null, stations: EditionBonusStation[]): SetupDraft {
	if (!edition || draft.editionBonusesAppliedFor === edition) return { ...draft, gameEdition: edition };

	const stationLevels = applyEditionStationBonuses(
		draft.stationLevels,
		edition,
		new Set(stations.map((station) => station.id)),
	);
	return { ...draft, gameEdition: edition, editionBonusesAppliedFor: edition, stationLevels: { ...stationLevels } };
}

/** Load a profile into the draft, falling back to an already chosen or known edition. */
export function createSetupDraft(
	profiles: SetupProfiles,
	mode: GameMode,
	stations: EditionBonusStation[],
	fallbackEdition: GameEdition | null = findKnownEdition(profiles),
): SetupDraft {
	const profile = profiles[mode];
	return withEdition(
		{
			gameMode: mode,
			gameEdition: profile.gameEdition,
			editionBonusesAppliedFor: profile.editionBonusesAppliedFor,
			stationLevels: { ...profile.stationLevels },
		},
		profile.gameEdition ?? fallbackEdition,
		stations,
	);
}

export function selectDraftGameMode(
	draft: SetupDraft,
	profiles: SetupProfiles,
	mode: GameMode,
	stations: EditionBonusStation[],
): SetupDraft {
	if (mode === draft.gameMode) return draft;
	return createSetupDraft(profiles, mode, stations, draft.gameEdition ?? findKnownEdition(profiles));
}

export function selectDraftGameEdition(
	draft: SetupDraft,
	edition: GameEdition,
	stations: EditionBonusStation[],
): SetupDraft {
	return withEdition(draft, edition, stations);
}

export function setDraftStationLevel(draft: SetupDraft, stationId: string, level: number): SetupDraft {
	return { ...draft, stationLevels: { ...draft.stationLevels, [stationId]: level } };
}
