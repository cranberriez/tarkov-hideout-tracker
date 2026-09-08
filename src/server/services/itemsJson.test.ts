import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") } });
const { getGlobalItemList } = await jiti.import<typeof import("./itemsJson")>("./itemsJson.ts");

test("getGlobalItemList retains normalized direct trader purchase offers", async (context) => {
	context.mock.method(globalThis, "fetch", async (input) => {
		const url = String(input);
		if (url.endsWith("/items_en")) {
			return Response.json({ data: { item_name: "Bottle of water (0.6L)" } });
		}
		if (url.endsWith("/traders_en")) {
			return Response.json({ data: { trader_name: "Therapist" } });
		}
		if (url.endsWith("/traders")) {
			return Response.json({
				data: {
					therapist: {
						id: "therapist",
						name: "trader_name",
						normalizedName: "therapist",
					},
				},
			});
		}
		return Response.json({
			data: {
				items: {
					water: {
						id: "water",
						name: "item_name",
						normalizedName: "bottle-of-water-06l",
						types: ["provisions"],
						buyFromTrader: [
							{
								trader: "therapist",
								price: 15_530,
								priceRUB: 15_530,
								currency: "RUB",
								currencyItem: "roubles",
								minTraderLevel: 1,
								taskUnlock: null,
								restockAmount: 3_900_000,
								buyLimit: 5,
							},
							{
								trader: null,
								price: "invalid",
							},
						],
					},
				},
			},
		});
	});

	const result = await getGlobalItemList("regular");

	assert.deepEqual(result.data.items[0]?.buyFromTrader, [
		{
			traderId: "therapist",
			price: 15_530,
			priceRUB: 15_530,
			currency: "RUB",
			currencyItemId: "roubles",
			minTraderLevel: 1,
			restockAmount: 3_900_000,
			buyLimit: 5,
		},
	]);
});

test("catalog ingestion rejects malformed required records and duplicate IDs", async (context) => {
	let sourceItems: Record<string, unknown> = {};
	context.mock.method(globalThis, "fetch", async (input) => {
		const url = String(input);
		if (url.endsWith("_en")) return Response.json({ data: { name: "Item" } });
		if (url.endsWith("/traders")) return Response.json({ data: { trader: { id: "trader", name: "name" } } });
		return Response.json({ data: { items: sourceItems } });
	});
	const good = { id: "item", name: "name", types: [] };
	sourceItems = { good, bad: { id: "bad", name: " ", types: [] } };
	await assert.rejects(getGlobalItemList("regular"), /invalid required item/);
	sourceItems = { first: good, second: good };
	await assert.rejects(getGlobalItemList("regular"), /duplicate item IDs/);
	sourceItems = {};
	await assert.rejects(getGlobalItemList("regular"), /no items/);
});
