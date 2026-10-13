import { getCurrentSeason } from "@/lib/cfg/seasons";
import { ACTIVITY_LOG_LIMIT, useCompanionSyncStore, type ActivityEntry } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { findCompanion, pairingState, requestPairing, sync, unpair } from "./companion-client";
import type { SyncResponse } from "./companion-contract";
import {
	activeProfileKey,
	addHandled,
	isEmptyChange,
	planBatch,
	routeEvents,
	undoChange,
	type PendingQuestEvent,
	type ProfileKey,
} from "./sync-model";

const syncStore = () => useCompanionSyncStore.getState();

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function activeProfile(): ProfileKey {
	const { gameMode, selectedSeasonId } = useUserStore.getState();
	return activeProfileKey(gameMode, selectedSeasonId);
}

/** Applies a batch to the active profile and returns the log entry (undefined if nothing changed). */
function applyToActiveProfile(profile: ProfileKey, items: readonly PendingQuestEvent[]): ActivityEntry | undefined {
	const user = useUserStore.getState();
	const plan = planBatch(items, user);
	if (isEmptyChange(plan.args)) return undefined;
	user.applyQuestCompletionChange(plan.args);
	return {
		id: newId(),
		at: new Date().toISOString(),
		profile,
		completed: plan.completed,
		failed: plan.failed,
		status: "applied",
		undo: plan.undo,
	};
}

function prependLog(log: ActivityEntry[], entries: ActivityEntry[]): ActivityEntry[] {
	return [...entries, ...log].slice(0, ACTIVITY_LOG_LIMIT);
}

function processSyncResponse(response: SyncResponse): void {
	const store = syncStore();
	const routed = routeEvents(response.events, {
		handled: store.handled,
		currentSeasonId: getCurrentSeason().id,
	});
	const active = activeProfile();
	const newEntries: ActivityEntry[] = [];
	const handledIds: Record<ProfileKey, string[]> = {};
	const pending = { ...store.pending };
	const review = { ...store.review };

	for (const [profile, items] of Object.entries(routed.live)) {
		(handledIds[profile] ??= []).push(...items.map((item) => item.id));
		if (profile === active) {
			const entry = applyToActiveProfile(profile, items);
			if (entry) newEntries.push(entry);
		} else {
			pending[profile] = [...(pending[profile] ?? []), ...items];
			const plan = planBatch(items, { completedQuests: {}, failedQuests: {} });
			newEntries.push({
				id: newId(),
				at: new Date().toISOString(),
				profile,
				completed: plan.completed,
				failed: plan.failed,
				status: "waiting",
			});
		}
	}
	for (const [profile, items] of Object.entries(routed.review)) {
		(handledIds[profile] ??= []).push(...items.map((item) => item.id));
		review[profile] = [...(review[profile] ?? []), ...items];
	}

	// Cursor, handled ids and queues are stored together so a replay cannot double-apply.
	store.commit((state) => {
		const handled = { ...state.handled };
		for (const [profile, ids] of Object.entries(handledIds)) handled[profile] = addHandled(handled[profile], ids);
		return {
			cursor: { epoch: response.epoch, seq: response.seq },
			handled,
			pending,
			review,
			log: prependLog(state.log, newEntries),
			unknownMode: state.unknownMode + routed.unknownMode,
		};
	});
	const announced = newEntries.find((entry) => entry.status === "applied");
	if (announced) store.showNotice(announced.id);
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

/** Applies the queue of the now-active profile as one merged, undoable entry. */
export function applyPendingForActive(): void {
	const store = syncStore();
	const profile = activeProfile();
	const items = store.pending[profile];
	if (!items?.length) return;
	const entry = applyToActiveProfile(profile, items);
	store.commit((state) => {
		const pending = { ...state.pending };
		delete pending[profile];
		const rest = state.log.filter((e) => !(e.profile === profile && e.status === "waiting"));
		return { pending, log: prependLog(rest, entry ? [entry] : []) };
	});
	if (entry) store.showNotice(entry.id);
}

export function canUndo(entry: ActivityEntry): boolean {
	return entry.status === "applied" && !!entry.undo?.quests.length;
}

/** Returns false when the entry's profile is not active (nothing is touched). */
export function undoEntry(id: string): boolean {
	const store = syncStore();
	const entry = store.log.find((e) => e.id === id);
	if (!entry || !canUndo(entry) || !entry.undo) return false;
	if (entry.profile !== activeProfile()) return false;
	useUserStore.getState().applyQuestCompletionChange(undoChange(entry.undo));
	store.patchLog(id, { status: "undone", undo: undefined });
	return true;
}

export function applyReview(profile: ProfileKey): boolean {
	const store = syncStore();
	const items = store.review[profile];
	if (!items?.length || profile !== activeProfile()) return false;
	const entry = applyToActiveProfile(profile, items);
	store.commit((state) => {
		const review = { ...state.review };
		delete review[profile];
		return { review, log: prependLog(state.log, entry ? [entry] : []) };
	});
	return true;
}

export function dismissReview(profile: ProfileKey): void {
	const store = syncStore();
	const items = store.review[profile];
	if (!items?.length) return;
	const plan = planBatch(items, { completedQuests: {}, failedQuests: {} });
	store.commit((state) => {
		const review = { ...state.review };
		delete review[profile];
		return {
			review,
			log: prependLog(state.log, [
				{
					id: newId(),
					at: new Date().toISOString(),
					profile,
					completed: plan.completed,
					failed: plan.failed,
					status: "dismissed",
				},
			]),
		};
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
	const fail = (phase: "denied" | "expired" | "unreachable" | "failed") => {
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
