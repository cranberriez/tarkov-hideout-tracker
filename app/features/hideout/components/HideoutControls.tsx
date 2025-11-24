"use client";

import { useState } from "react";
import { useUserStore } from "@/app/lib/stores/useUserStore";

export function HideoutControls() {
    const {
        showHidden,
        setShowHidden,
        compactMode,
        setCompactMode,
        hideMoney,
        setHideMoney,
        hideRequirements,
        setHideRequirements,
    } = useUserStore();

    return (
        <div className="flex flex-col gap-4 bg-[#1a1a1a] p-4 rounded-lg border border-[#2a2a2a]">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setHideRequirements(!hideRequirements)}
                    className={`text-xs font-bold border border-border-color px-3 py-2 rounded uppercase tracking-widest transition-colors ${
                        hideRequirements
                            ? "bg-white/10 text-white border-white/20"
                            : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {hideRequirements ? "Show Reqs" : "Hide Reqs"}
                </button>

                <button
                    onClick={() => setHideMoney(!hideMoney)}
                    className={`text-xs font-bold border border-border-color px-3 py-2 rounded uppercase tracking-widest transition-colors ${
                        hideMoney
                            ? "bg-white/10 text-white border-white/20"
                            : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {hideMoney ? "Show Money" : "Hide Money"}
                </button>

                <button
                    onClick={() => setShowHidden(!showHidden)}
                    className={`text-xs font-bold border border-border-color px-3 py-2 rounded uppercase tracking-widest transition-colors ${
                        showHidden
                            ? "bg-white/10 text-white border-white/20"
                            : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {showHidden ? "Show Hidden" : "Hide Hidden"}
                </button>

                <div className="flex items-center border border-border-color rounded overflow-hidden">
                    <button
                        onClick={() => setCompactMode(false)}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                            !compactMode
                                ? "bg-white/10 text-white"
                                : "text-gray-400 hover:bg-white/5"
                        }`}
                        title="Expanded View"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                    </button>
                    <button
                        onClick={() => setCompactMode(true)}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                            compactMode
                                ? "bg-white/10 text-white"
                                : "text-gray-400 hover:bg-white/5"
                        }`}
                        title="Compact View"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
