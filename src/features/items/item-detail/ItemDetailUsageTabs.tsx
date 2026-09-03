"use client";

import { useState, type ReactNode } from "react";
import { ChartNoAxesCombined, ClipboardList, Hammer, ShoppingCart, Wrench } from "lucide-react";
import type {
    DerivedQuestAnyOfGroup,
    DerivedQuestItemState,
    QuestRewardLink,
} from "@/lib/utils/quest-item-index";
import {
    ItemDetailHideoutRequirements,
    type StationRequirementEntry,
} from "./ItemDetailHideoutRequirements";
import { ItemDetailQuestRequirements } from "./ItemDetailQuestRequirements";
import { ItemDetailAcquisition } from "./ItemDetailAcquisition";
import { ItemDetailCrafting } from "./ItemDetailCrafting";
import { ItemDetailPriceHistory } from "./ItemDetailPriceHistory";
import type { ItemCraftRecipe, ItemDetails, ItemTraderOffer } from "@/types";
import type { GameEdition } from "@/lib/stores/useUserStore";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { RecipeEvaluation } from "@/lib/price-calculation";

type UsageTab = "hideout" | "quests" | "traders" | "crafting" | "prices";

interface ItemDetailUsageTabsProps {
    className?: string;
    selectedItemId: string;
    selectedItemImageLink?: string;
    stationRequirements: [string, StationRequirementEntry[]][];
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    questItemState: DerivedQuestItemState | null;
    questRewards: QuestRewardLink[];
    anyOfGroups: DerivedQuestAnyOfGroup[];
    itemDetailsById: Record<string, ItemDetails>;
    traderOffers: ItemTraderOffer[];
    crafts: ItemCraftRecipe[];
    acquisitionLoading: boolean;
    barterError: string | null;
    craftError: string | null;
    completedQuests: Record<string, boolean>;
    traderLoyaltyLevels: Record<string, number>;
    gameEdition: GameEdition | null;
    gameMode: TarkovJsonGameMode;
    showPriceHistory: boolean;
    barterEvaluationsById: Readonly<Record<string, RecipeEvaluation>>;
    craftEvaluationsById: Readonly<Record<string, RecipeEvaluation>>;
    profitLoading: boolean;
    profitError: string | null;
    onItemClick: (itemId: string) => void;
}

export function ItemDetailUsageTabs({
    className = "",
    selectedItemId,
    selectedItemImageLink,
    stationRequirements,
    stationLevels,
    hiddenStations,
    questItemState,
    questRewards,
    anyOfGroups,
    itemDetailsById,
    traderOffers,
    crafts,
    acquisitionLoading,
    barterError,
    craftError,
    completedQuests,
    traderLoyaltyLevels,
    gameEdition,
    gameMode,
    showPriceHistory,
    barterEvaluationsById,
    craftEvaluationsById,
    profitLoading,
    profitError,
    onItemClick,
}: ItemDetailUsageTabsProps) {
    const hideoutCount = stationRequirements.reduce((count, [, reqs]) => count + reqs.length, 0);
    const questCount = (questItemState?.relatedQuestCount ?? 0) + anyOfGroups.length + questRewards.length;
    const availableTabs: UsageTab[] = [
        ...(hideoutCount > 0 ? (["hideout"] as const) : []),
        ...(questCount > 0 ? (["quests"] as const) : []),
        ...(traderOffers.length > 0 || acquisitionLoading || barterError
            ? (["traders"] as const)
            : []),
        ...(crafts.length > 0 || acquisitionLoading || craftError
            ? (["crafting"] as const)
            : []),
        ...(showPriceHistory ? (["prices"] as const) : []),
    ];
    const [activeTab, setActiveTab] = useState<UsageTab>(availableTabs[0] ?? "hideout");
    const selectedTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];
    const selectedItem = itemDetailsById[selectedItemId] ?? {
        id: selectedItemId,
        name: "Selected item",
        normalizedName: selectedItemId,
        iconLink: selectedItemImageLink,
    };

    if (availableTabs.length === 0) return null;

    return (
        <section className={`flex min-h-0 min-w-0 flex-col bg-card/45 ${className}`}>
            <div className="flex h-10 items-stretch overflow-x-auto border-b border-border-color" role="tablist">
                {hideoutCount > 0 && (
                    <TabButton
                        active={selectedTab === "hideout"}
                        onClick={() => setActiveTab("hideout")}
                        label="Hideout"
                        count={hideoutCount}
                        icon={<Hammer size={13} />}
                    />
                )}
                {questCount > 0 && (
                    <TabButton
                        active={selectedTab === "quests"}
                        onClick={() => setActiveTab("quests")}
                        label="Quests"
                        count={questCount}
                        icon={<ClipboardList size={13} />}
                    />
                )}
                {(traderOffers.length > 0 || acquisitionLoading || barterError) && (
                    <TabButton
                        active={selectedTab === "traders"}
                        onClick={() => setActiveTab("traders")}
                        label="Traders"
                        count={acquisitionLoading ? undefined : traderOffers.length}
                        icon={<ShoppingCart size={13} />}
                    />
                )}
                {(crafts.length > 0 || acquisitionLoading || craftError) && (
                    <TabButton
                        active={selectedTab === "crafting"}
                        onClick={() => setActiveTab("crafting")}
                        label="Crafting"
                        count={acquisitionLoading ? undefined : crafts.length}
                        icon={<Wrench size={13} />}
                    />
                )}
                {showPriceHistory && (
                    <TabButton
                        active={selectedTab === "prices"}
                        onClick={() => setActiveTab("prices")}
                        label="History"
                        icon={<ChartNoAxesCombined size={13} />}
                    />
                )}
            </div>

            <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
                {selectedTab === "hideout" && hideoutCount > 0 && (
                    <ItemDetailHideoutRequirements
                        selectedItemImageLink={selectedItemImageLink}
                        stationRequirements={stationRequirements}
                        stationLevels={stationLevels}
                        hiddenStations={hiddenStations}
                    />
                )}
                {selectedTab === "quests" && questCount > 0 && (
                    <ItemDetailQuestRequirements
                        selectedItemId={selectedItemId}
                        selectedItemImageLink={selectedItemImageLink}
                        questItemState={questItemState}
                        questRewards={questRewards}
                        anyOfGroups={anyOfGroups}
                        itemDetailsById={itemDetailsById}
                        completedQuests={completedQuests}
                    />
                )}
                {selectedTab === "traders" && (
                    <AcquisitionState loading={acquisitionLoading} error={barterError} empty={traderOffers.length === 0}>
                        <ItemDetailAcquisition
                            offers={traderOffers}
                            completedQuests={completedQuests}
                            traderLoyaltyLevels={traderLoyaltyLevels}
                            evaluationsById={barterEvaluationsById}
                            profitLoading={profitLoading}
                            profitError={profitError}
                            outputItem={selectedItem}
                            onItemClick={onItemClick}
                        />
                    </AcquisitionState>
                )}
                {selectedTab === "crafting" && (
                    <AcquisitionState loading={acquisitionLoading} error={craftError} empty={crafts.length === 0}>
                        <ItemDetailCrafting
                            recipes={crafts}
                            completedQuests={completedQuests}
                            stationLevels={stationLevels}
                            gameEdition={gameEdition}
                            evaluationsById={craftEvaluationsById}
                            profitLoading={profitLoading}
                            profitError={profitError}
                            outputItem={selectedItem}
                            onItemClick={onItemClick}
                        />
                    </AcquisitionState>
                )}
                {selectedTab === "prices" && showPriceHistory && (
                    <ItemDetailPriceHistory itemId={selectedItemId} mode={gameMode} />
                )}
            </div>
        </section>
    );
}

function AcquisitionState({
    loading,
    error,
    empty,
    children,
}: {
    loading: boolean;
    error: string | null;
    empty: boolean;
    children: ReactNode;
}) {
    if (loading) {
        return <p className="px-4 py-6 text-sm text-muted-foreground">Loading acquisition data…</p>;
    }
    if (error) {
        return <p className="px-4 py-6 text-sm text-amber-200">{error}</p>;
    }
    if (empty) {
        return <p className="px-4 py-6 text-sm text-muted-foreground">No matching records.</p>;
    }
    return children;
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
    count?: number;
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
            {count !== undefined && (
                <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
            )}
        </button>
    );
}
