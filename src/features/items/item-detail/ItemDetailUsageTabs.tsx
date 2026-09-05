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
import {
    getCachedPriceHistoryAvailability,
    ItemDetailPriceHistory,
} from "./ItemDetailPriceHistory";
import type { ItemCraftRecipe, ItemTraderOffer } from "@/features/items/item-detail/item-detail-types";
import type { ItemSummary } from "@/types/items";
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
    itemDetailsById: Record<string, ItemSummary>;
    traderOffers: ItemTraderOffer[];
    crafts: ItemCraftRecipe[];
    relationsLoading: boolean;
    relationsError: string | null;
    acquisitionLoading: boolean;
    barterError: string | null;
    craftError: string | null;
    acquisitionWarning: string | null;
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
    relationsLoading,
    relationsError,
    acquisitionLoading,
    barterError,
    craftError,
    acquisitionWarning,
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
    const [activeTab, setActiveTab] = useState<UsageTab>("hideout");
    const [hasLoadedPriceHistory, setHasLoadedPriceHistory] = useState<boolean | null>(() =>
        getCachedPriceHistoryAvailability(selectedItemId, gameMode),
    );
    const hideoutEnabled = hideoutCount > 0 || relationsLoading || relationsError !== null;
    const questsEnabled = questCount > 0 || relationsLoading || relationsError !== null;
    const tradersEnabled = traderOffers.length > 0 || acquisitionLoading || barterError !== null;
    const craftingEnabled = crafts.length > 0 || acquisitionLoading || craftError !== null;
    const historyEnabled = showPriceHistory && hasLoadedPriceHistory !== false;
    const enabledTabs: UsageTab[] = [
        ...(hideoutEnabled ? (["hideout"] as const) : []),
        ...(questsEnabled ? (["quests"] as const) : []),
        ...(tradersEnabled ? (["traders"] as const) : []),
        ...(craftingEnabled ? (["crafting"] as const) : []),
        ...(historyEnabled ? (["prices"] as const) : []),
    ];
    const selectedTab = enabledTabs.includes(activeTab) ? activeTab : enabledTabs[0];
    const selectedItem = itemDetailsById[selectedItemId] ?? {
        id: selectedItemId,
        name: "Selected item",
        normalizedName: selectedItemId,
        iconLink: selectedItemImageLink,
    };

    return (
        <section className={`flex min-h-0 min-w-0 flex-col bg-card/45 ${className}`}>
            <div className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-border-color" role="tablist">
                <TabButton
                    active={selectedTab === "hideout"}
                    disabled={!hideoutEnabled}
                    onClick={() => setActiveTab("hideout")}
                    label="Hideout"
                    count={relationsLoading ? undefined : hideoutCount}
                    icon={<Hammer size={13} />}
                />
                <TabButton
                    active={selectedTab === "quests"}
                    disabled={!questsEnabled}
                    onClick={() => setActiveTab("quests")}
                    label="Quests"
                    count={relationsLoading ? undefined : questCount}
                    icon={<ClipboardList size={13} />}
                />
                <TabButton
                    active={selectedTab === "traders"}
                    disabled={!tradersEnabled}
                    onClick={() => setActiveTab("traders")}
                    label="Traders"
                    count={acquisitionLoading ? undefined : traderOffers.length}
                    icon={<ShoppingCart size={13} />}
                />
                <TabButton
                    active={selectedTab === "crafting"}
                    disabled={!craftingEnabled}
                    onClick={() => setActiveTab("crafting")}
                    label="Crafting"
                    count={acquisitionLoading ? undefined : crafts.length}
                    icon={<Wrench size={13} />}
                />
                <TabButton
                    active={selectedTab === "prices"}
                    disabled={!historyEnabled}
                    onClick={() => setActiveTab("prices")}
                    label="History"
                    icon={<ChartNoAxesCombined size={13} />}
                />
            </div>

            <div role="tabpanel" className="flex min-h-0 max-h-[700px] flex-1 flex-col overflow-y-auto">
                {selectedTab === "hideout" && (
                    <>
                        {(relationsLoading || relationsError) && (
                            <RelationState
                                loading={relationsLoading}
                                error={relationsError}
                                loadingMessage="Loading hideout data…"
                            />
                        )}
                        {hideoutCount > 0 && (
                            <ItemDetailHideoutRequirements
                                selectedItemImageLink={selectedItemImageLink}
                                stationRequirements={stationRequirements}
                                stationLevels={stationLevels}
                                hiddenStations={hiddenStations}
                            />
                        )}
                    </>
                )}
                {selectedTab === "quests" && (
                    <>
                        {(relationsLoading || relationsError) && (
                            <RelationState
                                loading={relationsLoading}
                                error={relationsError}
                                loadingMessage="Loading quest data…"
                            />
                        )}
                        {questCount > 0 && (
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
                    </>
                )}
                {selectedTab === "traders" && (
                    <AcquisitionState
                        loading={acquisitionLoading}
                        error={barterError}
                        warning={acquisitionWarning}
                        empty={traderOffers.length === 0}
                    >
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
                    <AcquisitionState
                        loading={acquisitionLoading}
                        error={craftError}
                        warning={acquisitionWarning}
                        empty={crafts.length === 0}
                    >
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
                {selectedTab === "prices" && historyEnabled && (
                    <ItemDetailPriceHistory
                        itemId={selectedItemId}
                        mode={gameMode}
                        onAvailabilityChange={setHasLoadedPriceHistory}
                    />
                )}
            </div>
        </section>
    );
}

function AcquisitionState({
    loading,
    error,
    warning,
    empty,
    children,
}: {
    loading: boolean;
    error: string | null;
    warning: string | null;
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
        return (
            <div>
                {warning && <p className="px-4 pt-4 text-sm text-amber-200">{warning}</p>}
                <p className="px-4 py-6 text-sm text-muted-foreground">No matching records.</p>
            </div>
        );
    }
    return (
        <div>
            {warning && (
                <p className="border-b border-border-color px-4 py-2 text-xs text-amber-200">
                    {warning}
                </p>
            )}
            {children}
        </div>
    );
}

function RelationState({
    loading,
    error,
    loadingMessage,
}: {
    loading: boolean;
    error: string | null;
    loadingMessage: string;
}) {
    return (
        <p
            className={`border-b border-border-color px-4 py-2 text-xs ${
                error ? "text-amber-200" : "text-muted-foreground"
            }`}
        >
            {error ?? (loading ? loadingMessage : null)}
        </p>
    );
}

function TabButton({
    active,
    disabled = false,
    onClick,
    label,
    count,
    icon,
}: {
    active: boolean;
    disabled?: boolean;
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
            disabled={disabled}
            onClick={onClick}
            className={`relative flex min-w-28 items-center justify-center gap-2 border-r border-border-color px-4 text-xs transition-colors ${
                active
                    ? "bg-white/[0.04] text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-tarkov-green"
                    : disabled
                      ? "cursor-not-allowed text-muted-foreground/35"
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
