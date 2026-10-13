import type { GameMode } from "@/lib/game-mode";
import type { CompanionEvent } from "./companion-contract";

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

/** "2 completed", "1 failed" or "2 completed, 1 failed". */
export function describeCounts(completed: number, failed: number): string {
	return [completed ? `${completed} completed` : "", failed ? `${failed} failed` : ""].filter(Boolean).join(", ");
}
