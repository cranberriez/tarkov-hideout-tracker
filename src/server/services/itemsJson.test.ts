import assert from "node:assert/strict";
import test from "node:test";
import { getGlobalItemList } from "./itemsJson";

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
