import type { GameEdition } from "../stores/useUserStore";

/** Station levels each game edition starts with (Cultist Circle 0 means not granted). */
export const EDITION_STARTING_LEVELS: Record<GameEdition, { stash: number; cultistCircle: number }> = {
	Standard: { stash: 1, cultistCircle: 0 },
	"Left Behind": { stash: 2, cultistCircle: 0 },
	"Prepare for Escape": { stash: 3, cultistCircle: 0 },
	"Edge of Darkness": { stash: 4, cultistCircle: 0 },
	Unheard: { stash: 4, cultistCircle: 1 },
};
