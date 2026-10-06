import type { TarkovDataMode } from "@/types/common";
import type { FullQuest } from "@/types/quests";
import customQuestData from "../data/custom-quests.json";
import factionOverrideData from "../data/quest-faction-overrides.json";
import questSeriesData from "../data/quest-series.json";
import removedQuestData from "../data/removed-quests.json";
import { GAME_MODE_CONFIG } from "../game-mode";
import { applyCustomQuests } from "./custom-quests";
import { applyQuestFactionOverrides } from "./quest-faction-overrides";
import { prepareQuestSeriesForGameMode } from "./quest-series";

/** Apply the reviewed custom, faction and series corrections shared by quest read models. */
export function prepareQuestDataForMode(quests: FullQuest[], mode: TarkovDataMode): FullQuest[] {
	return prepareQuestSeriesForGameMode(applyQuestFactionOverrides(applyCustomQuests(quests, mode)), mode);
}

function fnv1a(text: string) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

/**
 * Identifies the reviewed data that shapes prepared quests. Include it in any cache key
 * that stores prepared quest output so edits to that data cannot serve stale results.
 */
export const QUEST_PREPARATION_REVISION = fnv1a(
	JSON.stringify([customQuestData, factionOverrideData, questSeriesData, removedQuestData, GAME_MODE_CONFIG]),
);
