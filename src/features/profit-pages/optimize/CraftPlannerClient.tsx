"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DataLoadError } from "@/components/core/DataLoadError";
import { ItemDetailModal } from "@/features/items/item-detail/LazyItemDetailModal";
import { useUserStore } from "@/lib/stores/useUserStore";
import { isTrackedCraft } from "@/lib/price-calculation/craft-rules";
import type { ProfitPageData } from "@/types/contracts";
import { useProfitOptions } from "../useProfitOptions";
import { useManualPriceOverrides } from "../useManualPriceOverrides";
import { CraftOptimizePanel } from "./CraftOptimizePanel";

/** Planner-only owner: no table evaluations, sorting, filters, or pin subscriptions. */
export function CraftPlannerClient({ data }: { data: ProfitPageData }) {
  const profile = useUserStore(useShallow(state => ({
    gameMode: state.gameMode, playerLevel: state.playerLevel, stationLevels: state.stationLevels,
    completedQuests: state.completedQuests, traderLoyaltyLevels: state.questTraderLoyaltyLevels,
  })));
  const { craftingSkillLevel, hideoutManagementSkillLevel, useTraderSaleForLockedOutputs } = useProfitOptions(profile.gameMode);
  const { overrides } = useManualPriceOverrides(profile.gameMode);
  const [itemId, setItemId] = useState<string | null>(null);
  const itemsById = useMemo(() => Object.fromEntries((data.items ?? []).map(item => [item.id, item])), [data.items]);
  const stations = useMemo(() => Object.fromEntries(data.stations.map(station => [station.id, station])), [data.stations]);
  const traders = useMemo(() => Object.fromEntries(data.traders.map(trader => [trader.id, trader])), [data.traders]);
  const crafts = useMemo(() => data.crafts.filter(isTrackedCraft), [data.crafts]);
  const input = useMemo(() => ({ ...profile, itemsById, crafts, barters: data.barters,
    craftingSkillLevel, hideoutManagementSkillLevel, useTraderSaleForLockedOutputs, overrides,
  }), [profile, itemsById, crafts, data.barters, craftingSkillLevel, hideoutManagementSkillLevel, useTraderSaleForLockedOutputs, overrides]);
  const errors = [data.errors.items, data.errors.prices, data.errors.crafts, data.errors.barters,
    !data.items ? "Item prices could not be loaded." : null].filter((error): error is string => Boolean(error));
  return <main className="container mx-auto px-4 py-8 sm:px-6">
    {errors.length ? <DataLoadError title="Craft planner data is unavailable" messages={errors} /> : <>
      {(data.errors.stations || data.errors.traders || data.errors.taskUnlocks || data.unresolvedItemIds.length > 0) &&
        <p role="status" className="mb-4 text-xs text-amber-300">Some item, station, trader or quest details are unavailable. Recipes with missing inputs are excluded.</p>}
      <CraftOptimizePanel key={profile.gameMode} input={input} stations={stations} traders={traders} onItemOpen={setItemId} />
      <ItemDetailModal item={itemId ? itemsById[itemId] ?? null : null} isOpen={itemId !== null} onClose={() => setItemId(null)} />
    </>}
  </main>;
}
