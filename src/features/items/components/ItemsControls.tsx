"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
    Eye,
    EyeOff,
    Filter,
    Grid3X3,
    LayoutList,
    List,
    Search,
    Settings,
    Shield,
    Tags,
} from "lucide-react";

interface ItemsControlsProps {
    onOpenSearch: () => void;
}

export function ItemsControls({ onOpenSearch }: ItemsControlsProps) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

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
        useCategorization,
        setUseCategorization,
        showFirOnly,
        setShowFirOnly,
        itemSourceFilter,
        setItemSourceFilter,
        itemShowPinnedQuestSection,
        itemShowPinnedQuestOnly,
        setItemShowPinnedQuestSection,
        setItemShowPinnedQuestOnly,
    } = useUserStore();

    useEffect(() => {
        if (!popoverOpen) return;
        function handleClickOutside(e: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setPopoverOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [popoverOpen]);

    const hasActiveAdvanced = checklistViewMode !== "all" || showHidden;

    return (
        <div className="flex flex-wrap gap-1.5 bg-muted px-3 py-2 rounded-md border">
            {/* Search — grows to fill available width */}
            <button
                onClick={onOpenSearch}
                className="group flex flex-1 min-w-[130px] items-center gap-2 px-3 py-1.5 rounded-sm bg-black/40 border border-white/10 text-gray-400 hover:text-white hover:border-tarkov-green/50 hover:bg-black/60 transition-all"
            >
                <Search
                    size={14}
                    className="text-gray-500 group-hover:text-tarkov-green transition-colors shrink-0"
                />
                <span className="text-xs">Search items...</span>
            </button>

            {/* Source filter — grows, internal buttons fill evenly */}
            <div className="flex flex-1 min-w-[160px] bg-black/40 rounded-sm p-1 border border-white/10">
                <SegButton
                    grow
                    active={itemSourceFilter === "all"}
                    onClick={() => setItemSourceFilter("all")}
                >
                    All
                </SegButton>
                <SegButton
                    grow
                    active={itemSourceFilter === "hideout"}
                    onClick={() => setItemSourceFilter("hideout")}
                >
                    Hideout
                </SegButton>
                <SegButton
                    grow
                    active={itemSourceFilter === "quest"}
                    onClick={() => setItemSourceFilter("quest")}
                >
                    Quests
                </SegButton>
            </div>

            {/* Card size — fixed width (icon-only buttons) */}
            <div className="flex shrink-0 bg-black/40 rounded-sm p-1 border border-white/10">
                <SegButton
                    active={itemsSize === "Icon"}
                    onClick={() => setItemsSize("Icon")}
                    icon={<Grid3X3 size={13} />}
                />
                <SegButton
                    active={itemsSize === "Compact"}
                    onClick={() => setItemsSize("Compact")}
                    icon={<List size={13} />}
                />
                <SegButton
                    active={itemsSize === "Expanded"}
                    onClick={() => setItemsSize("Expanded")}
                    icon={<LayoutList size={13} />}
                />
            </div>

            {/* Quick filters — each grows */}
            <FilterButton
                active={useCategorization}
                onClick={() => setUseCategorization(!useCategorization)}
                icon={<Tags size={14} />}
                label="Categorize"
                className="flex-1 min-w-[100px] justify-center"
            />
            <FilterButton
                active={showFirOnly}
                onClick={() => setShowFirOnly(!showFirOnly)}
                icon={<Shield size={14} />}
                label="FiR Only"
                className="flex-1 min-w-[80px] justify-center"
            />
            <HideCheapControl
                hideCheap={hideCheap}
                setHideCheap={setHideCheap}
                cheapPriceThreshold={cheapPriceThreshold}
                setCheapPriceThreshold={setCheapPriceThreshold}
                className="flex-1 min-w-[100px]"
            />

            {/* Settings popover */}
            <div className="relative shrink-0" ref={popoverRef}>
                <button
                    onClick={() => setPopoverOpen((v) => !v)}
                    className={`flex items-center px-3 py-2 rounded-sm border text-xs font-medium transition-all cursor-pointer ${
                        popoverOpen || hasActiveAdvanced
                            ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10 shadow-[0_0_10px_rgba(157,255,0,0.1)]"
                            : "border-white/10 text-gray-400 hover:border-white/30 bg-black/20 hover:bg-black/40"
                    }`}
                    title="Advanced filters"
                >
                    <Settings size={14} />
                </button>

                {popoverOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 bg-[#161616] border border-white/15 rounded-md shadow-xl flex flex-col gap-0 min-w-56 overflow-hidden">
                        <PopoverSection label="Hideout">
                            <SegGroup>
                                <SegButton
                                    active={checklistViewMode === "nextLevel"}
                                    onClick={() => setChecklistViewMode("nextLevel")}
                                >
                                    Next Level
                                </SegButton>
                                <SegButton
                                    active={checklistViewMode === "all"}
                                    onClick={() => setChecklistViewMode("all")}
                                >
                                    All Future
                                </SegButton>
                            </SegGroup>
                            <FilterButton
                                active={showHidden}
                                onClick={() => setShowHidden(!showHidden)}
                                icon={showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                label="Show Hidden Stations"
                            />
                        </PopoverSection>

                        <div className="h-px bg-white/5" />

                        <PopoverSection label="Quests">
                            <FilterButton
                                active={itemShowPinnedQuestSection}
                                onClick={() =>
                                    setItemShowPinnedQuestSection(!itemShowPinnedQuestSection)
                                }
                                icon={<Tags size={14} />}
                                label="Pinned Section"
                            />
                            <FilterButton
                                active={itemShowPinnedQuestOnly}
                                onClick={() => setItemShowPinnedQuestOnly(!itemShowPinnedQuestOnly)}
                                icon={<Filter size={14} />}
                                label="Pinned Only"
                            />
                        </PopoverSection>
                    </div>
                )}
            </div>
        </div>
    );
}

function Divider() {
    return <div className="h-5 w-px bg-white/10 shrink-0" />;
}

function SegGroup({ children }: { children: ReactNode }) {
    return (
        <div className="flex shrink-0 bg-black/40 rounded-sm p-1 border border-white/10">
            {children}
        </div>
    );
}

function SegButton({
    active,
    onClick,
    children,
    icon,
    grow,
}: {
    active: boolean;
    onClick: () => void;
    children?: ReactNode;
    icon?: ReactNode;
    grow?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-xs transition-all ${
                grow ? "flex-1" : ""
            } ${
                active
                    ? "bg-tarkov-green text-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
        >
            {icon}
            {children}
        </button>
    );
}

function FilterButton({
    active,
    onClick,
    icon,
    label,
    className,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border transition-all cursor-pointer ${
                active
                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10 shadow-[0_0_10px_rgba(157,255,0,0.1)]"
                    : "border-white/10 text-gray-400 hover:border-white/30 bg-black/20 hover:bg-black/40"
            } ${className ?? ""}`}
        >
            {icon}
            {label}
        </button>
    );
}

function HideCheapControl({
    hideCheap,
    setHideCheap,
    cheapPriceThreshold,
    setCheapPriceThreshold,
    className,
}: {
    hideCheap: boolean;
    setHideCheap: (v: boolean) => void;
    cheapPriceThreshold: number;
    setCheapPriceThreshold: (v: number) => void;
    className?: string;
}) {
    return (
        <div
            className={`flex items-center rounded-sm border transition-colors overflow-hidden ${
                hideCheap ? "border-tarkov-green/50" : "border-white/10"
            } ${className ?? ""}`}
        >
            <button
                onClick={() => setHideCheap(!hideCheap)}
                className={`flex flex-1 items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border cursor-pointer transition-all ${
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
    );
}

function PopoverSection({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2.5 p-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                {label}
            </span>
            <div className="flex flex-wrap gap-2 items-center">{children}</div>
        </div>
    );
}
