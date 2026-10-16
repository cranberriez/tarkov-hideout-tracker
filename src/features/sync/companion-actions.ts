import { getCurrentSeason, type SeasonId } from "@/lib/cfg/seasons";
import type { GameMode } from "@/lib/game-mode";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { findCompanion, pairingState, requestPairing, sync, unpair } from "./companion-client";
import type { SyncResponse } from "./companion-contract";
import {
	activeProfileKey,
	addHandled,
	buildFeedEntries,
	capBatches,
	findRaidStart,
	isEmptyChange,
	mergeFeed,
	patchFeed,
	planBatch,
	planOutcomes,
	routeEvents,
	setBatchStatus,
	undoChange,
	type BatchRecord,
	type FeedEntry,
	type PendingQuestEvent,
	type ProfileKey,
} from "./sync-model";

const syncStore = () => useCompanionSyncStore.getState();

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

type FeedUpdates = Map<string, Partial<Pick<FeedEntry, "status" | "batchId">>>;

function activeProfile(): ProfileKey {
	const { gameMode, selectedSeasonId } = useUserStore.getState();
	return activeProfileKey(gameMode, selectedSeasonId);
}

interface AppliedBatch {
	/** Set only when something actually changed (an undoable batch exists). */
	batchId: string | null;
	batch?: BatchRecord;
	updates: FeedUpdates;
}

/** Applies items to the active profile; every item gets an applied/unchanged feed update. */
function applyToActiveProfile(profile: ProfileKey, items: readonly PendingQuestEvent[]): AppliedBatch {
	const user = useUserStore.getState();
	const plan = planBatch(items, user);
	const outcomes = planOutcomes(items, plan);
	const changed = !isEmptyChange(plan.args);
	const batchId = changed ? newId() : null;
	if (changed) user.applyQuestCompletionChange(plan.args);
	const updates: FeedUpdates = new Map();
	for (const [id, status] of outcomes) {
		updates.set(id, status === "applied" && batchId ? { status, batchId } : { status: "unchanged" });
	}
	return batchId
		? { batchId, batch: { profile, undo: plan.undo, status: "applied" }, updates }
		: { batchId, updates };
}

function processSyncResponse(response: SyncResponse): void {
	const store = syncStore();
	const currentSeasonId = getCurrentSeason().id;
	const routed = routeEvents(response.events, { handled: store.handled, currentSeasonId });
	const entries = buildFeedEntries(response.events, {
		currentSeasonId,
		receivedAt: new Date().toISOString(),
		knownIds: new Set(store.feed.map((entry) => entry.id)),
		handled: store.handled,
	});
	const active = activeProfile();
	const handledIds: Record<ProfileKey, string[]> = {};
	const pending = { ...store.pending };
	const review = { ...store.review };
	const updates: FeedUpdates = new Map();
	const newBatches: Record<string, BatchRecord> = {};
	let announced: string | null = null;

	for (const [profile, items] of Object.entries(routed.live)) {
		(handledIds[profile] ??= []).push(...items.map((item) => item.id));
		if (profile === active) {
			const applied = applyToActiveProfile(profile, items);
			for (const [id, patch] of applied.updates) updates.set(id, patch);
			if (applied.batchId && applied.batch) {
				newBatches[applied.batchId] = applied.batch;
				announced = applied.batchId;
			}
		} else {
			pending[profile] = [...(pending[profile] ?? []), ...items];
		}
	}
	for (const [profile, items] of Object.entries(routed.review)) {
		(handledIds[profile] ??= []).push(...items.map((item) => item.id));
		review[profile] = [...(review[profile] ?? []), ...items];
	}

	// Cursor, handled ids, queues and the feed are stored together so a replay cannot double-apply.
	store.commit((state) => {
		const handled = { ...state.handled };
		for (const [profile, ids] of Object.entries(handledIds)) handled[profile] = addHandled(handled[profile], ids);
		return {
			cursor: { epoch: response.epoch, seq: response.seq },
			handled,
			pending,
			review,
			feed: patchFeed(mergeFeed(state.feed, entries), updates),
			batches: capBatches({ ...state.batches, ...newBatches }),
			unknownMode: state.unknownMode + entries.filter((entry) => entry.status === "unknown_mode").length,
		};
	});
	store.setPosition(
		response.state.position,
		response.events.filter((event) => event.kind === "position"),
	);
	if (announced) store.showNotice(announced);
		// Announced after quest changes, so a raid starting is what the user sees when both arrive together.
		const raidStart = findRaidStart(entries);
		if (raidStart) store.showRaidNotice({ profile: raidStart.profile, map: raidStart.map ?? null });
}

let inFlight = false;

/** One poll. `stop` means polling must end (token revoked); `fast` means a raid is in progress. */
export async function runSyncOnce(): Promise<{ stop: boolean; fast: boolean }> {
	if (inFlight) return { stop: false, fast: false };
	inFlight = true;
	try {
		const store = syncStore();
		const connection = store.connection;
		if (!connection) return { stop: true, fast: false };
		let since = store.cursor?.seq ?? 0;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const result = await sync(connection.port, connection.token, since);
			// The user may have disconnected or re-paired while waiting.
			if (syncStore().connection?.token !== connection.token) return { stop: true, fast: false };
			if (result.kind === "unauthorized") {
				store.setStatus("revoked");
				return { stop: true, fast: false };
			}
			if (result.kind === "unreachable") {
				store.setStatus("unreachable");
				return { stop: false, fast: false };
			}
			if (result.kind === "bad_cursor") {
				store.commit(() => ({ cursor: null }));
				since = 0;
				continue;
			}
			if (result.kind === "error") {
				store.setStatus("unreachable");
				return { stop: false, fast: false };
			}
			const cursor = syncStore().cursor;
			if (cursor && cursor.epoch !== result.data.epoch && since !== 0) {
				store.commit(() => ({ cursor: null }));
				since = 0;
				continue;
			}
			processSyncResponse(result.data);
			store.setStatus("connected");
			store.setLastSyncAt(Date.now());
			store.setRaid(result.data.state.raid);
			const phase = result.data.state.raid?.phase;
			return { stop: false, fast: phase === "loading" || phase === "in_raid" };
		}
		return { stop: false, fast: false };
	} finally {
		inFlight = false;
	}
}

/** Applies the queue of the now-active profile as one merged, undoable batch. */
export function applyPendingForActive(): void {
	const store = syncStore();
	const profile = activeProfile();
	const items = store.pending[profile];
	if (!items?.length) return;
	const applied = applyToActiveProfile(profile, items);
	store.commit((state) => {
		const pending = { ...state.pending };
		delete pending[profile];
		return {
			pending,
			feed: patchFeed(state.feed, applied.updates),
			batches:
				applied.batchId && applied.batch
					? capBatches({ ...state.batches, [applied.batchId]: applied.batch })
					: state.batches,
		};
	});
	if (applied.batchId) store.showNotice(applied.batchId);
}

export function canUndo(batchId: string): boolean {
	const batch = syncStore().batches[batchId];
	return batch?.status === "applied" && batch.undo.quests.length > 0;
}

/** Returns false when the batch's profile is not active (nothing is touched). */
export function undoBatch(batchId: string): boolean {
	const store = syncStore();
	const batch = store.batches[batchId];
	if (!batch || !canUndo(batchId) || batch.profile !== activeProfile()) return false;
	useUserStore.getState().applyQuestCompletionChange(undoChange(batch.undo));
	store.commit((state) => ({
		batches: { ...state.batches, [batchId]: { ...batch, status: "undone" } },
		feed: setBatchStatus(state.feed, batchId, "undone"),
	}));
	return true;
}

export function applyReview(profile: ProfileKey): boolean {
	const store = syncStore();
	const items = store.review[profile];
	if (!items?.length || profile !== activeProfile()) return false;
	const applied = applyToActiveProfile(profile, items);
	store.commit((state) => {
		const review = { ...state.review };
		delete review[profile];
		return {
			review,
			feed: patchFeed(state.feed, applied.updates),
			batches:
				applied.batchId && applied.batch
					? capBatches({ ...state.batches, [applied.batchId]: applied.batch })
					: state.batches,
		};
	});
	return true;
}

export function dismissReview(profile: ProfileKey): void {
	const store = syncStore();
	const items = store.review[profile];
	if (!items?.length) return;
	const updates: FeedUpdates = new Map(items.map((item) => [item.id, { status: "dismissed" }]));
	store.commit((state) => {
		const review = { ...state.review };
		delete review[profile];
		return { review, feed: patchFeed(state.feed, updates) };
	});
}

let pairingRun = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function cancelPairing(): void {
	pairingRun += 1;
	const store = syncStore();
	if (store.pairing) store.setPairing(null);
	if (store.status === "pairing") store.setStatus(store.connection ? "connected" : "idle");
}

/** Scan for the companion, request pairing, and wait for the user to approve in the app. */
export async function connectCompanion(): Promise<void> {
	const run = ++pairingRun;
	const store = syncStore();
	const cancelled = () => run !== pairingRun;
	const fail = (phase: "denied" | "expired" | "unreachable" | "failed" | "revoked") => {
		store.setPairing({ phase });
		// An existing connection's next poll restores its real status.
		store.setStatus("idle");
	};
	store.setStatus("pairing");
	store.setPairing({ phase: "scanning" });

	const found = await findCompanion(store.connection?.port);
	if (cancelled()) return;
	if (!found) return fail("unreachable");
	const requested = await requestPairing(found.port);
	if (cancelled()) return;
	if (requested.kind === "unreachable") return fail("unreachable");
	if (requested.kind === "revoked") return fail("revoked");
	if (requested.kind !== "ok") return fail("failed");

	const { pairing_id: id, expires_in_secs: ttl } = requested.data;
	const expiresAt = Date.now() + ttl * 1000;
	store.setPairing({ phase: "waiting", expiresAt });
	while (Date.now() < expiresAt + 3000) {
		await sleep(1000);
		if (cancelled()) return;
		const state = await pairingState(found.port, id);
		if (cancelled()) return;
		if (state.kind === "unreachable") return fail("unreachable");
		if (state.kind !== "ok") return fail("failed");
		if (state.data.state === "pending") continue;
		if (state.data.state === "allowed") {
			store.connect({ port: found.port, token: state.data.token, pairedAt: new Date().toISOString() });
			return;
		}
		return fail(state.data.state);
	}
	fail("expired");
}

export async function disconnectCompanion(): Promise<void> {
	cancelPairing();
	const store = syncStore();
	const connection = store.connection;
	store.disconnect();
	if (connection) void unpair(connection.port, connection.token);
}


/** Whether `profile` is the active one or can be switched to (a KORD season must already be activated). */
export function canSwitchToProfile(profile: ProfileKey): boolean {
	if (profile === activeProfile() || !profile.startsWith("KORD:")) return true;
	return !!useUserStore.getState().seasonalProfiles[profile.slice("KORD:".length) as SeasonId];
}

/**
 * Makes `profile` the active profile. Only for an explicit user action (the raid notice's button); polling never
 * switches profiles. Returns false, changing nothing, when it can't switch.
 */
export function switchToProfile(profile: ProfileKey): boolean {
	if (profile === activeProfile()) return true;
	if (!canSwitchToProfile(profile)) return false;
	const user = useUserStore.getState();
	if (profile.startsWith("KORD:")) user.selectSeason(profile.slice("KORD:".length) as SeasonId);
	else user.setGameMode(profile as GameMode);
	return true;
}
