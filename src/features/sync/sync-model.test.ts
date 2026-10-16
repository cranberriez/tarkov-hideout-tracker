import assert from "node:assert/strict";
import test from "node:test";
import type { CompanionEvent } from "./companion-contract";
import {
	activeProfileKey,
	addHandled,
	appendTrail,
	buildFeedEntries,
	capBatches,
	describeNotice,
	findRaidStart,
	mapDisplayName,
	mergeFeed,
	patchFeed,
	planBatch,
	planOutcomes,
	setBatchStatus,
	type BatchRecord,
	type FeedEntry,
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

const feedOptions = (overrides: Partial<Parameters<typeof buildFeedEntries>[1]> = {}) => ({
	currentSeasonId: "season-1",
	receivedAt: "2026-01-01T00:00:10Z",
	knownIds: new Set<string>(),
	handled: {},
	...overrides,
});

test("buildFeedEntries: accepted and raid events are info, completed/failed start waiting or review, unknown mode flagged", () => {
	const events: CompanionEvent[] = [
		quest("a", "q1", "accepted", "pve"),
		quest("b", "q2", "completed", "pve"),
		quest("c", "q3", "failed", "regular", true),
		quest("d", "q4", "completed", null),
		quest("e", "q5", "accepted", null),
		{ kind: "raid", seq: ++seq, id: "r1", at: "t", recovered: false, mode: "pve", phase: "in_raid", map: { raw: "Shoreline", normalized_name: "shoreline" } },
		{ kind: "raid", seq: ++seq, id: "r2", at: "t", recovered: false, mode: null, phase: "ended", map: null },
		{ kind: "position", seq: ++seq, id: "p", at: "t", recovered: false, mode: "pve", map: null, x: 0, y: 0, z: 0, yaw: null, captured_at: "t" },
	];
	const byId = new Map(buildFeedEntries(events, feedOptions()).map((entry) => [entry.id, entry]));
	assert.equal(byId.size, 7);
	assert.equal(byId.get("a")?.status, "info");
	assert.equal(byId.get("a")?.profile, "PVE");
	assert.equal(byId.get("b")?.status, "waiting");
	assert.equal(byId.get("c")?.status, "review");
	assert.equal(byId.get("c")?.recovered, true);
	assert.equal(byId.get("d")?.status, "unknown_mode");
	assert.equal(byId.get("d")?.profile, null);
	assert.equal(byId.get("e")?.status, "info");
	assert.equal(byId.get("e")?.profile, null);
	assert.deepEqual(byId.get("r1")?.map, { raw: "Shoreline", normalizedName: "shoreline" });
	assert.equal(byId.get("r1")?.status, "info");
	assert.equal(byId.get("r2")?.map, undefined);
	assert.equal(byId.has("p"), false);
});

test("buildFeedEntries dedupes on replay by feed ids, handled ids and within a batch", () => {
	const events: CompanionEvent[] = [
		quest("a", "q1", "completed", "pve"),
		quest("a", "q1", "completed", "pve"),
		quest("b", "q2", "completed", "pve"),
		quest("c", "q3", "accepted", "pve"),
	];
	const first = buildFeedEntries(events, feedOptions({ handled: { PVE: ["b"] } }));
	assert.deepEqual(first.map((entry) => entry.id), ["a", "c"]);
	const replay = buildFeedEntries(events, feedOptions({ knownIds: new Set(["a", "c"]), handled: { PVE: ["a", "b"] } }));
	assert.equal(replay.length, 0);
	const feed = mergeFeed(first, buildFeedEntries(events, feedOptions()));
	assert.equal(new Set(feed.map((entry) => entry.id)).size, feed.length);
});

test("planOutcomes marks changed events applied and the rest unchanged", () => {
	const items: PendingQuestEvent[] = [
		{ id: "1", at: "", action: "completed", questId: "q1" },
		{ id: "2", at: "", action: "failed", questId: "q1" },
		{ id: "3", at: "", action: "completed", questId: "q2" },
		{ id: "4", at: "", action: "completed", questId: "q3" },
	];
	const plan = planBatch(items, { completedQuests: { q2: true }, failedQuests: {} });
	const outcomes = planOutcomes(items, plan);
	assert.equal(outcomes.get("1"), "unchanged");
	assert.equal(outcomes.get("2"), "applied");
	assert.equal(outcomes.get("3"), "unchanged");
	assert.equal(outcomes.get("4"), "applied");
});

function entry(id: string, at: string, overrides: Partial<FeedEntry> = {}): FeedEntry {
	return { id, at, receivedAt: at, profile: "PVE", kind: "quest", action: "completed", questId: id, recovered: false, status: "waiting", ...overrides };
}

test("mergeFeed sorts newest first, caps, and batch undo flips only applied entries of that batch", () => {
	const merged = mergeFeed(
		[entry("old", "2026-01-01T00:00:00Z")],
		[entry("new", "2026-01-03T00:00:00Z"), entry("mid", "2026-01-02T00:00:00Z")],
	);
	assert.deepEqual(merged.map((e) => e.id), ["new", "mid", "old"]);
	assert.equal(mergeFeed(merged, [], 2).length, 2);

	let feed = patchFeed(merged, new Map([
		["new", { status: "applied" as const, batchId: "b1" }],
		["mid", { status: "applied" as const, batchId: "b1" }],
		["old", { status: "unchanged" as const }],
	]));
	feed = setBatchStatus(feed, "b1", "undone");
	assert.deepEqual(feed.map((e) => e.status), ["undone", "undone", "unchanged"]);
});

test("capBatches drops the oldest", () => {
	const batch: BatchRecord = { profile: "PVE", undo: { quests: [] }, status: "applied" };
	const capped = capBatches({ a: batch, b: batch, c: batch }, 2);
	assert.deepEqual(Object.keys(capped), ["b", "c"]);
});

test("mapDisplayName and describeNotice", () => {
	assert.equal(mapDisplayName({ raw: "x", normalizedName: "streets-of-tarkov" }), "Streets of Tarkov");
	assert.equal(mapDisplayName({ raw: "Raw", normalizedName: null }), "Raw");
	assert.equal(mapDisplayName({ raw: "x", normalizedName: "new-map-name" }), "New Map Name");
	assert.equal(describeNotice([{ action: "completed", name: "Debut" }], "PVE"), "Completed: Debut");
	assert.equal(
		describeNotice([{ action: "completed", name: "A" }, { action: "completed", name: "B" }, { action: "completed", name: "C" }], "PVE"),
		"Completed 3 PVE quests",
	);
	assert.equal(describeNotice([{ action: "failed", name: null }], "PVP"), "Failed 1 PVP quest");
});

test("appendTrail dedupes, orders by capture time and caps", () => {
	const at = (n: number) => ({ map: null, x: n, y: 0, z: n, yaw: null, captured_at: new Date(n * 1000).toISOString() });
	const trail = appendTrail([at(2)], [at(3), at(1), at(2)], 3);
	assert.deepEqual(trail.map((position) => position.x), [1, 2, 3]);
	assert.deepEqual(appendTrail(trail, [at(4)], 3).map((position) => position.x), [2, 3, 4]);
	assert.equal(appendTrail(trail, [at(3)]), trail);
});

test("findRaidStart picks the newest live loading raid", () => {
	const raid = (id: string, phase: "loading" | "ended", recovered = false): FeedEntry => ({
		id, at: "", receivedAt: "", profile: "PVE", kind: "raid", phase, recovered, status: "info",
	});
	assert.equal(findRaidStart([raid("a", "loading"), raid("b", "loading"), raid("c", "ended")])?.id, "b");
	assert.equal(findRaidStart([raid("a", "loading", true)]), undefined);
});
