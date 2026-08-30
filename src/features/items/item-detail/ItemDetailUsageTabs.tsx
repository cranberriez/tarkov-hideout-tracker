"use client";

import { useState, type ReactNode } from "react";
import { ClipboardList, Hammer } from "lucide-react";
import type {
    DerivedQuestAnyOfGroup,
    DerivedQuestItemState,
} from "@/lib/utils/quest-item-index";
import {
    ItemDetailHideoutRequirements,
    type StationRequirementEntry,
} from "./ItemDetailHideoutRequirements";
import { ItemDetailQuestRequirements } from "./ItemDetailQuestRequirements";
import type { ItemDetails } from "@/types";

type UsageTab = "hideout" | "quests";

interface ItemDetailUsageTabsProps {
    className?: string;
    selectedItemId: string;
    selectedItemImageLink?: string;
    stationRequirements: [string, StationRequirementEntry[]][];
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    questItemState: DerivedQuestItemState | null;
    anyOfGroups: DerivedQuestAnyOfGroup[];
    itemDetailsById: Record<string, ItemDetails>;
}

export function ItemDetailUsageTabs({
    className = "",
    selectedItemId,
    selectedItemImageLink,
    stationRequirements,
    stationLevels,
    hiddenStations,
    questItemState,
    anyOfGroups,
    itemDetailsById,
}: ItemDetailUsageTabsProps) {
    const hideoutCount = stationRequirements.reduce((count, [, reqs]) => count + reqs.length, 0);
    const questCount = (questItemState?.relatedQuestCount ?? 0) + anyOfGroups.length;
    const availableTabs: UsageTab[] = [
        ...(hideoutCount > 0 ? (["hideout"] as const) : []),
        ...(questCount > 0 ? (["quests"] as const) : []),
    ];
    const [activeTab, setActiveTab] = useState<UsageTab>(availableTabs[0] ?? "hideout");

    if (availableTabs.length === 0) return null;

    return (
        <section className={`min-w-0 bg-card/45 ${className}`}>
            <div className="flex h-10 items-stretch border-b border-border-color" role="tablist">
                {hideoutCount > 0 && (
                    <TabButton
                        active={activeTab === "hideout"}
                        onClick={() => setActiveTab("hideout")}
                        label="Hideout"
                        count={hideoutCount}
                        icon={<Hammer size={13} />}
                    />
                )}
                {questCount > 0 && (
                    <TabButton
                        active={activeTab === "quests"}
                        onClick={() => setActiveTab("quests")}
                        label="Quests"
                        count={questCount}
                        icon={<ClipboardList size={13} />}
                    />
                )}
            </div>

            <div role="tabpanel">
                {activeTab === "hideout" && hideoutCount > 0 ? (
                    <ItemDetailHideoutRequirements
                        selectedItemImageLink={selectedItemImageLink}
                        stationRequirements={stationRequirements}
                        stationLevels={stationLevels}
                        hiddenStations={hiddenStations}
                    />
                ) : (
                    <ItemDetailQuestRequirements
                        selectedItemId={selectedItemId}
                        selectedItemImageLink={selectedItemImageLink}
                        questItemState={questItemState}
                        anyOfGroups={anyOfGroups}
                        itemDetailsById={itemDetailsById}
                    />
                )}
            </div>
        </section>
    );
}

function TabButton({
    active,
    onClick,
    label,
    count,
    icon,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
    icon: ReactNode;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`relative flex min-w-28 items-center justify-center gap-2 border-r border-border-color px-4 text-xs transition-colors ${
                active
                    ? "bg-white/[0.04] text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-tarkov-green"
                    : "text-muted-foreground hover:bg-white/[0.02] hover:text-foreground"
            }`}
        >
            {icon}
            {label}
            <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
        </button>
    );
}
