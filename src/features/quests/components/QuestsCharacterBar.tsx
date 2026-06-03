"use client";

import { useShallow } from "zustand/react/shallow";
import { QuestFlagFilters } from "@/components/core/QuestFlagFilters";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useQuestsContext } from "../QuestsContext";
import { Divider, SegButton, SegGroup } from "./quest-ui";

export function QuestsCharacterBar() {
    const { playerLevel, setPlayerLevel, prestigeLevel, setPrestigeLevel } = useUserStore(
        useShallow((state) => ({
            playerLevel: state.playerLevel,
            setPlayerLevel: state.setPlayerLevel,
            prestigeLevel: state.prestigeLevel,
            setPrestigeLevel: state.setPrestigeLevel,
        })),
    );
    const { faction, showKappa, showLightkeeper, toggleFaction, toggleKappa, toggleLightkeeper } =
        useQuestsContext();

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 shrink-0">Lv.</span>
                <input
                    type="number"
                    min={1}
                    max={100}
                    value={playerLevel}
                    onChange={(e) =>
                        setPlayerLevel(Math.min(100, Math.max(1, Number(e.target.value))))
                    }
                    className="w-14 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-tarkov-green/50 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
            </div>

            <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 shrink-0">Prestige</span>
                <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                            key={n}
                            onClick={() => setPrestigeLevel(prestigeLevel === n ? 0 : n)}
                            className={`w-6 h-6 text-xs font-mono rounded transition-all flex items-center justify-center ${
                                prestigeLevel >= n
                                    ? "bg-purple-500/80 text-white font-bold shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                                    : "bg-black/40 border border-white/10 text-gray-500 hover:text-white hover:border-white/30"
                            }`}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            <Divider />

            <SegGroup>
                <SegButton active={faction === "USEC"} onClick={() => toggleFaction("USEC")}>
                    USEC
                </SegButton>
                <SegButton active={faction === "BEAR"} onClick={() => toggleFaction("BEAR")}>
                    BEAR
                </SegButton>
            </SegGroup>

            <Divider />

            <QuestFlagFilters
                showKappa={showKappa}
                showLightkeeper={showLightkeeper}
                onToggleKappa={toggleKappa}
                onToggleLightkeeper={toggleLightkeeper}
            />
        </div>
    );
}
