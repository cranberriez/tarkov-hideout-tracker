"use client";

import { CircleSlash, Info, Link2, Pin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuestsContext } from "../QuestsContext";
import { QuestSyncDialog } from "./QuestSyncDialog";

const QUEST_SEARCH_DEBOUNCE_MS = 30;

export function QuestsSyncBar() {
    const { searchQuery, setSearchQuery } = useQuestsContext();
    const [searchInput, setSearchInput] = useState(searchQuery);
    const [syncOpen, setSyncOpen] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchQuery(searchInput);
        }, QUEST_SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [searchInput, setSearchQuery]);

    return (
        <>
            <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-black/20 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="Filter quests by quest, trader, or map"
                                className="w-full rounded-sm border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-tarkov-green/50"
                            />
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center">
                        <button
                            onClick={() => setSyncOpen(true)}
                            className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-tarkov-green transition-colors hover:border-tarkov-green/60"
                        >
                            Sync
                        </button>
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

            <QuestSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
        </>
    );
}
