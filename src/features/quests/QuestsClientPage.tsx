"use client";

import type { Quest, Trader } from "@/types";

interface QuestsClientPageProps {
    quests: Quest[];
    traders: Trader[];
    updatedAt: number;
}

export function QuestsClientPage({ quests, traders, updatedAt }: QuestsClientPageProps) {
    void traders;
    void updatedAt;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-white mb-2">Quests</h1>
            <p className="text-gray-400 text-sm">
                {quests.length} quests with item hand-in requirements — display coming soon.
            </p>
        </div>
    );
}
