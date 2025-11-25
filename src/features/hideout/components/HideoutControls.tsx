"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { Rows3, Grid2x2, Rows2 } from "lucide-react";

export function HideoutControls() {
    const {
        showHidden,
        setShowHidden,
        hideoutCompactMode,
        setHideoutCompactMode,
        hideMoney,
        setHideMoney,
        hideRequirements,
        setHideRequirements,
    } = useUserStore();

    return (
        <div className="flex flex-col gap-2 bg-muted p-2 rounded-lg border">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setHideRequirements(!hideRequirements)}
                    className={`text-xs font-bold font-mono border border-border-color px-3 py-2 rounded uppercase tracking-widest transition-colors ${
                        hideRequirements
                            ? "bg-white/10 text-white border-white/20"
                            : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {hideRequirements ? "Show Reqs" : "Hide Reqs"}
                </button>

                <button
                    onClick={() => setHideMoney(!hideMoney)}
                    className={`text-xs font-bold font-mono border border-border-color px-3 py-2 rounded uppercase tracking-widest transition-colors ${
                        hideMoney
                            ? "bg-white/10 text-white border-white/20"
                            : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {hideMoney ? "Show Money" : "Hide Money"}
                </button>

                <button
                    onClick={() => setShowHidden(!showHidden)}
                    className={`text-xs font-bold font-mono border border-border-color px-3 py-2 rounded uppercase tracking-widest transition-colors ${
                        showHidden
                            ? "bg-white/10 text-white border-white/20"
                            : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {showHidden ? "Hide Hidden" : "Show Hidden"}
                </button>

                <div className="flex items-center border border-border-color rounded overflow-hidden">
                    <button
                        onClick={() => setHideoutCompactMode(false)}
                        className={`px-3 py-2 text-xs font-bold font-mono uppercase tracking-widest transition-colors ${
                            !hideoutCompactMode
                                ? "bg-white/10 text-white"
                                : "text-gray-400 hover:bg-white/5"
                        }`}
                        title="Expanded View"
                    >
                        <Rows2 size={16} />
                    </button>
                    <button
                        onClick={() => setHideoutCompactMode(true)}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                            hideoutCompactMode
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
