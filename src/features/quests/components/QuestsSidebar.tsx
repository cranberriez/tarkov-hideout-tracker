"use client";

import { Eye, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuestsContext } from "../QuestsContext";
import { SidebarLabel, SidebarToggle } from "./quest-ui";

function scrollToTrader(traderId: string) {
    const el = document.getElementById(`trader-${traderId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function getCollapsedMapLabel(name: string) {
    if (name === "Ground Zero") return "GZ";
    if (name === "The Lab") return "Lab";

    const parts = name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.replace(/[^A-Za-z0-9+]/g, ""));

    if (parts.length === 1) return parts[0].slice(0, 2) || name.slice(0, 2);

    return (parts.map((part) => part[0]?.toUpperCase()).join("") || name[0] || "?").slice(0, 3);
}

interface QuestsSidebarProps {
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
}

export function QuestsSidebar({ collapsed = false, onToggleCollapsed }: QuestsSidebarProps) {
    const {
        traders,
        allMaps,
        selectedTraders,
        selectedMaps,
        toggleTrader,
        showOnlyTrader,
        toggleMap,
        clearMaps,
    } = useQuestsContext();

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
                {traders.map((trader) => {
                    const isSelected = selectedTraders.has(trader.id);

                    return (
                        <div
                            key={trader.id}
                            className={cn(
                                "group flex items-center gap-1 rounded-sm border-l-2 transition-all",
                                isSelected
                                    ? "border-tarkov-green bg-tarkov-green/5"
                                    : "border-transparent hover:bg-white/5",
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => scrollToTrader(trader.id)}
                                className={cn(
                                    "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors",
                                    isSelected
                                        ? "text-tarkov-green"
                                        : "text-gray-400 group-hover:text-white",
                                    collapsed && "justify-center px-0",
                                )}
                            >
                                {(trader.image4xLink ?? trader.imageLink) ? (
                                    <img
                                        src={trader.image4xLink ?? trader.imageLink ?? ""}
                                        alt={trader.name}
                                        className="size-5 shrink-0 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] text-gray-500">
                                        {trader.name[0]}
                                    </div>
                                )}
                                {!collapsed && <span className="truncate">{trader.name}</span>}
                            </button>

                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (isSelected) toggleTrader(trader.id);
                                    else showOnlyTrader(trader.id);
                                }}
                                aria-label={
                                    isSelected
                                        ? `Remove ${trader.name} from trader filters`
                                        : `Show only ${trader.name}`
                                }
                                title={
                                    isSelected ? "Remove trader filter" : "Show only this trader"
                                }
                                className={cn(
                                    "mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-gray-500 transition-colors hover:text-white",
                                    isSelected
                                        ? "opacity-100"
                                        : collapsed
                                          ? "opacity-100"
                                          : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
                                )}
                            >
                                {isSelected ? <X size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    );
                })}
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
