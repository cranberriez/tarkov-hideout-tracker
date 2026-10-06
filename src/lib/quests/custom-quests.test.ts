import assert from "node:assert/strict";
import test from "node:test";
import type { FullQuest } from "@/types/quests";
import pveTasks from "../data/tasks-pve.json";
import pvpSeasonTasks from "../data/tasks-pvp-season.json";
import regularTasks from "../data/tasks-regular.json";
import {
	applyCustomQuests,
	CUSTOM_QUEST_MANIFEST,
	validateCustomQuestManifest,
	type CustomQuestManifest,
} from "./custom-quests";

const mechanic = { id: "5a7c2eca46aef81a7ca2145d", name: "Mechanic", normalizedName: "mechanic" };

function quest(id: string, name: string, overrides: Partial<FullQuest> = {}): FullQuest {
	return {
		id,
		name,
		normalizedName: name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, ""),
		experience: 0,
		trader: mechanic,
		taskRequirements: [],
		traderRequirements: [],
		otherRequirements: [],
		objectives: [],
		...overrides,
	};
}

test("shipped custom quests reference only known quests, traders and maps", () => {
	const known = new Set<string>();
	for (const tasks of [pveTasks, pvpSeasonTasks, regularTasks]) {
		for (const id of Object.keys(tasks.data.tasks)) known.add(id);
	}
	assert.deepEqual(validateCustomQuestManifest(CUSTOM_QUEST_MANIFEST, known), []);
});

test("adds new custom quests with resolved prerequisites and a source marker", () => {
	const manifest: CustomQuestManifest = {
		version: 1,
		quests: [
			{ id: "custom-a", name: "Alpha", trader: "mechanic", source: "wiki", anchor: "p1" },
			{ id: "custom-b", name: "Beta", trader: "mechanic", source: "wiki", anchor: "p1", requires: ["custom-a"] },
		],
	};
	const result = applyCustomQuests([quest("p1", "Provider")], "regular", manifest);
	const beta = result.find((entry) => entry.id === "custom-b");
	assert.equal(result.length, 3);
	assert.deepEqual(beta?.taskRequirements, [{ task: { id: "custom-a", name: "Alpha" }, status: ["complete"] }]);
	assert.equal(beta?.customSource, "wiki");
});

test("patches only the fields a custom entry defines on a provider quest", () => {
	const manifest: CustomQuestManifest = {
		version: 1,
		quests: [{ id: "p1", name: "Renamed", source: "wiki", experience: 5 }],
	};
	const [patched] = applyCustomQuests([quest("p1", "Provider", { minPlayerLevel: 12 })], "regular", manifest);
	assert.equal(patched.name, "Renamed");
	assert.equal(patched.minPlayerLevel, 12);
	assert.equal(patched.experience, 5);
});

test("does not add anchored quests when the anchor is absent", () => {
	const manifest: CustomQuestManifest = {
		version: 1,
		quests: [{ id: "custom-a", name: "Alpha", trader: "mechanic", source: "wiki", anchor: "p1" }],
	};
	const provider = [quest("other", "Other")];
	assert.deepEqual(applyCustomQuests(provider, "regular", manifest), provider);
});

test("provider wins once it ships a quest with the same name", () => {
	const manifest: CustomQuestManifest = {
		version: 1,
		quests: [{ id: "custom-a", name: "Alpha", trader: "mechanic", source: "wiki", anchor: "p1" }],
	};
	const provider = [quest("p1", "Provider"), quest("real-a", "Alpha")];
	assert.deepEqual(applyCustomQuests(provider, "regular", manifest), provider);
});

test("skips entries with an unresolved prerequisite and respects mode scope", () => {
	const warn = console.warn;
	console.warn = () => {};
	try {
		const manifest: CustomQuestManifest = {
			version: 1,
			quests: [
				{ id: "custom-a", name: "Alpha", trader: "mechanic", source: "wiki", anchor: "p1", requires: ["missing"] },
				{ id: "custom-b", name: "Beta", trader: "mechanic", source: "wiki", anchor: "p1", modes: ["pve"] },
			],
		};
		const provider = [quest("p1", "Provider")];
		assert.equal(applyCustomQuests(provider, "regular", manifest).length, 1);
		assert.equal(applyCustomQuests(provider, "pve", manifest).length, 2);
	} finally {
		console.warn = warn;
	}
});
