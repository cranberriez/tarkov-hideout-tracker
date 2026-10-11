import type { StateStorage } from "zustand/middleware";

export const LEGACY_USER_STORE_STORAGE_KEY = "tarkov-hideout-user-state";
export const USER_STORE_STORAGE_KEY = "tarkov-hideout-profiles-state";

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeUnchangedFields(previous: unknown, local: unknown, remote: unknown): unknown {
	if (JSON.stringify(previous) === JSON.stringify(local)) return remote;
	if (!isRecord(local) || !isRecord(remote)) return local;
	const result = { ...local };
	for (const [key, value] of Object.entries(remote)) {
		const before = isRecord(previous) ? previous[key] : undefined;
		const merged = mergeUnchangedFields(before, local[key], value);
		if (merged !== undefined) result[key] = merged;
	}
	return result;
}

/** The previous application's key is a read-only source, never a migration target. */
export function createUserStateStorage(storage: Storage): StateStorage {
	let lastRead: string | null = null;
	return {
		getItem: (name) => {
			const current = storage.getItem(name);
			if (name === USER_STORE_STORAGE_KEY) lastRead = current;
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
			const localInput = value;
			if (name === USER_STORE_STORAGE_KEY) {
				const latest = storage.getItem(name);
				if (latest && latest !== lastRead) {
					const incoming = JSON.parse(value);
					const remote = JSON.parse(latest);
					const previous = lastRead ? JSON.parse(lastRead) : null;
					if (
						isRecord(incoming.state?.seasonalProfiles) &&
						isRecord(remote.state?.seasonalProfiles) &&
						incoming.state.seasonalResetRevision === previous?.state?.seasonalResetRevision
					) {
						// Preserve characters created/edited elsewhere when this tab has not
						// changed them. An explicit reset can still delete known archives.
						for (const [id, profile] of Object.entries(remote.state.seasonalProfiles)) {
							const before = previous?.state?.seasonalProfiles?.[id];
							const local = incoming.state.seasonalProfiles[id];
							const merged = mergeUnchangedFields(before, local, profile);
							if (merged !== undefined) incoming.state.seasonalProfiles[id] = merged;
						}
						incoming.state.profiles.KORD = incoming.state.seasonalProfiles[incoming.state.selectedSeasonId];
						if (incoming.state.gameMode === "KORD") Object.assign(incoming.state, incoming.state.profiles.KORD);
						value = JSON.stringify(incoming);
					}
				}
			}
			storage.setItem(name, value);
			// The caller's memory contains its input, not the merged remote records.
			// Keep that input as the baseline so every subsequent stale write merges.
			if (name === USER_STORE_STORAGE_KEY) lastRead = localInput;
		},
		removeItem: (name) => {
			if (name === LEGACY_USER_STORE_STORAGE_KEY) throw new Error("Old player storage is read-only.");
			storage.removeItem(name);
		},
	};
}
