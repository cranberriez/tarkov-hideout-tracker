import type { StateStorage } from "zustand/middleware";

export const LEGACY_USER_STORE_STORAGE_KEY = "tarkov-hideout-user-state";
export const USER_STORE_STORAGE_KEY = "tarkov-hideout-profiles-state";

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The previous application's key is a read-only source, never a migration target. */
export function createUserStateStorage(storage: Storage): StateStorage {
	return {
		getItem: (name) => {
			const current = storage.getItem(name);
			if (current !== null || name !== USER_STORE_STORAGE_KEY) return current;
			const old = storage.getItem(LEGACY_USER_STORE_STORAGE_KEY);
			if (old === null) return null;
			const envelope: unknown = JSON.parse(old);
			if (!isRecord(envelope) || !isRecord(envelope.state)) {
				throw new Error("Old player storage is not a valid saved state.");
			}
			// Existing users of the profile-based app keep every profile and preference.
			if (isRecord(envelope.state.profiles)) {
				if (typeof envelope.version === "number" && envelope.version >= 19) return old;
				// An old build may have retained unknown profile fields while updating
				// only the flat progress and writing its own (older) version number.
				const mode =
					envelope.state.gameMode === "PVE" || envelope.state.gameMode === "KORD" ? envelope.state.gameMode : "PVP";
				return JSON.stringify({
					version: 19,
					state: {
						...envelope.state,
						...(isRecord(envelope.state.profiles[mode]) ? envelope.state.profiles[mode] : {}),
						gameMode: mode,
						deprecatedLegacyState: envelope.state,
						hasConvertedDeprecatedLegacyState: false,
						hasDismissedDeprecatedLegacyState: false,
					},
				});
			}
			// Old builds can retain a newer version and conversion flags after a downgrade.
			// Identify their flat schema instead of trusting that version or those flags.
			return JSON.stringify({
				version: 23,
				state: {
					deprecatedLegacyState: envelope.state,
					hasConvertedDeprecatedLegacyState: false,
					hasDismissedDeprecatedLegacyState: false,
				},
			});
		},
		setItem: (name, value) => {
			if (name === LEGACY_USER_STORE_STORAGE_KEY) throw new Error("Old player storage is read-only.");
			storage.setItem(name, value);
		},
		removeItem: (name) => {
			if (name === LEGACY_USER_STORE_STORAGE_KEY) throw new Error("Old player storage is read-only.");
			storage.removeItem(name);
		},
	};
}
