"use client";

import { useQuestsContext } from "../QuestsContext";
import { SidebarLabel, SidebarToggle } from "./quest-ui";

function scrollToTrader(traderId: string) {
    const el = document.getElementById(`trader-${traderId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export function QuestsSidebar() {
    const { traders, allMaps, selectedMaps, toggleMap, clearMaps } = useQuestsContext();

    return (
        <>
            {/* Traders */}
            <div className="flex flex-col gap-1">
                <SidebarLabel>Trader</SidebarLabel>
                {traders.map((trader) => (
                    <SidebarToggle
                        key={trader.id}
                        active={false}
                        onClick={() => scrollToTrader(trader.id)}
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
