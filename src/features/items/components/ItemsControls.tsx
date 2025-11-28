"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { Eye, EyeOff, Filter, Grid3X3, LayoutList, List, Search, Shield, Tags } from "lucide-react";
import { ReactNode } from "react";

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
        itemsSize,
        setItemsSize,
        cheapPriceThreshold,
        setCheapPriceThreshold,
        sellToPreference,
        setSellToPreference,
        useCategorization,
        setUseCategorization,
        showFirOnly,
        setShowFirOnly,
    } = useUserStore();

    return (
        <div className="flex flex-col gap-2 bg-muted p-2 rounded-md border">
            {/* Search Bar */}
            <button
                onClick={onOpenSearch}
                className="group flex items-center gap-3 text-sm font-medium px-2 py-2 rounded-sm bg-black/40 border border-white/10 text-gray-400 hover:text-white hover:border-tarkov-green/50 hover:bg-black/60 transition-all w-full"
            >
                <Search
                    size={18}
                    className="text-gray-500 group-hover:text-tarkov-green transition-colors"
                />
                Search items...
            </button>

            <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
                {/* Left Group: View Settings */}
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-6 w-full xl:w-auto">
                    {/* View Mode */}
                    <ControlGroup label="View">
                        <ControlButton
                            active={checklistViewMode === "nextLevel"}
                            onClick={() => setChecklistViewMode("nextLevel")}
                        >
                            Next Level
                        </ControlButton>
                        <ControlButton
                            active={checklistViewMode === "all"}
                            onClick={() => setChecklistViewMode("all")}
                        >
                            All Future
                        </ControlButton>
                    </ControlGroup>

                    {/* Price Mode */}
                    <ControlGroup label="Price">
                        <ControlButton
                            active={sellToPreference === "best"}
                            onClick={() => setSellToPreference("best")}
                        >
                            Best
                        </ControlButton>
                        <ControlButton
                            active={sellToPreference === "flea"}
                            onClick={() => setSellToPreference("flea")}
                        >
                            Flea
                        </ControlButton>
                        <ControlButton
                            active={sellToPreference === "trader"}
                            onClick={() => setSellToPreference("trader")}
                        >
                            Trader
                        </ControlButton>
                    </ControlGroup>

                    {/* Size */}
                    <ControlGroup label="Size">
                        <ControlButton
                            active={itemsSize === "Icon"}
                            onClick={() => setItemsSize("Icon")}
                            icon={<Grid3X3 size={14} />}
                        >
                            Icon
                        </ControlButton>
                        <ControlButton
                            active={itemsSize === "Compact"}
                            onClick={() => setItemsSize("Compact")}
                            icon={<List size={14} />}
                        >
                            Compact
                        </ControlButton>
                        <ControlButton
                            active={itemsSize === "Expanded"}
                            onClick={() => setItemsSize("Expanded")}
                            icon={<LayoutList size={14} />}
                        >
                            Expanded
                        </ControlButton>
                    </ControlGroup>
                </div>

                {/* Right Group: Filters & Toggles */}
                <div className="flex flex-wrap self-end items-center gap-2 w-full xl:w-auto xl:justify-end">
                    <FilterButton
                        active={useCategorization}
                        onClick={() => setUseCategorization(!useCategorization)}
                        icon={<Tags size={14} />}
                        label="Categorize"
                    />

                    <FilterButton
                        active={showFirOnly}
                        onClick={() => setShowFirOnly(!showFirOnly)}
                        icon={<Shield size={14} />}
                        label="FiR Only"
                    />

                    <div
                        className={`flex items-center rounded-sm border transition-colors overflow-hidden ${
                            hideCheap ? "border-tarkov-green/50" : "border-white/10"
                        }`}
                    >
                        <button
                            onClick={() => setHideCheap(!hideCheap)}
                            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border cursor-pointer transition-all ${
                                hideCheap
                                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10 shadow-[0_0_10px_rgba(157,255,0,0.1)]"
                                    : "border-white/10 text-gray-400 hover:border-white/30 bg-black/20 hover:bg-black/40"
                            }`}
                        >
                            <Filter size={14} />
                            Hide Cheap
                        </button>
                        {hideCheap && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 bg-black/40 px-2 py-2 border-l border-tarkov-green/20">
                                <span>&lt;</span>
                                <input
                                    type="number"
                                    value={cheapPriceThreshold}
                                    onChange={(e) => setCheapPriceThreshold(Number(e.target.value))}
                                    className="w-16 bg-transparent text-right text-white focus:outline-none border-b border-gray-600 focus:border-tarkov-green appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none font-mono"
                                />
                                <span>₽</span>
                            </div>
                        )}
                    </div>

                    <FilterButton
                        active={showHidden}
                        onClick={() => setShowHidden(!showHidden)}
                        icon={showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                        label={showHidden ? "Show Hidden" : "Hide Hidden"}
                    />
                </div>
            </div>
        </div>
    );
}

// Subcomponents
function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold pl-1">
                {label}
            </span>
            <div className="flex flex-wrap bg-black/40 rounded-sm p-1 border border-white/10">{children}</div>
        </div>
    );
}

function ControlButton({
    active,
    onClick,
    children,
    icon,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xs transition-all ${
                active
                    ? "bg-tarkov-green text-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
        >
            {icon}
            <span className={icon ? "hidden sm:inline" : ""}>{children}</span>
        </button>
    );
}

function FilterButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border transition-all cursor-pointer ${
                active
                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10 shadow-[0_0_10px_rgba(157,255,0,0.1)]"
                    : "border-white/10 text-gray-400 hover:border-white/30 bg-black/20 hover:bg-black/40"
            }`}
        >
            {icon}
            {label}
        </button>
    );
}
