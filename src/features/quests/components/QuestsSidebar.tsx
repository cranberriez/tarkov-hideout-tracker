"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useQuestsContext } from "../QuestsContext";
import { SidebarLabel, SidebarToggle } from "./quest-ui";

function scrollToTrader(traderId: string) {
    const el = document.getElementById(`trader-${traderId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function getCollapsedMapLabel(name: string) {
    if (name === "Ground Zero 21+") return "GZ+";
    if (name === "Ground Zero") return "GZ";
    if (name === "Customs") return "C";
    if (name === "The Lab") return "L";

    const parts = name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.replace(/[^A-Za-z0-9+]/g, ""));

    return (parts.map((part) => part[0]?.toUpperCase()).join("") || name[0] || "?").slice(0, 3);
}

interface QuestsSidebarProps {
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
}

export function QuestsSidebar({ collapsed = false, onToggleCollapsed }: QuestsSidebarProps) {
    const { traders, allMaps, selectedMaps, toggleMap, clearMaps } = useQuestsContext();

    return (
        <>
            <div
                className={`hidden lg:flex items-center ${collapsed ? "justify-center" : "justify-end"}`}
            >
                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-white/10 bg-black/20 text-gray-400 transition-colors hover:border-white/25 hover:text-white"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                </button>
            </div>

            {/* Traders */}
            <div className="flex flex-col gap-1">
                {!collapsed && <SidebarLabel>Trader</SidebarLabel>}
                {traders.map((trader) => (
                    <SidebarToggle
                        key={trader.id}
                        active={false}
                        onClick={() => scrollToTrader(trader.id)}
                        className={collapsed ? "justify-center px-0" : ""}
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
                        {!collapsed && trader.name}
                    </SidebarToggle>
                ))}
            </div>

            {/* Maps */}
            <div className="flex flex-col gap-1">
                {!collapsed && (
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
                )}
                {allMaps.map(([normalizedName, name]) => (
                    <SidebarToggle
                        key={normalizedName}
                        active={selectedMaps.has(normalizedName)}
                        onClick={() => toggleMap(normalizedName)}
                        className={collapsed ? "justify-center px-1 text-[11px] font-semibold" : ""}
                    >
                        {collapsed ? getCollapsedMapLabel(name) : name}
                    </SidebarToggle>
                ))}
            </div>
        </>
    );
}
