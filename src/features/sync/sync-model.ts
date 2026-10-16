import type { GameMode, TarkovJsonGameMode } from "@/lib/game-mode";
import mapManifest from "../../lib/data/map-overlays/manifest.json";
import type { CompanionEvent, Position, QuestAction, RaidPhase } from "./companion-contract";

export const HANDLED_LIMIT = 2000;

/** `PVP` | `PVE` | `KORD:<seasonId>`. */
export type ProfileKey = string;

export interface PendingQuestEvent {
	id: string;
	at: string;
	action: "completed" | "failed";
	questId: string;
}

export interface QuestStateSnapshot {
	questId: string;
	completed: boolean;
	failed: boolean;
}

export interface UndoRecord {
	quests: QuestStateSnapshot[];
}

export interface QuestChangeArgs {
	complete: string[];
	uncomplete: string[];
	fail: string[];
	unFail: string[];
}

/** Exact match only: unknown modes must never fall back to PVP. */
export function profileForMode(mode: string | null | undefined, currentSeasonId: string): ProfileKey | null {
	if (mode === "regular") return "PVP";
	if (mode === "pve") return "PVE";
	if (mode === "pvp-season") return `KORD:${currentSeasonId}`;
	return null;
}

export function activeProfileKey(gameMode: GameMode, selectedSeasonId: string): ProfileKey {
	return gameMode === "KORD" ? `KORD:${selectedSeasonId}` : gameMode;
}

export function describeProfile(profile: ProfileKey): string {
	return profile.startsWith("KORD") ? "KORD" : profile;
}

export interface RoutedEvents {
	live: Record<ProfileKey, PendingQuestEvent[]>;
	review: Record<ProfileKey, PendingQuestEvent[]>;
	unknownMode: number;
}

export function routeEvents(
	events: readonly CompanionEvent[],
	options: { handled: Record<ProfileKey, readonly string[]>; currentSeasonId: string },
): RoutedEvents {
	const result: RoutedEvents = { live: {}, review: {}, unknownMode: 0 };
	const seen = new Set<string>();
	const handledSets = new Map<ProfileKey, Set<string>>();
	for (const event of events) {
		if (event.kind !== "quest") continue;
		if (event.action !== "completed" && event.action !== "failed") continue;
		const profile = profileForMode(event.mode, options.currentSeasonId);
		if (!profile) {
			result.unknownMode += 1;
			continue;
		}
		let handled = handledSets.get(profile);
		if (!handled) handledSets.set(profile, (handled = new Set(options.handled[profile] ?? [])));
		const key = `${profile}\u0000${event.id}`;
		if (handled.has(event.id) || seen.has(key)) continue;
		seen.add(key);
		const target = event.recovered ? result.review : result.live;
		(target[profile] ??= []).push({ id: event.id, at: event.at, action: event.action, questId: event.quest_id });
	}
	return result;
}

export interface BatchPlan {
	args: QuestChangeArgs;
	undo: UndoRecord;
	completed: number;
	failed: number;
}

/** Later events for a quest win; only quests whose state would actually change count. */
export function planBatch(
	items: readonly PendingQuestEvent[],
	current: { completedQuests: Record<string, boolean>; failedQuests: Record<string, boolean> },
): BatchPlan {
	const finalAction = new Map<string, "completed" | "failed">();
	for (const item of items) finalAction.set(item.questId, item.action);
	const plan: BatchPlan = {
		args: { complete: [], uncomplete: [], fail: [], unFail: [] },
		undo: { quests: [] },
		completed: 0,
		failed: 0,
	};
	for (const [questId, action] of finalAction) {
		const completed = current.completedQuests[questId] === true;
		const failed = current.failedQuests[questId] === true;
		const wantCompleted = action === "completed";
		if (completed === wantCompleted && failed === !wantCompleted) continue;
		plan.undo.quests.push({ questId, completed, failed });
		if (wantCompleted) {
			plan.args.complete.push(questId);
			plan.completed += 1;
		} else {
			plan.args.fail.push(questId);
			plan.failed += 1;
		}
	}
	return plan;
}

/** Arguments that restore the exact prior booleans. */
export function undoChange(record: UndoRecord): QuestChangeArgs {
	const args: QuestChangeArgs = { complete: [], uncomplete: [], fail: [], unFail: [] };
	for (const { questId, completed, failed } of record.quests) {
		if (completed) args.complete.push(questId);
		else if (failed) args.fail.push(questId);
		else {
			args.uncomplete.push(questId);
			args.unFail.push(questId);
		}
	}
	return args;
}

export function isEmptyChange(args: QuestChangeArgs): boolean {
	return !args.complete.length && !args.uncomplete.length && !args.fail.length && !args.unFail.length;
}

/** Appends ids (oldest first) and keeps the newest `limit`. */
export function addHandled(existing: readonly string[] | undefined, ids: readonly string[], limit = HANDLED_LIMIT): string[] {
	const have = new Set(existing ?? []);
	const merged = [...(existing ?? []), ...ids.filter((id) => !have.has(id))];
	return merged.length > limit ? merged.slice(merged.length - limit) : merged;
}

export const FEED_LIMIT = 300;
export const BATCH_LIMIT = 50;

export type FeedStatus =
	| "applied"
	| "unchanged"
	| "waiting"
	| "review"
	| "undone"
	| "dismissed"
	| "info"
	| "unknown_mode";

export interface FeedEntry {
	/** Companion event id. */
	id: string;
	/** Event time. */
	at: string;
	receivedAt: string;
	profile: ProfileKey | null;
	kind: "quest" | "raid";
	action?: QuestAction;
	questId?: string;
	phase?: RaidPhase;
	map?: { raw: string; normalizedName: string | null };
	recovered: boolean;
	status: FeedStatus;
	batchId?: string;
}

export interface BatchRecord {
	profile: ProfileKey;
	undo: UndoRecord;
	status: "applied" | "undone";
}

/** Profile to the Tarkov data mode its quest data lives in. */
export function dataModeForProfile(profile: ProfileKey): TarkovJsonGameMode {
	if (profile === "PVE") return "pve";
	if (profile.startsWith("KORD")) return "pvp-season";
	return "regular";
}

/**
 * Builds feed entries for events not yet seen. Quest completed/failed entries start as
 * `waiting` (live) or `review` (recovered) and are resolved by the caller once routed.
 * Skips ids already in the feed and quest ids already handled for their profile.
 */
export function buildFeedEntries(
	events: readonly CompanionEvent[],
	options: {
		currentSeasonId: string;
		receivedAt: string;
		knownIds: ReadonlySet<string>;
		handled: Record<ProfileKey, readonly string[]>;
	},
): FeedEntry[] {
	const entries: FeedEntry[] = [];
	const seen = new Set<string>();
	const handledSets = new Map<ProfileKey, Set<string>>();
	for (const event of events) {
		if (event.kind === "position") continue;
		if (
			event.kind === "quest" &&
			event.action !== "accepted" &&
			event.action !== "completed" &&
			event.action !== "failed"
		)
			continue;
		if (options.knownIds.has(event.id) || seen.has(event.id)) continue;
		const profile = profileForMode(event.mode, options.currentSeasonId);
		const base = { id: event.id, at: event.at, receivedAt: options.receivedAt, profile, recovered: event.recovered };
		if (event.kind === "raid") {
			seen.add(event.id);
			entries.push({
				...base,
				kind: "raid",
				phase: event.phase,
				...(event.map ? { map: { raw: event.map.raw, normalizedName: event.map.normalized_name } } : {}),
				status: "info",
			});
			continue;
		}
		const quest = { ...base, kind: "quest" as const, action: event.action, questId: event.quest_id };
		if (event.action === "accepted") {
			seen.add(event.id);
			entries.push({ ...quest, status: "info" });
			continue;
		}
		if (profile) {
			let handled = handledSets.get(profile);
			if (!handled) handledSets.set(profile, (handled = new Set(options.handled[profile] ?? [])));
			if (handled.has(event.id)) continue;
		}
		seen.add(event.id);
		entries.push({ ...quest, status: !profile ? "unknown_mode" : event.recovered ? "review" : "waiting" });
	}
	return entries;
}

export const TRAIL_LIMIT = 20;

const positionKey = (position: Position) => `${position.captured_at}|${position.x}|${position.y}|${position.z}`;

/** `trail` with new positions merged in by capture time (deduped), keeping the newest `limit`. */
export function appendTrail(trail: readonly Position[], added: readonly Position[], limit = TRAIL_LIMIT): Position[] {
	const keys = new Set(trail.map(positionKey));
	const fresh = added.filter((position) => !keys.has(positionKey(position)) && keys.add(positionKey(position)));
	if (!fresh.length) return trail as Position[];
	const time = (position: Position) => Date.parse(position.captured_at) || 0;
	return [...trail, ...fresh].sort((a, b) => time(a) - time(b)).slice(-limit);
}

/** The newest live (not recovered) raid that is starting to load, if any; `entries` are in journal order. */
export function findRaidStart(entries: readonly FeedEntry[]): FeedEntry | undefined {
	return entries.findLast((entry) => entry.kind === "raid" && entry.phase === "loading" && !entry.recovered);
}

/** Per-event result of applying a batch: later events for a quest supersede earlier ones. */
export function planOutcomes(
	items: readonly PendingQuestEvent[],
	plan: BatchPlan,
): Map<string, "applied" | "unchanged"> {
	const changed = new Set(plan.undo.quests.map((quest) => quest.questId));
	const finalAction = new Map<string, string>();
	for (const item of items) finalAction.set(item.questId, item.action);
	const outcomes = new Map<string, "applied" | "unchanged">();
	for (const item of items) {
		outcomes.set(
			item.id,
			changed.has(item.questId) && finalAction.get(item.questId) === item.action ? "applied" : "unchanged",
		);
	}
	return outcomes;
}

export function patchFeed(
	feed: readonly FeedEntry[],
	updates: ReadonlyMap<string, Partial<Pick<FeedEntry, "status" | "batchId">>>,
): FeedEntry[] {
	return feed.map((entry) => {
		const patch = updates.get(entry.id);
		return patch ? { ...entry, ...patch } : entry;
	});
}

/** Flips every entry of a batch that is still `applied` to `status`. */
export function setBatchStatus(feed: readonly FeedEntry[], batchId: string, status: FeedStatus): FeedEntry[] {
	return feed.map((entry) => (entry.batchId === batchId && entry.status === "applied" ? { ...entry, status } : entry));
}

const timeOf = (entry: FeedEntry) => {
	const at = Date.parse(entry.at);
	return Number.isNaN(at) ? Date.parse(entry.receivedAt) || 0 : at;
};

/** Newest event first, deduped by id, capped. */
export function mergeFeed(existing: readonly FeedEntry[], added: readonly FeedEntry[], limit = FEED_LIMIT): FeedEntry[] {
	const ids = new Set<string>();
	const merged: FeedEntry[] = [];
	// `added` arrives in journal order (oldest first); reversing keeps equal timestamps newest first.
	for (const entry of [...added].reverse().concat(existing)) {
		if (ids.has(entry.id)) continue;
		ids.add(entry.id);
		merged.push(entry);
	}
	return merged.sort((a, b) => timeOf(b) - timeOf(a)).slice(0, limit);
}

/** Keeps the newest `limit` batches (insertion order). */
export function capBatches(batches: Record<string, BatchRecord>, limit = BATCH_LIMIT): Record<string, BatchRecord> {
	const keys = Object.keys(batches);
	if (keys.length <= limit) return batches;
	const result: Record<string, BatchRecord> = {};
	for (const key of keys.slice(keys.length - limit)) result[key] = batches[key];
	return result;
}

const manifestMaps = new Map(
	(mapManifest as { maps: { name: string; normalizedName: string }[] }).maps.map((map) => [
		map.normalizedName,
		map.name,
	]),
);

/** Known map display name, else the normalized name title-cased, else the raw name. */
export function mapDisplayName(map: { raw: string; normalizedName: string | null }): string {
	if (!map.normalizedName) return map.raw;
	return (
		manifestMaps.get(map.normalizedName) ??
		map.normalizedName
			.split("-")
			.filter(Boolean)
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(" ")
	);
}

/** "Completed: Debut", or "Completed 3 PVE quests" when long or a name is unknown. */
export function describeNotice(items: readonly { action: QuestAction; name: string | null }[], label: string): string {
	const parts: string[] = [];
	for (const [action, word] of [
		["completed", "Completed"],
		["failed", "Failed"],
	] as const) {
		const group = items.filter((item) => item.action === action);
		if (!group.length) continue;
		const names = group.map((item) => item.name);
		parts.push(
			group.length > 2 || names.some((name) => !name)
				? `${word} ${group.length} ${label} ${group.length === 1 ? "quest" : "quests"}`
				: `${word}: ${names.join(", ")}`,
		);
	}
	return parts.join(" · ");
}
