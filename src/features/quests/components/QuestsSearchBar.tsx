"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuestsContext } from "../QuestsContext";

const QUEST_SEARCH_DEBOUNCE_MS = 30;

export function QuestsSearchBar() {
    const { searchQuery, setSearchQuery } = useQuestsContext();
    const [searchInput, setSearchInput] = useState(searchQuery);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchQuery(searchInput);
        }, QUEST_SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [searchInput, setSearchQuery]);

    return (
        <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-black/20 p-3">
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
                    placeholder="Search for and filter quests..."
                    className="w-full rounded-sm border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-tarkov-green/50"
                />
            </div>
        </div>
    );
}
