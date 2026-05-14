"use client";

import type { FullQuest } from "@/types";

export function QuestSyncSelectableQuestRow({
    quest,
    checked,
    onToggle,
}: {
    quest: FullQuest;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className={`flex w-full items-start gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors ${
                checked
                    ? "border-tarkov-green/40 bg-tarkov-green/10"
                    : "border-white/10 bg-black/25 hover:border-white/25 hover:bg-white/5"
            }`}
        >
            <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border ${
                    checked
                        ? "border-tarkov-green bg-tarkov-green text-black"
                        : "border-white/20 bg-black/40"
                }`}
            >
                {checked ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">{quest.name}</span>
                <span className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-gray-500">
                    {quest.minPlayerLevel != null && <span>Lv.{quest.minPlayerLevel}</span>}
                    {quest.requiredPrestige && <span>P{quest.requiredPrestige.prestigeLevel}</span>}
                    {quest.traderRequirements.map((requirement) => (
                        <span key={requirement.id}>{requirement.trader.name} LL{requirement.value}</span>
                    ))}
                </span>
            </span>
        </button>
    );
}
