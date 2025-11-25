"use client";

import { GameMode } from "@/app/lib/stores/useUserStore";

interface GameModeSelectionProps {
    selected: GameMode;
    onSelect: (mode: GameMode) => void;
}

export function GameModeSelection({ selected, onSelect }: GameModeSelectionProps) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col">
                <h3 className="text-lg font-medium text-white">
                    What version do you primarily play on?
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    This will effect shown flea market prices.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
                {(["PVP", "PVE"] as GameMode[]).map((mode) => {
                    const isSelected = selected === mode;
                    return (
                        <button
                            key={mode}
                            onClick={() => onSelect(mode)}
                            className={`
                                flex-1 p-3 rounded-md border-2 transition-all duration-200 font-bold text-center
                                ${
                                    isSelected
                                        ? "bg-white/10 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                        : "bg-card border-border-color text-gray-400 hover:border-gray-500 hover:text-gray-200 hover:bg-white/5"
                                }
                            `}
                        >
                            {mode}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
