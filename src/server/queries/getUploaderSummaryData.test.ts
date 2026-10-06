import assert from "node:assert/strict";
import test from "node:test";
import type { TarkovDataRepository } from "../repositories/tarkov-data/types";
import { getUploaderSummaryData } from "./getUploaderSummaryData";

test("summary requirements stay mode-scoped and never request items or prices", async () => {
	const calls: string[] = [];
	const repository = {
		hideout: {
			getStations: async (mode: string) => {
				calls.push(`hideout:${mode}`);
				return { data: [] };
			},
		},
		quests: {
			getAll: async (mode: string) => {
				calls.push(`quests:${mode}`);
				return { data: [] };
			},
		},
	} as unknown as TarkovDataRepository;
	for (const mode of ["regular", "pve", "kord"] as const) {
		await getUploaderSummaryData(mode, repository);
	}
	assert.deepEqual(calls, [
		"hideout:regular",
		"quests:regular",
		"hideout:pve",
		"quests:pve",
		"hideout:kord",
		"quests:kord",
	]);
});

test("a missing requirement source fails instead of publishing empty demand", async () => {
	for (const failing of ["hideout", "quests"]) {
		const read = async (name: string) => {
			if (name === failing) throw new Error("unavailable");
			return { data: [] };
		};
		const repository = {
			hideout: { getStations: () => read("hideout") },
			quests: { getAll: () => read("quests") },
		} as unknown as TarkovDataRepository;
		await assert.rejects(getUploaderSummaryData("regular", repository), /unavailable/);
	}
});
