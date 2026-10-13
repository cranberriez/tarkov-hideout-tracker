export const BATTLE_PASS_PREFERENCES_KEY = "tarkov-battle-pass-ui-preferences-v1";

export interface BattlePassPreferences {
	requestedScope: "goals" | "all";
	useClassified: boolean;
	cumulative: boolean;
	showPossibleProgress: boolean;
	listMode: boolean;
	consumeDocs: boolean;
	showMaps: boolean;
	documentsOpen: boolean;
	allProfiles: boolean;
}

export const defaultPreferences: BattlePassPreferences = {
	requestedScope: "goals",
	useClassified: false,
	cumulative: false,
	showPossibleProgress: false,
	listMode: false,
	consumeDocs: false,
	showMaps: false,
	documentsOpen: false,
	allProfiles: false,
};

/** Normalize known fields without dropping preferences written by a newer build. */
export function parsePreferences(raw: string | null): BattlePassPreferences & Record<string, unknown> {
	let saved: Record<string, unknown> = {};
	try {
		const value: unknown = JSON.parse(raw ?? "null");
		if (value && typeof value === "object" && !Array.isArray(value)) saved = value as Record<string, unknown>;
	} catch {
		/* Reads never rewrite a malformed save. */
	}
	const result = { ...saved, ...defaultPreferences };
	for (const key of Object.keys(defaultPreferences) as (keyof BattlePassPreferences)[]) {
		if (key === "requestedScope") result.requestedScope = saved[key] === "all" ? "all" : "goals";
		else result[key] = typeof saved[key] === "boolean" ? saved[key] : defaultPreferences[key];
	}
	return result;
}

export function updatePreference<K extends keyof BattlePassPreferences>(
	raw: string | null,
	key: K,
	value: BattlePassPreferences[K],
) {
	return JSON.stringify({ ...parsePreferences(raw), [key]: value });
}
