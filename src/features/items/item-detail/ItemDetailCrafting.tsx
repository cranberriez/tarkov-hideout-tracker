"use client";

import Link from "next/link";
import { Check, Clock3, Hammer, LockKeyhole } from "lucide-react";
import type { ItemAmount, ItemCraftRecipe } from "@/features/items/item-detail/item-detail-types";
import type { ItemSummary } from "@/types/items";
import type { GameEdition } from "@/lib/stores/useUserStore";
import { getQuestDeepLinkHref } from "@/features/quests/quest-deep-link";
import { ItemDetailItemChip } from "./ItemDetailItemChip";
import { ItemDetailRecipeFlow } from "./ItemDetailRecipeFlow";
import { ItemDetailRecipeProfit } from "./ItemDetailRecipeProfit";
import type { AcquisitionPlan, ManualPriceOverrides, RecipeEvaluation } from "@/lib/price-calculation";
import { formatCompactRoubles } from "@/lib/utils/market-price";

interface ItemDetailCraftingProps {
    recipes: ItemCraftRecipe[];
    completedQuests: Record<string, boolean>;
    stationLevels: Record<string, number>;
    gameEdition: GameEdition | null;
    evaluationsById: Readonly<Record<string, RecipeEvaluation>>;
    overrides?: ManualPriceOverrides;
    profitLoading: boolean;
    profitError: string | null;
    onRetryProfit?: () => void;
    outputItem: ItemSummary;
    onItemClick: (itemId: string) => void;
}

export function ItemDetailCrafting({
    recipes,
    completedQuests,
    stationLevels,
    gameEdition,
    evaluationsById,
    overrides = {},
    profitLoading,
    profitError,
    onRetryProfit,
    outputItem,
    onItemClick,
}: ItemDetailCraftingProps) {
    const sorted = [...recipes].sort((a, b) =>
        Number(isCraftAvailable(b, completedQuests, stationLevels, gameEdition)) -
            Number(isCraftAvailable(a, completedQuests, stationLevels, gameEdition)) ||
        a.level - b.level,
    );
    return (
        <div className="divide-y divide-border-color">
            {sorted.map((recipe) => {
                const evaluation = evaluationsById[recipe.id];
                const currentLevel = stationLevels[recipe.station.id] ?? 0;
                const stationMet = currentLevel >= recipe.level;
                const questMet = !recipe.taskUnlock || completedQuests[recipe.taskUnlock.id] === true;
                const editionMet = isEditionAllowed(recipe.gameEditions, gameEdition);
                const available = stationMet && questMet && editionMet;
                return (
                    <div key={recipe.id} className="bg-shadow/10 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex min-w-48 flex-1 items-center gap-2.5">
                                {recipe.station.imageLink ? (
                                    <img
                                        src={recipe.station.imageLink}
                                        alt=""
                                        className="h-8 w-8 rounded-md object-contain"
                                    />
                                ) : (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-highlight/5">
                                        <Hammer size={14} />
                                    </span>
                                )}
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">
                                            {recipe.station.name} level {recipe.level}
                                        </span>
                                        <AvailabilityBadge available={available} />
                                        {!available && (
                                            <LockedReasons
                                                recipe={recipe}
                                                stationMet={stationMet}
                                                questMet={questMet}
                                                editionMet={editionMet}
                                                currentLevel={currentLevel}
                                            />
                                        )}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Clock3 size={10} /> {formatDuration(recipe.duration)}
                                    </div>
                                </div>
                            </div>
                            <ItemDetailRecipeProfit
                                evaluation={evaluation}
                                recipeId={recipe.id}
                                kind="craft"
                                loading={profitLoading}
                                error={profitError}
                                onRetry={onRetryProfit}
                            />
                        </div>

                        <ItemDetailRecipeFlow
                            outputItem={outputItem}
                            outputCount={recipe.productCount}
                        >
                            {recipe.requiredItems.map((entry, index) => (
                                <Ingredient
                                    key={`${entry.item.id}-${index}`}
                                    entry={entry}
                                    manualBuy={overrides[entry.item.id]?.buy}
                                    plan={evaluation?.requiredItems.find(
                                        (candidate) => candidate.itemId === entry.item.id,
                                    )}
                                    onItemClick={onItemClick}
                                />
                            ))}
                            {recipe.requiredQuestItems.map((entry, index) => (
                                <Ingredient
                                    key={`quest-${entry.item.id}-${index}`}
                                    entry={entry}
                                    questItem
                                    onItemClick={onItemClick}
                                />
                            ))}
                        </ItemDetailRecipeFlow>
                    </div>
                );
            })}
        </div>
    );
}

function isCraftAvailable(
    recipe: ItemCraftRecipe,
    completedQuests: Record<string, boolean>,
    stationLevels: Record<string, number>,
    gameEdition: GameEdition | null,
) {
    return (
        (stationLevels[recipe.station.id] ?? 0) >= recipe.level &&
        (!recipe.taskUnlock || completedQuests[recipe.taskUnlock.id] === true) &&
        isEditionAllowed(recipe.gameEditions, gameEdition)
    );
}

function isEditionAllowed(required: string[], edition: GameEdition | null) {
    if (required.length === 0) return true;
    if (!edition) return false;
    const editionKeys: Record<GameEdition, string[]> = {
        Standard: ["standard"],
        "Left Behind": ["left_behind"],
        "Prepare for Escape": ["prepare_for_escape"],
        "Edge of Darkness": ["edge_of_darkness"],
        Unheard: ["eod_tue_edition", "the_unheard_edition", "unheard"],
    };
    return editionKeys[edition].some((key) => required.includes(key));
}

function formatEdition(value: string) {
    return value
        .replace("eod_tue_edition", "Unheard")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${Math.max(minutes, 1)}m`;
}

function Ingredient({
    entry,
    manualBuy,
    plan,
    questItem = false,
    onItemClick,
}: {
    entry: ItemAmount;
    manualBuy?: number;
    plan?: AcquisitionPlan;
    questItem?: boolean;
    onItemClick: (itemId: string) => void;
}) {
    return (
        <ItemDetailItemChip
            item={entry.item}
            onClick={questItem ? undefined : () => onItemClick(entry.item.id)}
            quantityLabel={`${entry.count}`}
            quantityOverlay
            secondary={
                entry.isTool ? <ToolBadge /> : plan ? (
                    <RecommendationBadge
                        plan={plan}
                        unstable={
                            entry.item.marketPrice?.fleaStability === "unstable" &&
                            entry.item.normalizedName !== "roubles" &&
                            !(typeof manualBuy === "number" && Number.isFinite(manualBuy) && manualBuy >= 0)
                        }
                    />
                ) : undefined
            }
            badges={
                <>
                    {questItem && (
                        <span className="text-[9px] uppercase text-special">quest item</span>
                    )}
                </>
            }
        />
    );
}

function ToolBadge() {
    return (
        <span className="shrink-0 rounded bg-info/10 px-1 py-0.5 text-[9px] font-bold uppercase text-info">
            Tool
        </span>
    );
}

function RecommendationBadge({ plan, unstable }: { plan: AcquisitionPlan; unstable: boolean }) {
    const label =
        plan.method === "flea"
            ? "Buy"
            : plan.method === "sell"
              ? "Found"
            : plan.method === "trader"
              ? "Trader"
            : plan.method === "craft"
              ? "Craft"
              : plan.method === "barter"
                ? "Barter"
                : "Unpriced";
    const classes =
        plan.method === "craft"
            ? "bg-acquisition-craft/10 text-acquisition-craft"
            : plan.method === "trader"
              ? "bg-acquisition-trader/10 text-acquisition-trader"
            : plan.method === "barter"
              ? "bg-acquisition-barter/10 text-acquisition-barter"
            : plan.method === "flea"
                ? "bg-acquisition-flea/10 text-acquisition-flea"
                : plan.method === "sell"
                  ? "bg-acquisition-sell-value/10 text-acquisition-sell-value"
                : "bg-highlight/5 text-muted-foreground";
    return (
        <span className="flex flex-wrap items-center gap-1.5">
            <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${classes}`}>
                {label}
            </span>
            {unstable && plan.method === "flea" && plan.totalCost !== null && (
                <span className="text-[10px] font-normal text-warning">(value unstable)</span>
            )}
            {plan.method === "sell" && plan.totalCost !== null && (
                <span className="text-[10px] font-normal text-muted-foreground">(sell value)</span>
            )}
            {plan.totalCost !== null && (
                <span className="flex shrink-0 items-baseline gap-1 leading-none">
                    <span className="font-mono text-[10px] font-semibold text-foreground/80">
                        {formatCompactRoubles(Math.round(plan.totalCost))} ₽
                    </span>
                    <span className="text-[7px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Total
                    </span>
                </span>
            )}
        </span>
    );
}

function AvailabilityBadge({ available }: { available: boolean }) {
    return (
        <span
            className={available ? "text-success" : "text-danger"}
            title={available ? "Available" : "Locked"}
            aria-label={available ? "Available" : "Locked"}
        >
            {available ? <Check size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
        </span>
    );
}

function LockedReasons({
    recipe,
    stationMet,
    questMet,
    editionMet,
    currentLevel,
}: {
    recipe: ItemCraftRecipe;
    stationMet: boolean;
    questMet: boolean;
    editionMet: boolean;
    currentLevel: number;
}) {
    return (
        <span className="flex flex-wrap items-center gap-x-1 text-[10px] text-warning">
            {!stationMet && (
                <>
                    <span>
                        Current level {currentLevel}
                    </span>
                    {(!questMet || !editionMet) && (
                        <span className="text-muted-foreground">·</span>
                    )}
                </>
            )}
            {!questMet && recipe.taskUnlock && (
                <>
                    <span>
                        Needs{" "}
                        <Link
                            href={getQuestDeepLinkHref(recipe.taskUnlock.id)}
                            className="underline decoration-warning/30 underline-offset-2 hover:text-foreground"
                        >
                            {recipe.taskUnlock.name}
                        </Link>
                    </span>
                    {!editionMet && <span className="text-muted-foreground">·</span>}
                </>
            )}
            {!editionMet && (
                <>
                    <span>Needs {recipe.gameEditions.map(formatEdition).join(" or ")}</span>
                </>
            )}
        </span>
    );
}
