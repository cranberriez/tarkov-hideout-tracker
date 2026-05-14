"use client";

import { useState } from "react";
import type { FullQuest } from "@/types";
import { QuestsProvider, useQuestsContext } from "./QuestsContext";
import { QuestsSidebar } from "./components/QuestsSidebar";
import { QuestsCharacterBar } from "./components/QuestsCharacterBar";
import { QuestsFilterBar } from "./components/QuestsFilterBar";
import { QuestsList } from "./components/QuestsList";
import { QuestsSyncBar } from "./components/QuestsSyncBar";
import { QuestsTree } from "./components/QuestsTree";
import { SlidersIcon } from "./components/quest-ui";

function QuestsContent() {
    const { viewMode } = useQuestsContext();
    if (viewMode === "tree") return <QuestsTree />;
    return <QuestsList />;
}

interface QuestsClientPageProps {
    quests: FullQuest[];
    updatedAt: number;
}

export function QuestsClientPage({ quests, updatedAt }: QuestsClientPageProps) {
    void updatedAt;
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <QuestsProvider quests={quests}>
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

            <div className="container mx-auto flex gap-0 py-8">
                {/* Left sidebar */}
                <aside className="hidden lg:flex flex-col gap-6 w-56 shrink-0 sticky top-4 self-start max-h-[calc(100vh-3rem)] overflow-y-auto pb-8 pl-6 pr-5">
                    <QuestsSidebar />
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0 px-6">
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
        </QuestsProvider>
    );
}
