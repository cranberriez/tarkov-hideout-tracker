import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CurrentRaid, GroupMember, Position, StatusResponse } from "@/features/sync/companion-contract";
import {
	appendTrail,
	assignMemberColors,
	BATCH_LIMIT,
	FEED_LIMIT,
	type BatchRecord,
	type FeedEntry,
	type FeedStatus,
	type PendingQuestEvent,
	type ProfileKey,
	type UndoRecord,
} from "@/features/sync/sync-model";

/**
 * Desktop companion sync state. Account-wide: outside profiles, backups and every reset.
 * Never reads or writes the user store's keys; quest changes go through its actions.
 */
export const COMPANION_SYNC_STORAGE_KEY = "tarkov-companion-sync-v1";
export const EXCHANGE_LIMIT = 100;

export type SyncStatus = "idle" | "pairing" | "connected" | "unreachable" | "revoked";
export type PairingProgress =
	| { phase: "scanning" }
	| { phase: "waiting"; expiresAt: number }
	| { phase: "denied" | "expired" | "unreachable" | "failed" | "revoked" };

export interface CompanionConnection {
	port: number;
	token: string;
	pairedAt: string;
}

export interface SyncCursor {
	epoch: string;
	seq: number;
}

/** One HTTP exchange with the companion, for the raw protocol view. Session only. */
export interface Exchange {
	at: number;
	method: string;
	path: string;
	status: number | "network error";
	ms: number;
	summary: string;
	body: string;
}

export type RaidNoticeMap = { raw: string; normalizedName: string | null };

export type SyncNoticeState = { nonce: number } & (
	| { kind: "quest"; batchId: string }
	| { kind: "raid"; profile: ProfileKey | null; map: RaidNoticeMap | null }
);

interface PersistedSync {
	connection: CompanionConnection | null;
	cursor: SyncCursor | null;
	handled: Record<ProfileKey, string[]>;
	pending: Record<ProfileKey, PendingQuestEvent[]>;
	review: Record<ProfileKey, PendingQuestEvent[]>;
	feed: FeedEntry[];
	batches: Record<string, BatchRecord>;
	unknownMode: number;
}

interface CompanionSyncState extends PersistedSync {
	status: SyncStatus;
	lastSyncAt: number | null;
	/** Why the last poll failed unexpectedly (a bug, not an unreachable app); cleared by the next good poll. */
	syncError: string | null;
	pairing: PairingProgress | null;
	raid: CurrentRaid | null;
	/** Latest position, the recent trail (oldest first, current session) and how many position events arrived. */
	position: { latest: Position | null; trail: Position[]; count: number };
	/** Group members on the player's raid map, from the latest poll. Session only. */
	group: GroupMember[];
	/** Marker colour per member id, stable while they stay in the group. */
	memberColors: Record<string, string>;
	/** From `GET /v1/status`, fetched while the Sync page is open. */
	companionStatus: StatusResponse | null;
	/** Newest first. */
	exchanges: Exchange[];
	/** What the corner notice announces: an applied quest batch or a raid starting. */
	notice: SyncNoticeState | null;
	commit: (update: (state: PersistedSync) => Partial<PersistedSync>) => void;
	setStatus: (status: SyncStatus) => void;
	setLastSyncAt: (at: number | null) => void;
	setSyncError: (error: string | null) => void;
	setPairing: (pairing: PairingProgress | null) => void;
	/** A raid entering `loading` starts a fresh trail. */
	setRaid: (raid: CurrentRaid | null) => void;
	setPosition: (latest: Position | null, added: readonly Position[]) => void;
	setGroup: (group: GroupMember[]) => void;
	setCompanionStatus: (status: StatusResponse | null) => void;
	recordExchange: (exchange: Exchange) => void;
	showNotice: (batchId: string) => void;
	showRaidNotice: (raid: { profile: ProfileKey | null; map: RaidNoticeMap | null }) => void;
	clearNotice: () => void;
	connect: (connection: CompanionConnection) => void;
	/** Clears connection, cursor and queues; keeps handled ids, the feed and batches. */
	disconnect: () => void;
}

const emptyPersisted = (): PersistedSync => ({
	connection: null,
	cursor: null,
	handled: {},
	pending: {},
	review: {},
	feed: [],
	batches: {},
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

const FEED_STATUSES: readonly FeedStatus[] = [
	"applied",
	"unchanged",
	"waiting",
	"review",
	"undone",
	"dismissed",
	"info",
	"unknown_mode",
];
const QUEST_ACTIONS = ["accepted", "completed", "failed"] as const;
const RAID_PHASES = ["loading", "in_raid", "ended"] as const;

function parseFeedEntry(value: unknown): FeedEntry | null {
	if (!isRecord(value)) return null;
	const { id, at, receivedAt, profile, kind, action, questId, phase, map, recovered, status, batchId } = value;
	if (!isString(id) || typeof at !== "string" || typeof receivedAt !== "string") return null;
	if (typeof recovered !== "boolean" || !FEED_STATUSES.includes(status as FeedStatus)) return null;
	if (profile !== null && (typeof profile !== "string" || !isProfileKey(profile))) return null;
	const base = {
		id,
		at,
		receivedAt,
		profile: profile as ProfileKey | null,
		recovered,
		status: status as FeedStatus,
		...(isString(batchId) ? { batchId } : {}),
	};
	if (kind === "quest") {
		if (!QUEST_ACTIONS.includes(action as (typeof QUEST_ACTIONS)[number]) || !isString(questId)) return null;
		return { ...base, kind, action: action as FeedEntry["action"], questId };
	}
	if (kind === "raid") {
		if (!RAID_PHASES.includes(phase as (typeof RAID_PHASES)[number])) return null;
		const parsedMap =
			isRecord(map) && typeof map.raw === "string"
				? { raw: map.raw, normalizedName: typeof map.normalizedName === "string" ? map.normalizedName : null }
				: undefined;
		return { ...base, kind, phase: phase as FeedEntry["phase"], ...(parsedMap ? { map: parsedMap } : {}) };
	}
	return null;
}

function parseBatches(value: unknown): Record<string, BatchRecord> {
	const result: Record<string, BatchRecord> = {};
	if (!isRecord(value)) return result;
	for (const [id, batch] of Object.entries(value)) {
		if (!isRecord(batch) || typeof batch.profile !== "string" || !isProfileKey(batch.profile)) continue;
		if (batch.status !== "applied" && batch.status !== "undone") continue;
		const undo = parseUndo(batch.undo);
		if (undo) result[id] = { profile: batch.profile, undo, status: batch.status };
	}
	const keys = Object.keys(result);
	for (const key of keys.slice(0, Math.max(0, keys.length - BATCH_LIMIT))) delete result[key];
	return result;
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
			syncError: null,
			pairing: null,
			raid: null,
			position: { latest: null, trail: [], count: 0 },
			group: [],
			memberColors: {},
			companionStatus: null,
			exchanges: [],
			notice: null,
			commit: (update) => set((state) => update(state)),
			setStatus: (status) => set({ status }),
			setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
			setSyncError: (syncError) => set({ syncError }),
			setPairing: (pairing) => set({ pairing }),
			setRaid: (raid) =>
				set((state) => {
					const starting = raid?.phase === "loading" && state.raid?.phase !== "loading";
					return starting ? { raid, position: { ...state.position, trail: [] } } : { raid };
				}),
			setPosition: (latest, added) =>
				set((state) => ({
					position: {
						latest: latest ?? state.position.latest,
						trail: appendTrail(state.position.trail, latest ? [...added, latest] : added),
						count: state.position.count + added.length,
					},
				})),
			setGroup: (group) =>
				set((state) => ({
					group,
					memberColors: assignMemberColors(
						group.map((member) => member.id),
						state.memberColors,
					),
				})),
			setCompanionStatus: (companionStatus) => set({ companionStatus }),
			recordExchange: (exchange) => set((state) => ({ exchanges: [exchange, ...state.exchanges].slice(0, EXCHANGE_LIMIT) })),
			showNotice: (batchId) =>
				set((state) => ({ notice: { kind: "quest", batchId, nonce: (state.notice?.nonce ?? 0) + 1 } })),
			showRaidNotice: ({ profile, map }) =>
				set((state) => ({ notice: { kind: "raid", profile, map, nonce: (state.notice?.nonce ?? 0) + 1 } })),
			clearNotice: () => set({ notice: null }),
			connect: (connection) =>
				set({
					connection,
					cursor: null,
					status: "connected",
					pairing: null,
					raid: null,
					lastSyncAt: null,
					position: { latest: null, trail: [], count: 0 },
					group: [],
					memberColors: {},
					companionStatus: null,
				}),
			disconnect: () =>
				set((state) => ({
					connection: null,
					cursor: null,
					pending: {},
					review: {},
					// Queued and review changes are gone, so their entries can never apply.
					feed: state.feed.map((entry) =>
						entry.status === "waiting" || entry.status === "review"
							? { ...entry, status: "dismissed" as const }
							: entry,
					),
					status: "idle",
					pairing: null,
					raid: null,
					position: { latest: null, trail: [], count: 0 },
					group: [],
					memberColors: {},
					companionStatus: null,
					lastSyncAt: null,
					notice: null,
				})),
		}),
		{
			name: COMPANION_SYNC_STORAGE_KEY,
			version: 2,
			storage: createJSONStorage(() => localStorage),
			// v1 -> v2 only drops the aggregated \`log\`; merge below ignores unknown keys.
			migrate: (persisted) => persisted as PersistedSync,
			partialize: ({ connection, cursor, handled, pending, review, feed, batches, unknownMode }): PersistedSync => ({
				connection,
				cursor,
				handled,
				pending,
				review,
				feed,
				batches,
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
					feed: Array.isArray(saved.feed)
						? saved.feed
								.map(parseFeedEntry)
								.filter((entry): entry is FeedEntry => entry !== null)
								.slice(0, FEED_LIMIT)
						: [],
					batches: parseBatches(saved.batches),
					unknownMode: isCount(saved.unknownMode) ? saved.unknownMode : 0,
				};
			},
		},
	),
);
