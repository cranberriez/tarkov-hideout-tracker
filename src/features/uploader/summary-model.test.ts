import assert from "node:assert/strict";
import test from "node:test";
import { buildUploaderSummary } from "./summary-model";
import type { UploaderSummaryData, UploaderQuest } from "../../types/uploader";

const item = { id: "bolt", name: "Bolt", normalizedName: "bolt" };
const profile = {
	stationLevels: {},
	completedRequirements: {},
	completedQuests: {},
	completedQuestObjectives: {},
	failedQuests: {},
	ignoredQuests: {},
	playerLevel: 1,
	prestigeLevel: 0,
	questFaction: "USEC" as const,
	questTraderLoyaltyLevels: {},
	questFenceReputation: 0,
};
const quest: UploaderQuest = {
	id: "quest",
	name: "Future quest",
	normalizedName: "future-quest",
	minPlayerLevel: 50,
	trader: { id: "trader", name: "Trader", normalizedName: "trader" },
	taskRequirements: [],
	traderRequirements: [],
	otherRequirements: [],
	objectives: [
		{
			id: "objective",
			type: "giveItem",
			description: "Hand in bolts",
			optional: false,
			count: 2,
			foundInRaid: true,
			itemIds: [item.id],
		},
	],
};
const data: UploaderSummaryData = {
	quests: [quest],
	stations: [
		{
			id: "station",
			name: "Workbench",
			normalizedName: "workbench",
			levels: [
				{
					id: "level",
					level: 2,
					constructionTime: 0,
					stationLevelRequirements: [],
					skillRequirements: [],
					traderRequirements: [],
					itemRequirements: [{ id: "req", itemId: item.id, count: 3, isFir: false, isTool: false }],
				},
			],
		},
	],
};

test("reserves FIR for future quests, allocates non-FIR first, and splits surplus without double counting", () => {
	const result = buildUploaderSummary(
		[
			{ itemId: item.id, quantity: 4, foundInRaid: "yes" },
			{ itemId: item.id, quantity: 4, foundInRaid: "no" },
		],
		[item],
		data,
		profile,
	);
	assert.deepEqual(
		result.rows.map((row) => [row.category, row.foundInRaid, row.quantity]),
		[
			["save", "yes", 2],
			["needed", "no", 3],
			["pricing", "no", 1],
			["pricing", "yes", 2],
		],
	);
	assert.equal(result.rows[0].reasons.length, 2);
});

test("completed station requirements and handed-in objectives no longer reserve copies", () => {
	const result = buildUploaderSummary([{ itemId: item.id, quantity: 3, foundInRaid: "yes" }], [item], data, {
		...profile,
		completedRequirements: { req: true },
		completedQuestObjectives: { quest: { objective: true } },
	});
	assert.equal(result.rows[0].category, "pricing");
	assert.deepEqual(result.rows[0].reasons, []);
});

test("built stations and completed, failed, ignored, or opposite faction quests are excluded", () => {
	for (const override of [
		{ completedQuests: { quest: true } },
		{ failedQuests: { quest: true } },
		{ ignoredQuests: { quest: true } },
	]) {
		const result = buildUploaderSummary([{ itemId: item.id, quantity: 3, foundInRaid: "yes" }], [item], data, {
			...profile,
			stationLevels: { station: 2 },
			...override,
		});
		assert.deepEqual(result.rows[0].reasons, []);
	}
	const result = buildUploaderSummary(
		[{ itemId: item.id, quantity: 1, foundInRaid: "yes" }],
		[item],
		{
			stations: [],
			quests: [{ ...quest, factionName: "BEAR" }],
		},
		profile,
	);
	assert.equal(result.rows[0].category, "pricing");
});

test("unknown FIR cannot satisfy FIR needs and non-FIR still shows its ineligible reasons", () => {
	const result = buildUploaderSummary(
		[
			{ itemId: item.id, quantity: 1, foundInRaid: "unknown" },
			{ itemId: item.id, quantity: 1, foundInRaid: "no" },
		],
		[item],
		{ ...data, stations: [] },
		profile,
	);
	assert.equal(result.rows.find((row) => row.foundInRaid === "unknown")?.category, "review");
	assert.equal(result.rows.find((row) => row.foundInRaid === "no")?.category, "pricing");
	assert.equal(result.rows[0].reasons[0].firCount, 2);
});

test("quest alternatives require a choice rather than reserving each candidate", () => {
	const alternative = { ...item, id: "nut", name: "Nut" };
	const result = buildUploaderSummary(
		[item, alternative].map((entry) => ({ itemId: entry.id, quantity: 2, foundInRaid: "yes" as const })),
		[item, alternative],
		{
			stations: [],
			quests: [{ ...quest, objectives: [{ ...quest.objectives[0], itemIds: [item.id, alternative.id] }] }],
		},
		profile,
	);
	assert.ok(result.rows.every((row) => row.category === "review" && row.reasons[0].choice));
});

test("reusable tools reserve the maximum future requirement instead of summing every upgrade", () => {
	const station = data.stations[0];
	const level = station.levels[0];
	const result = buildUploaderSummary(
		[{ itemId: item.id, quantity: 6, foundInRaid: "no" }],
		[item],
		{
			quests: [],
			stations: [
				{
					...station,
					levels: [2, 3].map((value) => ({
						...level,
						level: value,
						itemRequirements: [{ ...level.itemRequirements[0], id: `r${value}`, count: value, isTool: true }],
					})),
				},
			],
		},
		profile,
	);
	assert.deepEqual(
		result.rows.map((row) => [row.category, row.quantity]),
		[
			["needed", 3],
			["pricing", 3],
		],
	);
});

test("missing catalog records and invalid quantities are explicit unresolved entries", () => {
	const result = buildUploaderSummary(
		[
			{ itemId: "missing", quantity: 1, foundInRaid: "yes" },
			{ itemId: item.id, quantity: -1, foundInRaid: "no" },
		],
		[item],
		data,
		profile,
	);
	assert.equal(result.unresolved, 2);
	assert.deepEqual(result.rows, []);
});
