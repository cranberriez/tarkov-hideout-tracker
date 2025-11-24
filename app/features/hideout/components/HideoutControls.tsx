"use client";

import { useState } from "react";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import { Rows3, Grid2x2, Rows2 } from "lucide-react";

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
                        <Rows2 size={16} />
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
                        <Grid2x2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
