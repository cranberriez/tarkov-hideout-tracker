import { GAME_MODES, type GameMode } from "../../lib/game-mode";
import { createDefaultPlayerProfile } from "../../lib/stores/useUserStore";
import { pickPlayerProgress, type PlayerProgress } from "../../lib/player-progress";

export interface BackupProfile {
	progress: PlayerProgress;
	kappa: Record<string, boolean>;
	skills: { craftingSkillLevel: number; hideoutManagementSkillLevel: number };
}
export interface ProgressBackup {
	format: "tarkov-player-progress";
	version: 1;
	exportedAt: string;
	profiles: Partial<Record<GameMode, BackupProfile>>;
}
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const emptyBackupProfile = (): BackupProfile => ({
	progress: pickPlayerProgress(createDefaultPlayerProfile()),
	kappa: {},
	skills: { craftingSkillLevel: 0, hideoutManagementSkillLevel: 0 },
});

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
	return value as Record<string, unknown>;
}
function exact(value: unknown, keys: readonly string[]) {
	const record = object(value);
	if (Object.keys(record).length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) {
		throw new Error("Missing or unsupported backup fields. Export a new backup from Settings.");
	}
	return record;
}
function number(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER, integer = true) {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value < min ||
		value > max ||
		(integer && !Number.isSafeInteger(value))
	)
		throw new Error("Invalid numeric progress value.");
}
function dictionary(value: unknown, validate: (value: unknown) => void) {
	for (const [id, entry] of Object.entries(object(value))) {
		if (!id.trim() || ["__proto__", "constructor", "prototype"].includes(id)) throw new Error("Invalid progress ID.");
		validate(entry);
	}
}
function boolean(value: unknown) {
	if (typeof value !== "boolean") throw new Error("Invalid completion value.");
}
function edition(value: unknown) {
	if (
		value !== null &&
		!["Standard", "Left Behind", "Prepare for Escape", "Edge of Darkness", "Unheard"].includes(String(value))
	)
		throw new Error("Invalid game edition.");
}

export function parseProgressBackup(raw: string): ProgressBackup {
	if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error("Backup is too large (maximum 10 MB).");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("This file is not valid JSON. Choose a player progress backup.");
	}
	const root = exact(parsed, ["format", "version", "exportedAt", "profiles"]);
	if (root.format !== "tarkov-player-progress" || root.version !== 1)
		throw new Error("Unsupported backup format or version.");
	if (typeof root.exportedAt !== "string" || !Number.isFinite(Date.parse(root.exportedAt)))
		throw new Error("Invalid backup date.");
	const profiles = object(root.profiles);
	if (!Object.keys(profiles).length || Object.keys(profiles).some((mode) => !GAME_MODES.includes(mode as GameMode)))
		throw new Error("Backup must contain PVP, PVE, or KORD profiles.");
	for (const entry of Object.values(profiles)) {
		const profile = exact(entry, ["progress", "kappa", "skills"]);
		const p = exact(profile.progress, Object.keys(emptyBackupProfile().progress));
		dictionary(p.stationLevels, (v) => number(v));
		for (const key of ["completedRequirements", "completedQuests", "failedQuests", "questsWithItems"])
			dictionary(p[key], boolean);
		dictionary(p.completedQuestObjectives, (v) => dictionary(v, boolean));
		dictionary(p.itemCounts, (v) => {
			const counts = exact(v, ["have", "haveFir"]);
			// Existing inventory actions retain signed balances after consuming items.
			number(counts.have, -Number.MAX_SAFE_INTEGER);
			number(counts.haveFir, -Number.MAX_SAFE_INTEGER);
		});
		dictionary(p.questTraderLoyaltyLevels, (v) => number(v, 1, 4));
		number(p.playerLevel, 1);
		number(p.prestigeLevel);
		number(p.questFenceReputation, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, false);
		if (![null, "USEC", "BEAR"].includes(p.questFaction as string | null)) throw new Error("Invalid faction.");
		edition(p.gameEdition);
		edition(p.editionBonusesAppliedFor);
		boolean(p.hasCompletedSetup);
		if (!Array.isArray(p.questChangeHistory)) throw new Error("Invalid quest history.");
		for (const value of p.questChangeHistory) {
			const h = exact(value, ["questId", "timestamp", "change"]);
			if (
				typeof h.questId !== "string" ||
				!h.questId.trim() ||
				!["completed", "uncompleted"].includes(String(h.change))
			)
				throw new Error("Invalid quest history entry.");
			number(h.timestamp);
		}
		dictionary(profile.kappa, boolean);
		const skills = exact(profile.skills, ["craftingSkillLevel", "hideoutManagementSkillLevel"]);
		number(skills.craftingSkillLevel, 0, 51);
		number(skills.hideoutManagementSkillLevel, 0, 51);
	}
	return parsed as ProgressBackup;
}

/** Object insertion order is irrelevant; history order remains meaningful. */
export function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
			.join(",")}}`;
	return JSON.stringify(value);
}
export function profileStatus(current: BackupProfile, incoming: BackupProfile) {
	if (canonical(current) === canonical(incoming)) return "up-to-date";
	return canonical(current) === canonical(emptyBackupProfile()) ? "empty" : "replace";
}

export const PROGRESS_LABELS: Record<keyof PlayerProgress, string> = {
	stationLevels: "Hideout station levels",
	completedRequirements: "Completed requirements",
	completedQuests: "Completed quests",
	completedQuestObjectives: "Visited quest objectives",
	failedQuests: "Failed quests",
	questsWithItems: "Quest hand-ins",
	questChangeHistory: "Quest history",
	itemCounts: "Stored items (regular / FiR)",
	playerLevel: "Player level",
	prestigeLevel: "Prestige level",
	questTraderLoyaltyLevels: "Trader loyalty",
	questFenceReputation: "Fence reputation",
	questFaction: "Faction",
	gameEdition: "Game edition",
	editionBonusesAppliedFor: "Applied edition bonuses",
	hasCompletedSetup: "Character setup complete",
};
export function comparisonRows(current: BackupProfile, incoming: BackupProfile) {
	return [
		...Object.entries(PROGRESS_LABELS).map(([key, label]) => ({
			label,
			current: current.progress[key as keyof PlayerProgress],
			incoming: incoming.progress[key as keyof PlayerProgress],
		})),
		{ label: "Kappa checklist", current: current.kappa, incoming: incoming.kappa },
		{
			label: "Crafting skill",
			current: current.skills.craftingSkillLevel,
			incoming: incoming.skills.craftingSkillLevel,
		},
		{
			label: "Hideout Management skill",
			current: current.skills.hideoutManagementSkillLevel,
			incoming: incoming.skills.hideoutManagementSkillLevel,
		},
	].map((row) => ({ ...row, changed: canonical(row.current) !== canonical(row.incoming) }));
}
