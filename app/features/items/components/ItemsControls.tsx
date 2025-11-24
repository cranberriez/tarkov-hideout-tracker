"use client";

import { useUserStore } from "@/app/lib/stores/useUserStore";
import { Eye, EyeOff, Filter, LayoutList, List, Search, Tags } from "lucide-react";

interface ItemsControlsProps {
    onOpenSearch: () => void;
}

export function ItemsControls({ onOpenSearch }: ItemsControlsProps) {
    const {
        checklistViewMode,
        setChecklistViewMode,
        showHidden,
        setShowHidden,
        hideCheap,
        setHideCheap,
        compactMode,
        setCompactMode,
        cheapPriceThreshold,
        setCheapPriceThreshold,
        sellToPreference,
        setSellToPreference,
        useCategorization,
        setUseCategorization,
    } = useUserStore();

    return (
        <div className="flex flex-col gap-4 bg-[#1a1a1a] p-4 rounded-lg border border-[#2a2a2a]">
            <div className="flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Search Button */}
                    <button
                        onClick={onOpenSearch}
                        className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-colors"
                    >
                        <Search size={14} />
                        Search
                    </button>

                    {/* View Mode: All vs Next Level */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                            View
                        </span>
                        <div className="flex bg-black/40 rounded p-1 border border-white/10">
                            <button
                                onClick={() => setChecklistViewMode("nextLevel")}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                    checklistViewMode === "nextLevel"
                                        ? "bg-tarkov-green text-black"
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                Next Level
                            </button>
                            <button
                                onClick={() => setChecklistViewMode("all")}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                    checklistViewMode === "all"
                                        ? "bg-tarkov-green text-black"
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                All Future
                            </button>
                        </div>
                    </div>

                    {/* Sell To Preference */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                            Price
                        </span>
                        <div className="flex bg-black/40 rounded p-1 border border-white/10">
                            <button
                                onClick={() => setSellToPreference("best")}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                    sellToPreference === "best"
                                        ? "bg-tarkov-green text-black"
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                Best
                            </button>
                            <button
                                onClick={() => setSellToPreference("flea")}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                    sellToPreference === "flea"
                                        ? "bg-tarkov-green text-black"
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                Flea
                            </button>
                            <button
                                onClick={() => setSellToPreference("trader")}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                    sellToPreference === "trader"
                                        ? "bg-tarkov-green text-black"
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                Trader
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    {/* Categorize Toggle */}
                    <button
                        onClick={() => setUseCategorization(!useCategorization)}
                        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
                            useCategorization
                                ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10"
                                : "border-white/10 text-gray-400 hover:border-white/30"
                        }`}
                    >
                        <Tags size={14} />
                        Categorize
                    </button>

                    {/* Display Size: Small vs Large */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-black/40 rounded p-1 border border-white/10">
                            <button
                                onClick={() => setCompactMode(true)}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                                    compactMode
                                        ? "bg-tarkov-green text-black"
                                        : "text-gray-400 hover:text-white"
                                }`}
                                title="Small View"
                            >
                                <List size={14} />
                                Small
                            </button>
                            <button
                                onClick={() => setCompactMode(false)}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                                    !compactMode
                                        ? "bg-tarkov-green text-black"
                                        : "text-gray-400 hover:text-white"
                                }`}
                                title="Large View"
                            >
                                <LayoutList size={14} />
                                Large
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2">
                        {/* Show/Hide Hidden Stations */}
                        <button
                            onClick={() => setShowHidden(!showHidden)}
                            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
                                showHidden
                                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10"
                                    : "border-white/10 text-gray-400 hover:border-white/30"
                            }`}
                            title={
                                showHidden ? "Showing Hidden Stations" : "Hiding Hidden Stations"
                            }
                        >
                            {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>

                        {/* Hide Cheap */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setHideCheap(!hideCheap)}
                                className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
                                    hideCheap
                                        ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10"
                                        : "border-white/10 text-gray-400 hover:border-white/30"
                                }`}
                            >
                                <Filter size={14} />
                                Hide Cheap
                            </button>
                            {hideCheap && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 bg-black/40 px-2 py-1.5 rounded border border-white/10">
                                    <span>&lt;</span>
                                    <input
                                        type="number"
                                        value={cheapPriceThreshold}
                                        onChange={(e) =>
                                            setCheapPriceThreshold(Number(e.target.value))
                                        }
                                        className="w-16 bg-transparent text-right text-white focus:outline-none border-b border-gray-600 focus:border-tarkov-green appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <span>₽</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
