"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useQuestsContext } from "../QuestsContext";
import { SidebarLabel, SidebarToggle } from "./quest-ui";

export function QuestsSidebar() {
    const { traders, allMaps, selectedTraders, selectedMaps, toggleTrader, clearTraders, toggleMap, clearMaps } =
        useQuestsContext();
    const { playerLevel, setPlayerLevel, prestigeLevel, setPrestigeLevel } = useUserStore();

    return (
        <>
            {/* Player level */}
            <div className="flex flex-col gap-2">
                <SidebarLabel>Player Level</SidebarLabel>
                <div className="flex items-center gap-2 px-2">
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
            </div>

            {/* Prestige */}
            <div className="flex flex-col gap-2">
                <SidebarLabel>Prestige</SidebarLabel>
                <div className="flex gap-1 px-2">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                            key={n}
                            onClick={() => setPrestigeLevel(prestigeLevel === n ? 0 : n)}
                            className={`w-7 h-7 text-xs font-mono rounded transition-all flex items-center justify-center ${
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

            {/* Traders */}
            <div className="flex flex-col gap-1">
                <SidebarLabel>
                    Trader
                    {selectedTraders.size > 0 && (
                        <button
                            onClick={clearTraders}
                            className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            clear
                        </button>
                    )}
                </SidebarLabel>
                {traders.map((trader) => (
                    <SidebarToggle
                        key={trader.id}
                        active={selectedTraders.has(trader.id)}
                        onClick={() => toggleTrader(trader.id)}
                    >
                        {(trader.image4xLink ?? trader.imageLink) ? (
                            <img
                                src={trader.image4xLink ?? trader.imageLink ?? ""}
                                alt={trader.name}
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                            />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-gray-500 shrink-0">
                                {trader.name[0]}
                            </div>
                        )}
                        {trader.name}
                    </SidebarToggle>
                ))}
            </div>

            {/* Maps */}
            <div className="flex flex-col gap-1">
                <SidebarLabel>
                    Map
                    {selectedMaps.size > 0 && (
                        <button
                            onClick={clearMaps}
                            className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            clear
                        </button>
                    )}
                </SidebarLabel>
                {allMaps.map(([normalizedName, name]) => (
                    <SidebarToggle
                        key={normalizedName}
                        active={selectedMaps.has(normalizedName)}
                        onClick={() => toggleMap(normalizedName)}
                    >
                        {name}
                    </SidebarToggle>
                ))}
            </div>
        </>
    );
}
