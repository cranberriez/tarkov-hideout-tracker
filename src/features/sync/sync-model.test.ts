import assert from "node:assert/strict";
import test from "node:test";
import type { CompanionEvent } from "./companion-contract";
import {
	activeProfileKey,
	addHandled,
	planBatch,
	profileForMode,
	routeEvents,
	undoChange,
	type PendingQuestEvent,
} from "./sync-model";

let seq = 0;
function quest(
	id: string,
	questId: string,
	action: "accepted" | "completed" | "failed",
	mode: string | null,
	recovered = false,
): CompanionEvent {
	return { kind: "quest", seq: ++seq, id, at: "2026-01-01T00:00:00Z", recovered, mode, action, quest_id: questId };
}

test("profileForMode maps exactly and never falls back to PVP", () => {
	assert.equal(profileForMode("regular", "season-1"), "PVP");
	assert.equal(profileForMode("pve", "season-1"), "PVE");
	assert.equal(profileForMode("pvp-season", "season-2"), "KORD:season-2");
	for (const mode of [null, undefined, "", "PVE", "pvp", "kord", "other"]) {
		assert.equal(profileForMode(mode, "season-1"), null);
	}
});

test("activeProfileKey uses the selected season for KORD", () => {
	assert.equal(activeProfileKey("PVP", "season-1"), "PVP");
	assert.equal(activeProfileKey("PVE", "season-1"), "PVE");
	assert.equal(activeProfileKey("KORD", "season-2"), "KORD:season-2");
});

test("routeEvents skips handled ids, splits recovered, counts unknown modes, ignores other events", () => {
	const events: CompanionEvent[] = [
		quest("a", "q1", "completed", "pve"),
		quest("b", "q2", "failed", "pve"),
		quest("c", "q3", "completed", "regular", true),
		quest("d", "q4", "completed", null),
		quest("e", "q5", "completed", "weird"),
		quest("f", "q6", "accepted", "pve"),
		quest("a", "q1", "completed", "pve"),
		quest("g", "q7", "completed", "pvp-season"),
		{ kind: "raid", seq: ++seq, id: "r", at: "", recovered: false, mode: "pve", phase: "ended", map: null },
	];
	const routed = routeEvents(events, { handled: { PVE: ["b"] }, currentSeasonId: "season-1" });
	assert.deepEqual(
		routed.live.PVE?.map((e) => e.id),
		["a"],
	);
	assert.deepEqual(
		routed.live["KORD:season-1"]?.map((e) => e.questId),
		["q7"],
	);
	assert.deepEqual(
		routed.review.PVP?.map((e) => e.id),
		["c"],
	);
	assert.equal(routed.live.PVP, undefined);
	assert.equal(routed.unknownMode, 2);
});

test("planBatch counts only real changes and later events win", () => {
	const items: PendingQuestEvent[] = [
		{ id: "1", at: "", action: "completed", questId: "q1" },
		{ id: "2", at: "", action: "failed", questId: "q1" },
		{ id: "3", at: "", action: "completed", questId: "q2" },
		{ id: "4", at: "", action: "completed", questId: "q3" },
	];
	const plan = planBatch(items, { completedQuests: { q2: true }, failedQuests: {} });
	assert.deepEqual(plan.args, { complete: ["q3"], uncomplete: [], fail: ["q1"], unFail: [] });
	assert.equal(plan.completed, 1);
	assert.equal(plan.failed, 1);
	assert.deepEqual(
		plan.undo.quests.map((q) => q.questId),
		["q1", "q3"],
	);
});

test("undoChange restores exact prior booleans", () => {
	const plan = planBatch(
		[
			{ id: "1", at: "", action: "failed", questId: "a" },
			{ id: "2", at: "", action: "completed", questId: "b" },
			{ id: "3", at: "", action: "completed", questId: "c" },
		],
		{ completedQuests: { a: true }, failedQuests: { b: true } },
	);
	assert.deepEqual(undoChange(plan.undo), { complete: ["a"], uncomplete: ["c"], fail: ["b"], unFail: ["c"] });
});

test("addHandled keeps the newest 2000 and dedupes", () => {
	const ids = Array.from({ length: 2005 }, (_, i) => `id${i}`);
	const trimmed = addHandled([], ids);
	assert.equal(trimmed.length, 2000);
	assert.equal(trimmed[0], "id5");
	assert.deepEqual(addHandled(["x", "y"], ["y", "z"]), ["x", "y", "z"]);
});
