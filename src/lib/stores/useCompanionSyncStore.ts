import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CurrentRaid } from "@/features/sync/companion-contract";
import type { PendingQuestEvent, ProfileKey, UndoRecord } from "@/features/sync/sync-model";

/**
 * Desktop companion sync state. Account-wide: outside profiles, backups and every reset.
 * Never reads or writes the user store's keys; quest changes go through its actions.
 */
export const COMPANION_SYNC_STORAGE_KEY = "tarkov-companion-sync-v1";
export const ACTIVITY_LOG_LIMIT = 50;

export type SyncStatus = "idle" | "pairing" | "connected" | "unreachable" | "revoked";
export type ActivityStatus = "applied" | "waiting" | "undone" | "dismissed";
export type PairingProgress =
	| { phase: "scanning" }
	| { phase: "waiting"; expiresAt: number }
	| { phase: "denied" | "expired" | "unreachable" | "failed" };

export interface CompanionConnection {
	port: number;
	token: string;
	pairedAt: string;
}

export interface SyncCursor {
	epoch: string;
	seq: number;
}

export interface ActivityEntry {
	id: string;
	at: string;
	profile: ProfileKey;
	completed: number;
	failed: number;
	status: ActivityStatus;
	undo?: UndoRecord;
}

interface PersistedSync {
	connection: CompanionConnection | null;
	cursor: SyncCursor | null;
	handled: Record<ProfileKey, string[]>;
	pending: Record<ProfileKey, PendingQuestEvent[]>;
	review: Record<ProfileKey, PendingQuestEvent[]>;
	log: ActivityEntry[];
	unknownMode: number;
}

interface CompanionSyncState extends PersistedSync {
	status: SyncStatus;
	lastSyncAt: number | null;
	pairing: PairingProgress | null;
	raid: CurrentRaid | null;
	/** Log entry to announce in the corner notice. */
	notice: { logId: string; nonce: number } | null;
	commit: (update: (state: PersistedSync) => Partial<PersistedSync>) => void;
	patchLog: (id: string, patch: Partial<ActivityEntry>) => void;
	setStatus: (status: SyncStatus) => void;
	setLastSyncAt: (at: number | null) => void;
	setPairing: (pairing: PairingProgress | null) => void;
	setRaid: (raid: CurrentRaid | null) => void;
	showNotice: (logId: string) => void;
	clearNotice: () => void;
	connect: (connection: CompanionConnection) => void;
	/** Clears connection, cursor and queues; keeps handled ids and the activity log. */
	disconnect: () => void;
}

const emptyPersisted = (): PersistedSync => ({
	connection: null,
	cursor: null,
	handled: {},
	pending: {},
	review: {},
	log: [],
	unknownMode: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isCount = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0;
const isProfileKey = (key: string) => key === "PVP" || key === "PVE" || /^KORD:[\w-]+$/.test(key);

function parseConnection(value: unknown): CompanionConnection | null {
	if (!isRecord(value)) return null;
	const { port, token, pairedAt } = value;
	if (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535) return null;
	if (!isString(token) || !isString(pairedAt)) return null;
	return { port: port as number, token, pairedAt };
}

function parseCursor(value: unknown): SyncCursor | null {
	if (!isRecord(value) || !isString(value.epoch) || !isCount(value.seq)) return null;
	return { epoch: value.epoch, seq: value.seq };
}

function parseEvent(value: unknown): PendingQuestEvent | null {
	if (!isRecord(value)) return null;
	const { id, at, action, questId } = value;
	if (!isString(id) || typeof at !== "string" || !isString(questId)) return null;
	if (action !== "completed" && action !== "failed") return null;
	return { id, at, action, questId };
}

function parseByProfile<T>(value: unknown, parseItem: (item: unknown) => T | null): Record<ProfileKey, T[]> {
	const result: Record<ProfileKey, T[]> = {};
	if (!isRecord(value)) return result;
	for (const [profile, items] of Object.entries(value)) {
		if (!isProfileKey(profile) || !Array.isArray(items)) continue;
		const parsed = items.map(parseItem).filter((item): item is T => item !== null);
		if (parsed.length) result[profile] = parsed;
	}
	return result;
}

function parseUndo(value: unknown): UndoRecord | undefined {
	if (!isRecord(value) || !Array.isArray(value.quests)) return undefined;
	const quests = value.quests.flatMap((entry) =>
		isRecord(entry) && isString(entry.questId) && typeof entry.completed === "boolean" && typeof entry.failed === "boolean"
			? [{ questId: entry.questId, completed: entry.completed, failed: entry.failed }]
			: [],
	);
	return { quests };
}

function parseLogEntry(value: unknown): ActivityEntry | null {
	if (!isRecord(value)) return null;
	const { id, at, profile, completed, failed, status, undo } = value;
	if (!isString(id) || typeof at !== "string" || typeof profile !== "string" || !isProfileKey(profile)) return null;
	if (!isCount(completed) || !isCount(failed)) return null;
	if (status !== "applied" && status !== "waiting" && status !== "undone" && status !== "dismissed") return null;
	const parsedUndo = undo === undefined ? undefined : parseUndo(undo);
	return { id, at, profile, completed, failed, status, ...(parsedUndo ? { undo: parsedUndo } : {}) };
}

function parseHandled(value: unknown): Record<ProfileKey, string[]> {
	const result: Record<ProfileKey, string[]> = {};
	if (!isRecord(value)) return result;
	for (const [profile, ids] of Object.entries(value)) {
		if (!isProfileKey(profile) || !Array.isArray(ids)) continue;
		result[profile] = ids.filter(isString).slice(-2000);
	}
	return result;
}

export const useCompanionSyncStore = create<CompanionSyncState>()(
	persist(
		(set) => ({
			...emptyPersisted(),
			status: "idle",
			lastSyncAt: null,
			pairing: null,
			raid: null,
			notice: null,
			commit: (update) => set((state) => update(state)),
			patchLog: (id, patch) =>
				set((state) => ({ log: state.log.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) })),
			setStatus: (status) => set({ status }),
			setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
			setPairing: (pairing) => set({ pairing }),
			setRaid: (raid) => set({ raid }),
			showNotice: (logId) => set((state) => ({ notice: { logId, nonce: (state.notice?.nonce ?? 0) + 1 } })),
			clearNotice: () => set({ notice: null }),
			connect: (connection) =>
				set({ connection, cursor: null, status: "connected", pairing: null, raid: null, lastSyncAt: null }),
			disconnect: () =>
				set((state) => ({
					connection: null,
					cursor: null,
					pending: {},
					review: {},
					// Queued changes are gone, so their entries can never apply.
					log: state.log.map((entry) =>
						entry.status === "waiting" ? { ...entry, status: "dismissed" as const } : entry,
					),
					status: "idle",
					pairing: null,
					raid: null,
					lastSyncAt: null,
					notice: null,
				})),
		}),
		{
			name: COMPANION_SYNC_STORAGE_KEY,
			version: 1,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ connection, cursor, handled, pending, review, log, unknownMode }): PersistedSync => ({
				connection,
				cursor,
				handled,
				pending,
				review,
				log,
				unknownMode,
			}),
			merge: (persisted, current) => {
				const saved = isRecord(persisted) ? persisted : {};
				const connection = parseConnection(saved.connection);
				return {
					...current,
					connection,
					// A cursor is meaningless without the connection it came from.
					cursor: connection ? parseCursor(saved.cursor) : null,
					handled: parseHandled(saved.handled),
					pending: connection ? parseByProfile(saved.pending, parseEvent) : {},
					review: connection ? parseByProfile(saved.review, parseEvent) : {},
					log: Array.isArray(saved.log)
						? saved.log
								.map(parseLogEntry)
								.filter((entry): entry is ActivityEntry => entry !== null)
								.slice(0, ACTIVITY_LOG_LIMIT)
						: [],
					unknownMode: isCount(saved.unknownMode) ? saved.unknownMode : 0,
				};
			},
		},
	),
);
