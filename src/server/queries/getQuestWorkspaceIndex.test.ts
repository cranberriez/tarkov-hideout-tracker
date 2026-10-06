import assert from "node:assert/strict";
import test from "node:test";
import { getQuestWorkspaceIndex } from "./getQuestWorkspaceIndex";
import type { TarkovDataRepository } from "../repositories/tarkov-data/types";
import type { FullQuest } from "../../types/quests";

test("workspace index uses metadata source without item, price or full quest reads", async () => {
	const source: FullQuest = {
		id: "quest",
		name: "Quest",
		normalizedName: "quest",
		experience: 1,
		trader: { id: "trader", name: "Trader", normalizedName: "trader" },
		taskRequirements: [],
		traderRequirements: [],
		otherRequirements: [],
		finishItemRewards: [{ itemId: "never-read", count: 1 }],
		objectives: [
			{
				id: "obj",
				type: "visit",
				description: "Find this location",
				optional: false,
				maps: [{ id: "map", name: "Map", normalizedName: "map" }],
				locations: [],
				requiredKeyIds: [["key"]],
			},
		],
	};
	const forbidden = async (): Promise<never> => {
		throw new Error("Unexpected broad read");
	};
	for (const mode of ["regular", "pve", "pvp-season"] as const) {
		const repo: TarkovDataRepository = {
			quests: {
				getAll: forbidden,
				getByIds: forbidden,
				getIndexSource: async (requestedMode) => {
					assert.equal(requestedMode, mode);
					return { data: [source], updatedAt: 1 };
				},
			},
			items: { getByIds: forbidden },
			hideout: { getStations: forbidden },
			traders: { getAll: forbidden, getByIds: forbidden },
			recipes: { getBarters: forbidden, getCrafts: forbidden },
			prices: { getCurrent: forbidden, getHistory: forbidden },
		};
		const data = await getQuestWorkspaceIndex(mode, repo);
		assert.equal(data.error, null);
		const summary = data.quests![0];
		assert.equal("objectives" in summary, false);
		assert.equal("finishItemRewards" in summary, false);
		assert.equal("items" in data, false);
		assert.equal(summary.objectiveSearchText, "Find this location");
		assert.equal(summary.objectiveCount, 1);
		assert.deepEqual(summary.keyedObjectiveTypes, ["visit"]);
	}
});
