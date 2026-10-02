import assert from "node:assert/strict";
import test from "node:test";
import {
	compareChecklistEntries,
	DEFAULT_CHECKLIST_SORT,
	itemChecklistSortValues,
	selectChecklistSort,
	type ChecklistSortValues,
} from "./checklist-sort";

const row = (name: string, unitValue: number | null, quantity = 1, fir = 0): ChecklistSortValues => ({
	id: name,
	name,
	unitValue,
	totalValue: unitValue === null ? null : unitValue * quantity,
	quantity,
	fir,
});
const names = (rows: ChecklistSortValues[], sort = DEFAULT_CHECKLIST_SORT) =>
	[...rows].sort((a, b) => compareChecklistEntries(a, b, sort)).map((r) => r.name);

test("new selections use defaults; active selections reverse", () => {
	assert.deepEqual(selectChecklistSort(DEFAULT_CHECKLIST_SORT, "unitValue"), { key: "unitValue", direction: "asc" });
	assert.deepEqual(selectChecklistSort(DEFAULT_CHECKLIST_SORT, "alphabetic"), { key: "alphabetic", direction: "asc" });
	for (const key of ["quantity", "totalValue"] as const) {
		assert.deepEqual(selectChecklistSort({ key: "alphabetic", direction: "asc" }, key), { key, direction: "desc" });
	}
});

test("unit and total value differ; unknown values stay last and ties use A–Z", () => {
	const rows = [row("Zebra", 20), row("Alpha", 20), row("Bulk", 5, 10), row("Unknown", null), row("Group", null)];
	assert.deepEqual(names(rows), ["Alpha", "Zebra", "Bulk", "Group", "Unknown"]);
	assert.deepEqual(names(rows, { key: "unitValue", direction: "asc" }), ["Bulk", "Alpha", "Zebra", "Group", "Unknown"]);
	assert.deepEqual(names(rows, { key: "totalValue", direction: "desc" }), [
		"Bulk",
		"Alpha",
		"Zebra",
		"Group",
		"Unknown",
	]);
});

test("quantity ties use remaining FIR in the selected direction, then A–Z", () => {
	const rows = [row("Zebra", 1, 4, 2), row("Alpha", 1, 4, 2), row("Low FIR", 1, 4, 1), row("Many", 1, 5)];
	assert.deepEqual(names(rows, { key: "quantity", direction: "desc" }), ["Many", "Alpha", "Zebra", "Low FIR"]);
	assert.deepEqual(names(rows, { key: "quantity", direction: "asc" }), ["Low FIR", "Alpha", "Zebra", "Many"]);
	assert.deepEqual(names(rows, { key: "alphabetic", direction: "desc" }), ["Zebra", "Many", "Low FIR", "Alpha"]);
});

test("remaining needs reserve FIR, reuse surplus, and ignore currency inventory", () => {
	const item = { id: "a", name: "Alpha", normalizedName: "alpha", marketPrice: { price: 100 } } as Parameters<
		typeof itemChecklistSortValues
	>[0];
	assert.deepEqual(itemChecklistSortValues(item, 10, 4, { have: 5, haveFir: 2 }), {
		id: "a",
		name: "Alpha",
		unitValue: 100,
		totalValue: 300,
		quantity: 3,
		fir: 2,
	});
	assert.equal(itemChecklistSortValues(item, 10, 4, { have: 5, haveFir: 5 }).quantity, 0);
	assert.equal(
		itemChecklistSortValues({ ...item, normalizedName: "roubles" }, 10, 0, { have: 10, haveFir: 0 }).quantity,
		10,
	);
	assert.equal(itemChecklistSortValues({ ...item, marketPrice: undefined }, 10, 0).totalValue, null);
});

test("Default restores group order and legacy quest priorities, and can reverse", () => {
	const quest = (
		id: string,
		overrides: Partial<NonNullable<ChecklistSortValues["questState"]>> = {},
	): ChecklistSortValues => ({
		...row(id, 100),
		questState: {
			itemId: id,
			hasPinnedQuest: false,
			hasAvailableQuest: false,
			activeQuestDepth: 5,
			relatedQuestCount: 1,
			...overrides,
		} as NonNullable<ChecklistSortValues["questState"]>,
	});
	const rows = [
		row("Zebra", 999),
		row("Alpha", 999),
		quest("Pinned", { hasPinnedQuest: true }),
		quest("Available", { hasAvailableQuest: true }),
		quest("Earlier", { activeQuestDepth: 1 }),
		quest("Many quests", { relatedQuestCount: 3 }),
		quest("ID B"),
		quest("ID A"),
		{ ...row("Group Z", null), groupOrder: 0 },
		{ ...row("Group A", null), groupOrder: 1 },
	];
	const expected = [
		"Group Z",
		"Group A",
		"Pinned",
		"Available",
		"Earlier",
		"Many quests",
		"ID A",
		"ID B",
		"Alpha",
		"Zebra",
	];
	const selected = selectChecklistSort(DEFAULT_CHECKLIST_SORT, "default");
	assert.deepEqual(selected, { key: "default", direction: "asc" });
	assert.deepEqual(names(rows, selected), expected);
	assert.deepEqual(names(rows, selectChecklistSort(selected, "default")), [...expected].reverse());
	const idFirst = quest("a");
	idFirst.name = "Z name";
	const idLast = quest("b");
	idLast.name = "A name";
	assert.deepEqual(names([idLast, idFirst], selected), ["Z name", "A name"]);
});

test("value uses the higher flea or trader buyback in roubles and multiplies remaining demand", () => {
	const item = {
		id: "value",
		name: "Value",
		normalizedName: "value",
		marketPrice: {
			price: 100,
			sellFor: [
				{ vendor: { name: "Trader A", normalizedName: "trader-a" }, currency: "USD", price: 2, priceRUB: 250 },
				{ vendor: { name: "Trader B", normalizedName: "trader-b" }, priceRUB: 200 },
			],
		},
	};
	const result = itemChecklistSortValues(item, 5, 2, { have: 1, haveFir: 1 });
	assert.equal(result.unitValue, 250);
	assert.equal(result.totalValue, 750);
	assert.equal(
		itemChecklistSortValues({ ...item, marketPrice: { ...item.marketPrice, price: 500 } }, 1, 0).unitValue,
		500,
	);
	assert.equal(itemChecklistSortValues({ ...item, onFleaMarket: false }, 1, 0).unitValue, 250);
	assert.equal(
		itemChecklistSortValues({ ...item, marketPrice: { ...item.marketPrice, fleaStability: "unavailable" } }, 1, 0)
			.unitValue,
		250,
	);
	assert.equal(
		itemChecklistSortValues({ ...item, marketPrice: { sellFor: item.marketPrice.sellFor } }, 1, 0).unitValue,
		250,
	);
	assert.equal(itemChecklistSortValues({ ...item, marketPrice: { price: 100 } }, 1, 0).unitValue, 100);
	for (const priceRUB of [NaN, Infinity, -1]) {
		const sellFor = [{ ...item.marketPrice.sellFor[0], priceRUB }];
		assert.equal(itemChecklistSortValues({ ...item, marketPrice: { sellFor } }, 1, 0).unitValue, null);
	}
	assert.equal(
		itemChecklistSortValues({ ...item, marketPrice: undefined, priceLoadState: "pending" }, 1, 0).unitValue,
		null,
	);
	assert.equal(
		itemChecklistSortValues(
			{ ...item, marketPrice: { sellFor: [{ ...item.marketPrice.sellFor[0], priceRUB: 300 }] } },
			1,
			0,
		).unitValue,
		300,
	);
});
