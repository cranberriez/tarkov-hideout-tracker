"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { useDataContext } from "@/app/(data)/_dataContext";
import { DataLoadError } from "@/components/core/DataLoadError";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { evaluateBarters, evaluateCrafts } from "@/lib/price-calculation";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ProfitPageData } from "@/server/services/profitPages";
import type { BarterRecord, CraftRecord, Station, Trader } from "@/types";
import { ProfitPageControls } from "./components/ProfitPageControls";
import { ProfitPageHeader } from "./components/ProfitPageHeader";
import { ProfitTable } from "./components/ProfitTable";
import type { ProfitPageKind, SortMode } from "./types";
import {
  compareEvaluations,
  getRecipeSourceId,
  indexByOutput,
  isRecipeAvailable,
} from "./utils/recipes";
import { useManualPriceOverrides } from "./useManualPriceOverrides";
import { usePinnedCrafts } from "./usePinnedCrafts";

interface ProfitPageClientProps {
  kind: ProfitPageKind;
  data: ProfitPageData;
  initialTargetRecipeId?: string;
}

export function ProfitPageClient({
  kind,
  data,
  initialTargetRecipeId,
}: ProfitPageClientProps) {
  const router = useRouter();
  const { items, itemById, itemsError, stations } = useDataContext();
  const {
    gameMode,
    stationLevels,
    completedQuests,
    traderLoyaltyLevels,
    hiddenStations,
    completedRequirements,
  } = useUserStore(
    useShallow((state) => ({
      gameMode: state.gameMode,
      stationLevels: state.stationLevels,
      completedQuests: state.completedQuests,
      traderLoyaltyLevels: state.questTraderLoyaltyLevels,
      hiddenStations: state.hiddenStations,
      completedRequirements: state.completedRequirements,
    })),
  );
  const { overrides, setItemOverride } = useManualPriceOverrides(gameMode);
  const { pinnedCrafts, togglePinnedCraft } = usePinnedCrafts(gameMode);
  const [search, setSearch] = useState("");
  const [sourceId, setSourceId] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [profitableOnly, setProfitableOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [allowCrafts, setAllowCrafts] = useState(true);
  const [allowBarters, setAllowBarters] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [targetRecipeId, setTargetRecipeId] = useState<string | null>(
    initialTargetRecipeId ?? null,
  );
  const [scrollRequestId, setScrollRequestId] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>(
    kind === "craft" ? "profitPerHour" : "profit",
  );
  const bartersByItemId = useMemo(
    () => indexByOutput(data.barters, (barter) => barter.offeredItemId),
    [data.barters],
  );
  const craftsByItemId = useMemo(
    () => indexByOutput(data.crafts, (craft) => craft.productItemId),
    [data.crafts],
  );
  const evaluations = useMemo(() => {
    const context = {
      itemsById: itemById,
      bartersByItemId,
      craftsByItemId,
      overrides,
      allowCrafts,
      allowBarters,
    };
    return kind === "barter"
      ? evaluateBarters(data.barters, context)
      : evaluateCrafts(data.crafts, context);
  }, [
    allowBarters,
    allowCrafts,
    bartersByItemId,
    craftsByItemId,
    data.barters,
    data.crafts,
    itemById,
    kind,
    overrides,
  ]);
  const tradersById = useMemo(
    () =>
      Object.fromEntries(
        data.traders.map((trader) => [trader.id, trader]),
      ) as Record<string, Trader>,
    [data.traders],
  );
  const stationsById = useMemo(
    () =>
      Object.fromEntries(
        (stations ?? []).map((station) => [station.id, station]),
      ) as Record<string, Station>,
    [stations],
  );
  const bartersById = useMemo(
    () =>
      Object.fromEntries(
        data.barters.map((barter) => [barter.id, barter]),
      ) as Record<string, BarterRecord>,
    [data.barters],
  );
  const craftsById = useMemo(
    () =>
      Object.fromEntries(
        data.crafts.map((craft) => [craft.id, craft]),
      ) as Record<string, CraftRecord>,
    [data.crafts],
  );
  const sources = useMemo(() => {
    const ids =
      kind === "barter"
        ? data.barters.map((entry) => entry.traderId)
        : data.crafts.map((entry) => entry.stationId);
    const map: Readonly<Record<string, Trader | Station>> =
      kind === "barter" ? tradersById : stationsById;
    return [...new Set(ids)]
      .map((id) => ({ id, name: map[id]?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.barters, data.crafts, kind, stationsById, tradersById]);
  const visibleEvaluations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return evaluations
      .filter((evaluation) => {
        if (kind === "craft" && showPinnedOnly && !pinnedCrafts[evaluation.id])
          return false;
        if (evaluation.id === targetRecipeId) return true;
        const item = itemById[evaluation.outputItemId];
        if (
          normalizedSearch &&
          !item?.name.toLowerCase().includes(normalizedSearch) &&
          !item?.shortName?.toLowerCase().includes(normalizedSearch)
        )
          return false;
        if (sourceId !== "all" && getRecipeSourceId(evaluation) !== sourceId)
          return false;
        if (
          profitableOnly &&
          (evaluation.profit ?? Number.NEGATIVE_INFINITY) <= 0
        )
          return false;
        if (
          availableOnly &&
          !isRecipeAvailable(
            evaluation,
            stationLevels,
            traderLoyaltyLevels,
            completedQuests,
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => compareEvaluations(a, b, sortMode, itemById));
  }, [
    availableOnly,
    completedQuests,
    evaluations,
    itemById,
    kind,
    profitableOnly,
    pinnedCrafts,
    search,
    showPinnedOnly,
    sortMode,
    sourceId,
    stationLevels,
    targetRecipeId,
    traderLoyaltyLevels,
  ]);
  const relevantError =
    kind === "barter" ? data.bartersError : data.craftsError;
  if (!items || itemsError || relevantError)
    return (
      <main className="container mx-auto px-6 py-8">
        <DataLoadError
          title={`${kind === "barter" ? "Barter" : "Craft"} profit data is unavailable`}
          messages={[
            itemsError,
            relevantError,
            !items ? "Item prices could not be loaded." : null,
          ].filter((message): message is string => Boolean(message))}
        />
      </main>
    );
  function goToRecipe(method: "barter" | "craft", recipeId: string) {
    const route =
      method === "barter" ? "/items/barter-profits" : "/items/crafting-profits";
    if (method !== kind) {
      router.push(`${route}?recipe=${encodeURIComponent(recipeId)}`);
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${route}?recipe=${encodeURIComponent(recipeId)}`,
    );
    setTargetRecipeId(recipeId);
    setScrollRequestId((value) => value + 1);
  }
  return (
    <main className="container mx-auto px-4 py-8 sm:px-6">
      <ProfitPageHeader
        kind={kind}
        gameMode={gameMode}
        evaluations={visibleEvaluations}
      />
      <ProfitPageControls
        kind={kind}
        search={search}
        onSearchChange={setSearch}
        sourceId={sourceId}
        onSourceIdChange={setSourceId}
        sources={sources}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        availableOnly={availableOnly}
        onAvailableOnlyChange={setAvailableOnly}
        profitableOnly={profitableOnly}
        onProfitableOnlyChange={setProfitableOnly}
        allowCrafts={allowCrafts}
        onAllowCraftsChange={setAllowCrafts}
        allowBarters={allowBarters}
        onAllowBartersChange={setAllowBarters}
        showPinnedOnly={showPinnedOnly}
        onShowPinnedOnlyChange={setShowPinnedOnly}
      />
      <ProfitTable
        kind={kind}
        evaluations={visibleEvaluations}
        itemById={itemById}
        tradersById={tradersById}
        stationsById={stationsById}
        bartersById={bartersById}
        craftsById={craftsById}
        stationLevels={stationLevels}
        traderLoyaltyLevels={traderLoyaltyLevels}
        completedQuests={completedQuests}
        overrides={overrides}
        onPriceChange={setItemOverride}
        onItemOpen={setSelectedItemId}
        onGoToRecipe={goToRecipe}
        targetRecipeId={targetRecipeId}
        scrollRequestId={scrollRequestId}
        pinnedCrafts={pinnedCrafts}
        onTogglePinnedCraft={togglePinnedCraft}
        showPinnedOnly={showPinnedOnly}
      />
      <ItemDetailModal
        item={selectedItemId ? (itemById[selectedItemId] ?? null) : null}
        isOpen={selectedItemId !== null}
        onClose={() => setSelectedItemId(null)}
        stations={stations}
        stationLevels={stationLevels}
        hiddenStations={hiddenStations}
        completedRequirements={completedRequirements}
      />
    </main>
  );
}
