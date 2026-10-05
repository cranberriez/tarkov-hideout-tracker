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

const shape = (rows: ReturnType<typeof buildUploaderSummary>["rows"]) =>
	rows.map((row) => [row.item.id, row.category, row.foundInRaid, row.quantity]);

test("keeps FIR for future quests, spends non-FIR on replaceable demand, and leaves the rest as surplus", () => {
	const result = buildUploaderSummary(
		[
			{ itemId: item.id, quantity: 4, foundInRaid: "yes" },
			{ itemId: item.id, quantity: 4, foundInRaid: "no" },
		],
		[item],
		data,
		profile,
	);
	assert.deepEqual(shape(result.rows), [
		["bolt", "keep", "yes", 2],
		["bolt", "keep", "no", 3],
		["bolt", "surplus", "yes", 2],
		["bolt", "surplus", "no", 1],
	]);
	assert.equal(result.needs.get(item.id)?.reasons.length, 2);
});

test("saved inventory covers demand before scanned copies, with spare FIR covering non-FIR needs", () => {
	const result = buildUploaderSummary([{ itemId: item.id, quantity: 4, foundInRaid: "no" }], [item], data, profile, {
		bolt: { have: 1, haveFir: 3 },
	});
	assert.deepEqual(shape(result.rows), [
		["bolt", "keep", "no", 1],
		["bolt", "surplus", "no", 3],
	]);
	assert.deepEqual(
		{ ...result.needs.get(item.id), reasons: undefined },
		{ reasons: undefined, required: 5, owned: 4, remaining: 1 },
	);
});

test("completed station requirements and handed-in objectives no longer reserve copies", () => {
	const result = buildUploaderSummary([{ itemId: item.id, quantity: 3, foundInRaid: "yes" }], [item], data, {
		...profile,
		completedRequirements: { req: true },
		completedQuestObjectives: { quest: { objective: true } },
	});
	assert.equal(result.rows[0].category, "surplus");
	assert.deepEqual(result.needs.get(item.id)?.reasons, []);
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
		assert.deepEqual(result.needs.get(item.id)?.reasons, []);
	}
	const result = buildUploaderSummary(
		[{ itemId: item.id, quantity: 1, foundInRaid: "yes" }],
		[item],
		{ stations: [], quests: [{ ...quest, factionName: "BEAR" }] },
		profile,
	);
	assert.equal(result.rows[0].category, "surplus");
});

test("unconfirmed FIR is kept for FIR demand; confirmed non-FIR cannot satisfy it", () => {
	const result = buildUploaderSummary(
		[
			{ itemId: item.id, quantity: 1, foundInRaid: "unknown" },
			{ itemId: item.id, quantity: 1, foundInRaid: "no" },
		],
		[item],
		{ ...data, stations: [] },
		profile,
	);
	const unknown = result.rows.find((row) => row.foundInRaid === "unknown");
	assert.equal(unknown?.category, "keep");
	assert.equal(unknown?.firUnconfirmed, true);
	assert.equal(result.rows.find((row) => row.foundInRaid === "no")?.category, "surplus");
	assert.equal(result.needs.get(item.id)?.reasons[0].firCount, 2);
});

test("any-of hand-ins keep the cheapest accepted copies, including items beyond the display preview", () => {
	const filler = Array.from({ length: 20 }, (_, index) => `filler-${index}`);
	const nut = { ...item, id: "nut", name: "Nut" };
	const result = buildUploaderSummary(
		[item, nut].map((entry) => ({ itemId: entry.id, quantity: 2, foundInRaid: "yes" as const })),
		[item, nut],
		{
			stations: [],
			quests: [{ ...quest, objectives: [{ ...quest.objectives[0], itemIds: [...filler, item.id, nut.id] }] }],
		},
		profile,
		{},
		(id) => (id === nut.id ? 50 : 100),
	);
	assert.deepEqual(shape(result.rows), [
		["nut", "keep", "yes", 2],
		["bolt", "surplus", "yes", 2],
	]);
	assert.deepEqual(
		result.needs.get(nut.id)?.reasons.map(({ options, filled }) => [options, filled]),
		[[22, 2]],
	);
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
	assert.deepEqual(shape(result.rows), [
		["bolt", "keep", "no", 3],
		["bolt", "surplus", "no", 3],
	]);
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
