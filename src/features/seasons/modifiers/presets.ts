/**
 * Named build presets for one season page: a fixed row of slots, each empty or holding a name and
 * readable modifier IDs (not the compact share code, so `shareOrder` changes can't corrupt them).
 */
export const PRESET_SLOTS = 10;
export const PRESET_NAME_MAX = 40;

export type BuildPreset = { name: string; picks: string[]; savedAt: number };
export type PresetSlots = (BuildPreset | null)[];

/** Stored shape: `{ version: 1, slots }`. Unknown IDs are dropped; bad entries become empty slots. */
export function parsePresets(raw: string | null, knownIds: readonly string[]): PresetSlots {
	const slots: PresetSlots = Array.from({ length: PRESET_SLOTS }, () => null);
	let stored: unknown;
	try {
		stored = raw ? JSON.parse(raw) : null;
	} catch {
		return slots;
	}
	const entries = (stored as { slots?: unknown } | null)?.slots;
	if (!Array.isArray(entries)) return slots;
	const known = new Set(knownIds);
	entries.slice(0, PRESET_SLOTS).forEach((entry, index) => {
		if (!entry || typeof entry !== "object") return;
		const { name, picks, savedAt } = entry as Partial<BuildPreset>;
		if (typeof name !== "string" || !name.trim() || !Array.isArray(picks)) return;
		slots[index] = {
			name: name.trim().slice(0, PRESET_NAME_MAX),
			picks: picks.filter((id): id is string => typeof id === "string" && known.has(id)),
			savedAt: typeof savedAt === "number" ? savedAt : 0,
		};
	});
	return slots;
}

export const serializePresets = (slots: PresetSlots) => JSON.stringify({ version: 1, slots });

/** The first slot holding exactly this selection, or -1. */
export function matchingSlot(slots: PresetSlots, selected: ReadonlySet<string>): number {
	return slots.findIndex(
		(slot) => slot !== null && slot.picks.length === selected.size && slot.picks.every((id) => selected.has(id)),
	);
}
