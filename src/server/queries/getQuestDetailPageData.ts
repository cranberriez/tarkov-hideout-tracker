import { prepareQuestDataForMode } from "../../lib/quests/quest-preparation";
import { prepareQuestsForDisplay } from "../../lib/quests/removed-quests";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { FullQuest } from "@/types/quests";
import { getDefaultRepository } from "./query-utils";

/** Public identity used for route resolution and metadata. Progress stays client-side. */
export interface QuestDetailSummary {
    id: string;
    name: string;
    traderName: string;
    mapName: string | null;
    minPlayerLevel: number | null;
    objectiveDescriptions: string[];
    kappaRequired: boolean;
}

export interface QuestDetailPageData {
    /** `null` with `error: null` means the quest does not exist in this mode's prepared set. */
    quest: QuestDetailSummary | null;
    error: string | null;
}

function summarize(quest: FullQuest): QuestDetailSummary {
    return {
        id: quest.id,
        name: quest.name,
        traderName: quest.trader.name,
        mapName: quest.map?.name ?? null,
        minPlayerLevel: quest.minPlayerLevel ?? null,
        objectiveDescriptions: quest.objectives.map((objective) => objective.description).filter(Boolean),
        kappaRequired: !!quest.kappaRequired,
    };
}

/**
 * Bounded one-quest read for direct loads. The persistent workspace keeps using the
 * mode-keyed workspace query for full detail relationships.
 */
export async function getQuestDetailPageData(
    mode: TarkovDataMode,
    questId: string,
    repository?: TarkovDataRepository,
    options: { showRemovedQuests?: boolean } = {},
): Promise<QuestDetailPageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    try {
        const { data } = await dataRepository.quests.getByIds(mode, [questId]);
        const record = data[questId];
        if (!record) return { quest: null, error: null };
        const [prepared] = prepareQuestsForDisplay(
            prepareQuestDataForMode([record], mode),
            options.showRemovedQuests ?? false,
        );
        return { quest: prepared ? summarize(prepared) : null, error: null };
    } catch {
        return { quest: null, error: "Quest data could not be loaded." };
    }
}
