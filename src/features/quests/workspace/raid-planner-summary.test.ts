import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types/quests";
import { toQuestSummary } from "../../../lib/quests/quest-summary";
import { getQuestWorkspaceItemIds } from "../../../lib/quests/quest-item-ids";
import { buildRaidPlannerMapGroups, isQuestOnRaidPlannerMap } from "./raid-planner-maps";
import {
	buildRaidPlannerKillList,
	buildRaidPlannerMapSummary,
	buildRaidPlannerObjectiveKeyIndex,
	getActiveRaidPlannerQuests,
	getRaidPlannerMarkerKeys,
} from "./raid-planner-summary";
import type { QuestWorkspaceStatusInfo } from "./quest-workspace-utils";

const customs = { id: "customs", name: "Customs", normalizedName: "customs" };

test("planner combines Lab variants without double-counting quests or dropping dark-only keys", () => {
	const lab = { id: "lab", name: "The Lab", normalizedName: "the-lab" };
	const dark = { id: "dark", name: "The Lab (Dark)", normalizedName: "the-lab-dark" };
	const both = {
		...quest("both", "visit"),
		map: lab,
		objectives: [{ ...quest("both", "visit").objectives[0], maps: [lab, dark] }],
	};
	const darkOnly = { ...quest("dark-only", "visit", [["dark-key"]]), map: dark };
	assert.deepEqual(
		buildRaidPlannerMapGroups(
			[dark, lab].map((map) => ({ key: map.normalizedName, name: map.name, aliases: [map.normalizedName] })),
		),
		[{ key: "the-lab", name: "The Lab", aliases: ["the-lab-dark", "the-lab"] }],
	);
	assert.equal(isQuestOnRaidPlannerMap(darkOnly, "the-lab"), true);
	const summary = buildRaidPlannerMapSummary([both, darkOnly], "the-lab");
	assert.equal(summary.questCount, 2);
	assert.deepEqual(summary.requiredKeyIds, ["dark-key"]);
});
const key = {
	id: "key-1",
	name: "Dorm room 206 key",
	shortName: "Dorm 206",
	normalizedName: "dorm-room-206-key",
	iconLink: "https://assets.tarkov.dev/key-1-icon.webp",
};

function quest(id: string, type: string, requiredKeyIds?: string[][]) {
	return {
		id,
		name: id,
		map: customs,
		objectives: [
			{
				id: `${id}-objective`,
				type,
				description: `${type} objective`,
				optional: false,
				requiredKeyIds,
			},
		],
	} as FullQuest;
}

test("raid planner keeps only active quests regardless of other workspace statuses", () => {
	const quests = [quest("active", "visit"), quest("locked", "shoot"), quest("done", "extract")];
	const statuses = new Map<string, QuestWorkspaceStatusInfo>([
		["active", { status: "active", label: "Active", reasons: [], terminal: null }],
		["locked", { status: "locked", label: "Locked", reasons: [], terminal: null }],
		["done", { status: "completed", label: "Completed", reasons: [], terminal: "completed" }],
	]);

	assert.deepEqual(
		getActiveRaidPlannerQuests(quests, statuses).map((entry) => entry.id),
		["active"],
	);
});

test("map summary groups unique quests by objective type and deduplicates required keys", () => {
	const summary = buildRaidPlannerMapSummary(
		[quest("visit", "visit", [[key.id]]), quest("plant", "plantItem", [[key.id]])],
		"customs",
	);

	assert.equal(summary.questCount, 2);
	assert.deepEqual(summary.objectiveGroups, [
		{ category: "location", questCount: 1, keyedQuestCount: 1 },
		{ category: "plant", questCount: 1, keyedQuestCount: 1 },
	]);
	assert.deepEqual(summary.requiredKeyIds, ["key-1"]);
});

test("lazy planner summaries defer keys until selected-map details supply IDs and item reads", () => {
	const quests = [quest("visit", "visit", [[key.id]]), quest("plant", "plantItem", [[key.id], ["missing-key"]])];
	const cards = buildRaidPlannerMapSummary(quests.map(toQuestSummary), "customs");
	assert.equal(cards.keysDeferred, true);
	assert.deepEqual(cards.requiredKeyIds, []);
	assert.equal(cards.objectiveGroups[0].keyedQuestCount, 1);

	const selectedMap = buildRaidPlannerMapSummary(quests, "customs");
	assert.equal(selectedMap.keysDeferred, false);
	assert.deepEqual(selectedMap.requiredKeyIds, [key.id, "missing-key"]);
	assert.deepEqual(getQuestWorkspaceItemIds(quests).sort(), selectedMap.requiredKeyIds);
	assert.deepEqual(buildRaidPlannerMapSummary(quests, "woods").requiredKeyIds, []);
});

test("kill list includes every shooting objective with a compact description", () => {
	const killQuest = {
		...quest("kill", "shoot"),
		objectives: [
			{
				id: "kill-one",
				type: "shoot",
				description: "Eliminate 15 Scavs on the map Customs while using an AKS-74U",
				optional: false,
				count: 15,
				target: "Scav",
				targetNames: ["Scavs"],
				bodyParts: [],
			},
			{
				id: "kill-two",
				type: "shoot",
				description: "Kill 3 PMCs with headshots",
				optional: true,
				count: 3,
				target: "PMC",
				bodyParts: ["Head"],
			},
		],
	} as FullQuest;

	const entries = buildRaidPlannerKillList([killQuest]);
	assert.equal(entries.length, 2);
	assert.equal(entries[0].summary, "15 Scavs · Customs · an AKS-74U");
	assert.equal(entries[1].summary, "3 PMCs · headshots");
	assert.equal(entries[1].optional, true);
});

test("marker key previews deduplicate keys across coincident objectives", () => {
	const keyedQuest = {
		...quest("keyed", "visit", [[key.id]]),
		objectives: [
			{
				id: "first",
				type: "visit",
				description: "First door",
				optional: false,
				requiredKeyIds: [[key.id]],
			},
			{
				id: "second",
				type: "locate",
				description: "Second door",
				optional: false,
				requiredKeyIds: [[key.id]],
			},
		],
	} as FullQuest;

	const index = buildRaidPlannerObjectiveKeyIndex([keyedQuest]);
	const keys = getRaidPlannerMarkerKeys(["first", "second"], index);
	assert.deepEqual(keys, ["key-1"]);
});
