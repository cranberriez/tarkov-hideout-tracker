"use client";

import { CircleSlash, Info, Link2, Pin, Search, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { matchesFactionVisibility, useQuestsContext } from "../QuestsContext";

const QUEST_SEARCH_DEBOUNCE_MS = 30;
const NETWORK_PROVIDER_PART_1 = {
    id: "625d6ff5ddc94657c21a1625",
    name: "Network Provider - Part 1",
    normalizedName: "network-provider-part-1",
};

export function QuestsSyncBar() {
    const {
        quests,
        faction,
        searchQuery,
        setSearchQuery,
        completePrerequisitesForQuest,
        undoLastPrerequisiteSync,
        lastPrereqSyncSummary,
    } = useQuestsContext();
    const [searchInput, setSearchInput] = useState(searchQuery);
    const [syncQuery, setSyncQuery] = useState("");
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const [syncResultText, setSyncResultText] = useState<string | null>(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchQuery(searchInput);
        }, QUEST_SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [searchInput, setSearchQuery]);

    const matchingSyncQuests = useMemo(() => {
        const normalized = syncQuery.trim().toLowerCase();
        if (!normalized) return [];

        return quests
            .filter(
                (quest) =>
                    matchesFactionVisibility(quest.factionName, faction) &&
                    (quest.name.toLowerCase().includes(normalized) ||
                        quest.trader.name.toLowerCase().includes(normalized)),
            )
            .slice(0, 8);
    }, [faction, quests, syncQuery]);

    const selectedQuest = useMemo(
        () => quests.find((quest) => quest.id === selectedQuestId) ?? null,
        [quests, selectedQuestId],
    );
    const showNetworkProviderWarning =
        selectedQuest?.id === NETWORK_PROVIDER_PART_1.id &&
        selectedQuest.name === NETWORK_PROVIDER_PART_1.name &&
        selectedQuest.normalizedName === NETWORK_PROVIDER_PART_1.normalizedName;

    return (
        <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-1 flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Search
                    </label>
                    <div className="relative">
                        <Search
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Filter quests by quest, trader, or map"
                            className="w-full rounded-sm border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-tarkov-green/50"
                        />
                    </div>
                </div>

                <div className="flex flex-1 flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Sync Progress
                    </label>
                    <div className="relative">
                        <SkipForward
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                            value={syncQuery}
                            onChange={(e) => {
                                setSyncQuery(e.target.value);
                                setSelectedQuestId(null);
                            }}
                            placeholder="Search the quest you're currently on"
                            className="w-full rounded-sm border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-tarkov-green/50"
                        />
                        {matchingSyncQuests.length > 0 && selectedQuestId === null && (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-10 rounded-sm border border-white/10 bg-[#0f0f0f] p-1 shadow-xl">
                                {matchingSyncQuests.map((quest) => (
                                    <button
                                        key={quest.id}
                                        onClick={() => {
                                            setSelectedQuestId(quest.id);
                                            setSyncQuery(quest.name);
                                        }}
                                        className={`flex w-full items-center justify-between gap-3 rounded-xs px-2 py-2 text-left transition-colors ${
                                            selectedQuestId === quest.id
                                                ? "bg-tarkov-green/10 text-white"
                                                : "text-gray-300 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        <span className="min-w-0 truncate text-sm">{quest.name}</span>
                                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
                                            {quest.trader.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (!selectedQuestId) return;
                                const result = completePrerequisitesForQuest(selectedQuestId);
                                setSyncResultText(
                                    result.completedCount > 0
                                        ? `Completed ${result.completedCount} pre-req${result.completedCount === 1 ? "" : "s"}.`
                                        : "No missing pre-reqs to complete.",
                                );
                                setSelectedQuestId(null);
                                setSyncQuery("");
                            }}
                            disabled={!selectedQuestId}
                            className={`shrink-0 rounded-sm border px-3 py-2 text-xs font-medium transition-all ${
                                selectedQuestId
                                    ? "border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-tarkov-green/60"
                                    : "cursor-not-allowed border-white/5 bg-black/10 text-gray-700"
                            }`}
                        >
                            Sync Pre-Reqs
                        </button>
                        <span className="min-w-0 text-xs text-gray-500">
                            Completes earlier quests only.
                        </span>
                    </div>
                    {showNetworkProviderWarning && (
                        <div className="rounded-sm border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                            If acquired via story quests, do not sync progress, story skips a lot of pre-requisite quests.
                        </div>
                    )}
                    {(syncResultText || lastPrereqSyncSummary) && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-tarkov-green">
                                {syncResultText ??
                                    `Completed ${lastPrereqSyncSummary?.completedCount ?? 0} pre-req${lastPrereqSyncSummary?.completedCount === 1 ? "" : "s"} for ${lastPrereqSyncSummary?.questName}.`}
                            </span>
                            {(lastPrereqSyncSummary?.completedCount ?? 0) > 0 && (
                                <button
                                    onClick={() => {
                                        if (undoLastPrerequisiteSync()) {
                                            setSyncResultText("Last pre-req sync undone.");
                                        }
                                    }}
                                    className="rounded-sm border border-white/10 px-2 py-1 text-gray-300 transition-colors hover:border-white/25 hover:text-white"
                                >
                                    Undo
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 text-gray-400">
                    <Info size={12} />
                    Quick guide
                </span>
                <span className="inline-flex items-center gap-1">
                    <Pin size={12} className="text-sky-300" />
                    Pin keeps a quest surfaced and easy to revisit.
                </span>
                <span className="inline-flex items-center gap-1">
                    <CircleSlash size={12} className="text-red-300" />
                    Ignore hides side branches you do not want to track right now.
                </span>
                <span className="inline-flex items-center gap-1">
                    <Link2 size={12} className="text-gray-400" />
                    Links jump between prerequisites and follow-up quests.
                </span>
            </div>
        </div>
    );
}
