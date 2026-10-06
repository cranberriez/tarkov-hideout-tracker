import assert from "node:assert/strict";
import test from "node:test";
import { prepareCatalog } from "./preparation.mjs";

function fixtures() {
	const result = (data) => ({ data, updatedAt: 123 });
	const item = { id: "item", name: "Item", marketPrice: { price: 100 }, buyFromTrader: [{ price: 90 }] };
	const seenModes = [];
	const details = async (id, mode, repo) => {
		assert.equal(id, "item");
		assert.deepEqual((await repo.prices.getCurrent(mode)).data, {});
		const records = (await repo.items.getByIds(mode, [id, "missing"])).data;
		assert.deepEqual(Object.keys(records), [id]);
		assert.equal(records[id].marketPrice, undefined);
		assert.equal(records[id].buyFromTrader, undefined);
		return { freshness: { items: 123 } };
	};
	return {
		item,
		seenModes,
		services: {
			itemsService: {
				getGlobalItemList: async (mode) => {
					seenModes.push(mode);
					return result({ items: [item] });
				},
				getGlobalSkillList: async () => result({ skills: [] }),
			},
			hideoutService: { getJsonHideoutStations: async () => result({ stations: [] }) },
			questsService: { getCurrentJsonFullQuestData: async () => result({ quests: [] }) },
			tradersService: { getJsonTraders: async () => result({ traders: [] }) },
			recipesService: {
				getBarterIndex: async () => result({ bartersByItemId: {} }),
				getCraftIndex: async () => result({ craftsByItemId: {} }),
			},
			relationsQuery: { getItemRelationsData: details },
			usageQuery: { getItemUsageData: details },
			acquisitionQuery: { getItemAcquisitionTreeData: details },
		},
	};
}

test("shared catalog preparation includes all modes and excludes monetary data without mutating providers", async () => {
	const { services, item, seenModes } = fixtures();
	const modes = await prepareCatalog(services);
	assert.deepEqual(seenModes, ["regular", "pve", "pvp-season"]);
	for (const data of Object.values(modes)) {
		assert.equal(data.itemDetails.length, 1);
		assert.deepEqual(data.items, [{ id: "item", name: "Item" }]);
	}
	assert.equal(item.marketPrice.price, 100);
	assert.equal(item.buyFromTrader.length, 1);
});

test("a failed mode rejects preparation instead of returning partial catalog data", async () => {
	const { services } = fixtures();
	services.itemsService.getGlobalItemList = async (mode) => {
		if (mode === "pve") throw new Error("provider unavailable");
		return { data: { items: [] }, updatedAt: 123 };
	};
	await assert.rejects(prepareCatalog(services), /provider unavailable/);
});
