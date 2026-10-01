import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types/quests";
import { buildQuestTraderBoard } from "./quest-trader-board-model";
import type { QuestLockReason, QuestWorkspaceStatusInfo } from "./quest-workspace-utils";

const prapor = { id: "prapor", name: "Prapor", normalizedName: "prapor" };
const therapist = { id: "therapist", name: "Therapist", normalizedName: "therapist" };

function makeQuest(id: string, trader: FullQuest["trader"], loyalty?: number): FullQuest {
	return {
		id,
		name: id,
		normalizedName: id,
		minPlayerLevel: 1,
		experience: 0,
		trader,
		taskRequirements: [],
		traderRequirements: loyalty
			? [{ id: `${id}-loyalty`, trader, requirementType: "loyaltyLevel", compareMethod: ">=", value: loyalty }]
			: [],
		otherRequirements: [],
		objectives: [],
	};
}

function status(value: QuestWorkspaceStatusInfo["status"], reasons: QuestLockReason[] = []): QuestWorkspaceStatusInfo {
	const terminal = value === "completed" || value === "failed" ? value : null;
	return { status: value, label: value, reasons, terminal };
}

test("groups by trader and loyalty level, folds resolved quests, and orders open quests by status", () => {
	const quests = [
		makeQuest("therapist-one", therapist),
		makeQuest("prapor-locked", prapor),
		makeQuest("prapor-upcoming", prapor),
		makeQuest("prapor-active", prapor),
		makeQuest("prapor-done", prapor),
		makeQuest("prapor-failed", prapor),
		makeQuest("prapor-ll2", prapor, 2),
		makeQuest("prapor-hidden", prapor),
		makeQuest("prapor-faction", prapor),
		makeQuest("prapor-branch", prapor),
	];
	const statuses: Record<string, QuestWorkspaceStatusInfo> = {
		"therapist-one": status("active"),
		"prapor-locked": status("locked", [{ kind: "level", label: "Level 10" }]),
		"prapor-upcoming": status("locked", [{ kind: "level", label: "Level 2" }]),
		"prapor-active": status("active"),
		"prapor-done": status("completed"),
		"prapor-failed": status("failed", [{ kind: "branch", label: "Quest marked failed" }]),
		"prapor-ll2": status("locked", [{ kind: "loyalty", label: "LL2" }]),
		"prapor-hidden": status("active"),
		"prapor-faction": status("locked", [{ kind: "faction", label: "Requires BEAR" }]),
		"prapor-branch": status("locked", [{ kind: "branch", label: "Unavailable quest branch" }]),
	};

	const board = buildQuestTraderBoard({
		quests,
		statusByQuestId: new Map(Object.entries(statuses)),
		upcomingLockedQuestIds: new Set(["prapor-upcoming"]),
		hiddenQuests: { "prapor-hidden": true },
		questOrderById: new Map(quests.map((quest, index) => [quest.id, index])),
	});

	assert.deepEqual(
		board.map((column) => [column.trader.id, column.doneCount, column.totalCount]),
		[
			["prapor", 2, 6],
			["therapist", 0, 1],
		],
	);
	assert.deepEqual(
		board[0].sections.map((section) => [
			section.key,
			section.groups.map((group) => group.questIds),
			section.doneQuestIds,
		]),
		[
			[
				1,
				[["prapor-active", "prapor-upcoming", "prapor-locked", "prapor-done", "prapor-failed"]],
				["prapor-done", "prapor-failed"],
			],
			[2, [["prapor-ll2"]], []],
		],
	);
});

test("orders Essential series quests by chain position rather than status", () => {
	const mechanic = { id: "mechanic", name: "Mechanic", normalizedName: "mechanic" };
	// "To the Light" is a curated Essential series: trust-but-verify → false-call → someone-called.
	const quests = [
		makeQuest("custom-ttl-someone-called", mechanic),
		makeQuest("custom-ttl-false-call", mechanic),
		makeQuest("custom-ttl-trust-but-verify", mechanic),
	];
	const board = buildQuestTraderBoard({
		quests,
		statusByQuestId: new Map([
			["custom-ttl-trust-but-verify", status("completed")],
			["custom-ttl-false-call", status("active")],
			["custom-ttl-someone-called", status("locked", [{ kind: "quest", label: "False Call" }])],
		]),
		upcomingLockedQuestIds: new Set(),
		hiddenQuests: {},
		questOrderById: new Map(quests.map((quest, index) => [quest.id, index])),
	});

	assert.deepEqual(
		board[0].sections.map((section) => [section.key, section.groups.map((group) => [group.title, group.questIds])]),
		[
			[
				"essential",
				[["To the Light", ["custom-ttl-trust-but-verify", "custom-ttl-false-call", "custom-ttl-someone-called"]]],
			],
		],
	);
});
