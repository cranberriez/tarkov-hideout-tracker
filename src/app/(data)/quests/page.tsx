import { Suspense } from "react";
import { DataLoadError } from "@/components/core/DataLoadError";
import { QuestsClientPage } from "@/features/quests/QuestsClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { getQuestWorkspacePageData } from "@/server/queries/getQuestWorkspacePageData";
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
    const data = await getQuestWorkspacePageData(gameMode, undefined, {
        showRemovedQuests: SHOW_REMOVED_QUESTS,
        displayQuestAdditions: showDevQuest ? DEV_QUEST_FIXTURES : [],
    });

    if (!data.quests) {
        return (
            <main className="container mx-auto px-6 py-8">
                <DataLoadError
                    title="Quest workspace data is unavailable"
                    messages={[data.errors.quests ?? "Quest workspace data could not be loaded."]}
                />
            </main>
        );
    }

    return (
        <Suspense fallback={null}>
            <QuestsClientPage
                quests={data.quests}
                items={data.items}
                initialQuestId={showDevQuest ? DEV_QUEST_ID : null}
            />
        </Suspense>
    );
}
