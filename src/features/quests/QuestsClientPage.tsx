"use client";

import { useMemo, useState } from "react";
import type { FullQuest, ItemDetails } from "@/types";
import { QuestsProvider, useQuestsContext } from "./QuestsContext";
import { QuestsSidebar } from "./components/QuestsSidebar";
import { QuestsCharacterBar } from "./components/QuestsCharacterBar";
import { QuestsFilterBar } from "./components/QuestsFilterBar";
import { QuestsList } from "./components/QuestsList";
import { QuestsSyncBar } from "./components/QuestsSyncBar";
import { QuestsTree } from "./components/QuestsTree";
import { SlidersIcon } from "./components/quest-ui";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { useDataContext } from "@/app/(data)/_dataContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

function QuestsContent() {
    const { viewMode } = useQuestsContext();
    if (viewMode === "tree") return <QuestsTree />;
    return <QuestsList />;
}

interface QuestsClientPageProps {
    quests: FullQuest[];
    updatedAt: number;
    questItemIndex: QuestItemIndexEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

export function QuestsClientPage({
    quests,
    updatedAt,
    questItemIndex,
    questAvailabilityQuests,
}: QuestsClientPageProps) {
    void updatedAt;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    const { stations } = useDataContext();
    const { stationLevels, hiddenStations, completedRequirements } = useUserStore();

    // Build a lookup of ItemDetails from quest objectives so item modal can open any quest item
    const questItemDetails = useMemo(() => {
        const details: Record<string, ItemDetails> = {};
        for (const quest of quests) {
            for (const objective of quest.objectives) {
                if ("items" in objective && Array.isArray(objective.items)) {
                    for (const item of objective.items) {
                        if (!details[item.id]) {
                            details[item.id] = {
                                id: item.id,
                                name: item.name,
                                normalizedName: item.normalizedName,
                                iconLink: item.iconLink ?? undefined,
                                gridImageLink: item.gridImageLink ?? undefined,
                            };
                        }
                    }
                }
            }
        }
        return details;
    }, [quests]);

    const selectedItem = selectedItemId ? (questItemDetails[selectedItemId] ?? null) : null;

    return (
        <QuestsProvider quests={quests} onItemClick={setSelectedItemId}>
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="absolute left-0 top-0 bottom-0 w-64 bg-[#0d0d0d] border-r border-white/10 flex flex-col gap-6 overflow-y-auto py-6 px-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <QuestsSidebar />
                    </div>
                </div>
            )}

            {/* Floating sidebar toggle for small screens */}
            <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="fixed bottom-6 right-6 z-50 lg:hidden w-12 h-12 rounded-full bg-[#111] border border-tarkov-green/40 text-tarkov-green flex items-center justify-center shadow-[0_0_20px_rgba(157,255,0,0.2)] hover:shadow-[0_0_28px_rgba(157,255,0,0.35)] hover:border-tarkov-green/70 transition-all"
                title="Filters"
            >
                <SlidersIcon />
            </button>

            <div className="container mx-auto flex gap-0 py-6 sm:py-8">
                {/* Left sidebar */}
                <aside className="hidden lg:flex flex-col gap-6 w-56 shrink-0 sticky top-4 self-start max-h-[calc(100vh-3rem)] overflow-y-auto pb-8 pl-6 pr-5">
                    <QuestsSidebar />
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0 px-4 sm:px-6">
                    <div className="mb-8 flex flex-col gap-1 border-b border-border-color pb-6">
                        <h1 className="text-3xl font-bold text-white tracking-tight">QUESTS</h1>
                        <p className="text-gray-400 mt-1 text-sm">
                            Track quest completion and filter by trader, map, faction, and progression
                            goal
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 pb-8">
                        <QuestsCharacterBar />
                        <QuestsSyncBar />
                        <QuestsFilterBar />
                        <QuestsContent />
                    </div>
                </div>
            </div>

            <ItemDetailModal
                item={selectedItem}
                isOpen={!!selectedItem}
                onClose={() => setSelectedItemId(null)}
                stations={stations ?? []}
                stationLevels={stationLevels}
                hiddenStations={hiddenStations}
                completedRequirements={completedRequirements}
                questItemIndex={questItemIndex}
                questAvailabilityQuests={questAvailabilityQuests}
            />
        </QuestsProvider>
    );
}
