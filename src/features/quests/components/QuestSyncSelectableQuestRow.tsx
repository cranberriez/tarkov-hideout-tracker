"use client";

import type { FullQuest } from "@/types/quests";
import { formatQuestTraderGate } from "@/lib/utils/quest-trader-gates";
import { hasDisplayQuestLevel } from "@/lib/utils/quest-display";

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
                    ? "border-warning/40 bg-warning/10"
                    : "border-highlight/10 bg-shadow/25 hover:border-highlight/25 hover:bg-highlight/5"
            }`}
        >
            <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border ${
                    checked
                        ? "border-warning bg-warning text-inverse"
                        : "border-highlight/20 bg-shadow/40"
                }`}
            >
                {checked ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{quest.name}</span>
                <span className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-subtle-foreground">
                    {hasDisplayQuestLevel(quest.minPlayerLevel) && (
                        <span>Lv.{quest.minPlayerLevel}</span>
                    )}
                    {quest.requiredPrestige && <span>P{quest.requiredPrestige.prestigeLevel}</span>}
                    {quest.traderRequirements.map((requirement) => (
                        <span key={requirement.id}>
                            {formatQuestTraderGate(requirement)}
                        </span>
                    ))}
                    {checked && <span className="text-warning">ACTIVE</span>}
                </span>
            </span>
        </button>
    );
}
