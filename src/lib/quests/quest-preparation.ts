import type { TarkovDataMode } from "@/types/common";
import type { FullQuest } from "@/types/quests";
import { applyQuestFactionOverrides } from "./quest-faction-overrides";
import { prepareQuestSeriesForGameMode } from "./quest-series";

/** Apply the reviewed faction and series corrections shared by quest read models. */
export function prepareQuestDataForMode(
    quests: FullQuest[],
    mode: TarkovDataMode,
): FullQuest[] {
    return prepareQuestSeriesForGameMode(applyQuestFactionOverrides(quests), mode);
}
