import { Suspense } from "react";
import { orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedFullQuestData } from "@/server/services/tarkovData";
import { buildQuestAnyOfGroups, buildQuestItemIndex, buildQuestRewardIndex } from "@/lib/utils/quest-item-index";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { QuestsClientPage } from "@/features/quests/QuestsClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import {
    excludeRemovedQuests,
    prepareQuestsForDisplay,
} from "@/lib/utils/removed-quests";
import { applyQuestFactionOverrides } from "@/lib/utils/quest-faction-overrides";
import { prepareQuestSeriesForGameMode } from "@/lib/utils/quest-series";
import {
    DEV_QUEST_FIXTURES,
    DEV_QUEST_ID,
    DEV_QUEST_QUERY,
} from "@/features/quests/dev-quest-fixture";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

interface QuestsPageProps {
    searchParams: Promise<{ q?: string | string[] }>;
}

export default async function QuestsPage({ searchParams }: QuestsPageProps) {
    const queryValue = (await searchParams).q;
    const query = Array.isArray(queryValue) ? queryValue[0] : queryValue;
    const showDevQuest = process.env.NODE_ENV === "development" && query === DEV_QUEST_QUERY;
    const gameMode = await getActiveTarkovJsonGameMode();
    const questsResponse = await getCachedFullQuestData(gameMode);
    const normalizedQuests = prepareQuestSeriesForGameMode(
        applyQuestFactionOverrides(questsResponse.data.quests),
        gameMode,
    );
    const displayQuests = prepareQuestsForDisplay(normalizedQuests, SHOW_REMOVED_QUESTS);
    const quests = orderQuestsByPrerequisites(
        showDevQuest ? [...displayQuests, ...DEV_QUEST_FIXTURES] : displayQuests,
    );
    const progressionQuests = orderQuestsByPrerequisites(
        excludeRemovedQuests(normalizedQuests),
    );
    const questItemIndex = buildQuestItemIndex(progressionQuests);
    const questRewardIndex = buildQuestRewardIndex(progressionQuests);
    const questAnyOfGroups = buildQuestAnyOfGroups(progressionQuests);
    const questAvailabilityQuests = progressionQuests.map(toQuestAvailabilityQuest);

    return (
        <Suspense fallback={null}>
            <QuestsClientPage
                quests={quests}
                updatedAt={questsResponse.updatedAt}
                questItemIndex={questItemIndex}
                questRewardIndex={questRewardIndex}
                questAnyOfGroups={questAnyOfGroups}
                questAvailabilityQuests={questAvailabilityQuests}
                initialQuestId={showDevQuest ? DEV_QUEST_ID : null}
            />
        </Suspense>
    );
}
