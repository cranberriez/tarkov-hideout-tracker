import { type GameMode } from "../../lib/game-mode";
import { FIRST_SEASON_ID, type SeasonId } from "../../lib/cfg/seasons";
import { profileStorageScope } from "../../lib/seasons/profile-scope";
import { pickPlayerProgress } from "../../lib/player-progress";
import { USER_STORE_STORAGE_KEY, useUserStore } from "../../lib/stores/useUserStore";
import { KAPPA_STORE_STORAGE_KEY, useKappaStore } from "../../lib/stores/useKappaStore";
import { parseProfitOptions, profitOptionsStorageKey } from "../profit-pages/profit-options";
import {
	canonical,
	parseProgressBackup,
	type ProgressBackup,
	type BackupProfile,
	type BackupProfileScope,
} from "./progress-backup";

export function readProgressBackup(storage: Storage): ProgressBackup {
	const user = useUserStore.getState();
	const kappa = useKappaStore.getState();
	const profiles = Object.fromEntries(
		(
			[
				"PVP",
				"PVE",
				...Object.keys(user.seasonalProfiles).map((id) => profileStorageScope("KORD", id as SeasonId)),
			] as BackupProfileScope[]
		).map((mode) => {
			const options = parseProfitOptions(storage.getItem(profitOptionsStorageKey(mode)));
			return [
				mode,
				{
					progress: pickPlayerProgress(
						mode.startsWith("KORD")
							? user.seasonalProfiles[mode === "KORD" ? FIRST_SEASON_ID : mode.slice(5)]
							: user.profiles[mode as GameMode],
					),
					kappa: kappa.completedItemsByMode[mode] ?? {},
					skills: {
						craftingSkillLevel: options.craftingSkillLevel,
						hideoutManagementSkillLevel: options.hideoutManagementSkillLevel,
					},
				},
			];
		}),
	);
	return structuredClone({
		format: "tarkov-player-progress",
		version: 2,
		exportedAt: new Date().toISOString(),
		profiles,
	});
}

/** Commit only reviewed modes, restoring both persistent owners if any write fails. */
export function importProgressBackup(
	incoming: ProgressBackup,
	reviewed: ProgressBackup,
	modes: BackupProfileScope[],
	storage: Storage,
) {
	const validated = parseProgressBackup(JSON.stringify(incoming));
	const latest = readProgressBackup(storage);
	if (modes.some((mode) => canonical(latest.profiles[mode]) !== canonical(reviewed.profiles[mode]))) {
		throw new Error(
			"Your progress changed since this preview. Choose the file again to review the latest information.",
		);
	}
	const selected = [...new Set(modes)].filter(
		(mode) => validated.profiles[mode] && canonical(latest.profiles[mode]) !== canonical(validated.profiles[mode]),
	);
	if (!selected.length) return 0;
	const userBefore = useUserStore.getState();
	const kappaBefore = useKappaStore.getState();
	const keys = [USER_STORE_STORAGE_KEY, KAPPA_STORE_STORAGE_KEY, ...selected.map(profitOptionsStorageKey)];
	const saved = keys.map((key) => [key, storage.getItem(key)] as const);
	try {
		for (const mode of selected) {
			const key = profitOptionsStorageKey(mode);
			const raw = storage.getItem(key);
			const options = raw ? JSON.parse(raw) : {};
			if (!options || typeof options !== "object" || Array.isArray(options))
				throw new Error("Invalid saved skill settings.");
			storage.setItem(key, JSON.stringify({ ...options, ...validated.profiles[mode]!.skills }));
		}
		useUserStore
			.getState()
			.importPlayerProgress(
				Object.fromEntries(
					selected.filter((mode) => !mode.startsWith("KORD")).map((mode) => [mode, validated.profiles[mode]!.progress]),
				),
			);
		useUserStore
			.getState()
			.importSeasonalProgress(
				Object.fromEntries(
					selected
						.filter((mode) => mode.startsWith("KORD"))
						.map((mode) => [mode === "KORD" ? FIRST_SEASON_ID : mode.slice(5), validated.profiles[mode]!.progress]),
				),
			);
		useKappaStore
			.getState()
			.importCompletedItems(Object.fromEntries(selected.map((mode) => [mode, validated.profiles[mode]!.kappa])));
	} catch {
		// Zustand updates memory before persistence; restore memory even if storage is blocked.
		try {
			useUserStore.setState(userBefore, true);
		} catch {
			/* memory restored */
		}
		try {
			useKappaStore.setState(kappaBefore, true);
		} catch {
			/* memory restored */
		}
		let restored = true;
		for (const [key, value] of saved) {
			try {
				if (storage.getItem(key) === value) continue;
				if (value === null) storage.removeItem(key);
				else storage.setItem(key, value);
			} catch {
				restored = false;
			}
		}
		throw new Error(
			restored
				? "Import could not be saved. Your previous progress has been restored. Check browser storage and try again."
				: "Browser storage failed during import and recovery. Current progress is retained in this tab. Export a backup before closing it.",
		);
	}
	if (typeof window !== "undefined") window.dispatchEvent(new Event("tarkov-profit-options-change"));
	return selected.length;
}

export function selectBackupProfiles(backup: ProgressBackup, modes: BackupProfileScope[]): ProgressBackup {
	const profiles: Partial<Record<BackupProfileScope, BackupProfile>> = {};
	for (const mode of modes) if (backup.profiles[mode]) profiles[mode] = backup.profiles[mode];
	return { ...backup, profiles };
}
