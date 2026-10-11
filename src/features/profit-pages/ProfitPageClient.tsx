"use client";

import { craftingDuration } from "@/lib/price-calculation/crafting-skill";
import { isTrackedCraft } from "@/lib/price-calculation/craft-rules";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { DataLoadError } from "@/components/core/DataLoadError";
import { FilterDrawer } from "@/components/ui/filter-bar";
import { ActiveFilters, type ActiveFilter } from "@/components/ui/active-filters";
import { Search, Wrench, Users, Pin, TrendingUp, ListFilter, Focus } from "lucide-react";
import { createRecipeCalculator } from "@/lib/price-calculation";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ProfitPageData } from "@/types/contracts";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { Trader } from "@/types/traders";
import { BackToTopChip } from "./components/BackToTopChip";
import { ProfitPageControls } from "./components/ProfitPageControls";
import { ProfitPageHeader } from "./components/ProfitPageHeader";
import { ProfitPricingContext } from "./components/ProfitPricingContext";
import { ProfitProfileBanner } from "./components/ProfitProfileBanner";
import { ProfitTable } from "./components/ProfitTable";
import { TraderLevelsModal } from "./components/TraderLevelsModal";
import { profitRecipeHref } from "@/lib/entity-routes";
import type { ProfitPageKind, ProfitStationSource, SortDirection, SortKey } from "./types";
import { PROFIT_KINDS } from "./profit-kinds";
import { FLEA_UNLOCK_LEVEL, getProfileLockGaps } from "./utils/lock-summary";
import {
	preferLockedRecipeRoutes,
	compareEvaluationsByBaseline,
	getRecipeSourceId,
	isRecipeAvailable,
	passesLockFilters,
	topEvaluationsPerSource,
} from "./utils/recipes";
import { useManualPriceOverrides } from "./useManualPriceOverrides";
import { usePinnedCrafts } from "./usePinnedCrafts";
import { useProfitOptions } from "./useProfitOptions";
import { useStoredProfitValue } from "./useStoredProfitValue";
import { useProfileStorageScope } from "@/lib/seasons/useProfileStorageScope";
import { recipeFocusHref } from "./recipe-focus";

interface ProfitPageClientProps {
	kind: ProfitPageKind;
	data: ProfitPageData;
}

export function ProfitPageClient({ kind, data }: ProfitPageClientProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const items = data.items;
	const crafts = useMemo(() => data.crafts.filter(isTrackedCraft), [data.crafts]);
	const itemsError = data.errors.items ?? data.errors.prices;
	const itemById = useMemo(() => Object.fromEntries((items ?? []).map((item) => [item.id, item])), [items]);
	const { playerLevel, gameMode, stationLevels, completedQuests, traderLoyaltyLevels } = useUserStore(
		useShallow((state) => ({
			playerLevel: state.playerLevel,
			gameMode: state.gameMode,
			stationLevels: state.stationLevels,
			completedQuests: state.completedQuests,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
		})),
	);
	const profileScope = useProfileStorageScope(gameMode);
	const { overrides, setItemOverride } = useManualPriceOverrides(gameMode);
	const { pinnedCrafts, togglePinnedCraft } = usePinnedCrafts(gameMode);
	const [search, setSearch] = useState("");
	const [traderSourceIds, setTraderSourceIds] = useState<string[]>([]);
	const [stationSourceIds, setStationSourceIds] = useState<string[]>([]);
	const {
		craftingSkillLevel,
		hideoutManagementSkillLevel,
		craftingSkillForced,
		craftingSkillNote,
		setCraftingSkillLevel,
		setHideoutManagementSkillLevel,
		availableOnly,
		setAvailableOnly,
		lockFilters,
		setLockFilters,
		useTraderSaleForLockedOutputs,
		setUseTraderSaleForLockedOutputs,
		showTopOnly,
		topCount,
		ignorePlayerLevel,
		profitableOnly,
		setProfitableOnly,
		setShowTopOnly,
		setTopCount,
		setIgnorePlayerLevel,
		preferBestLockedRoute,
		setPreferBestLockedRoute,
		allowCrafts,
		setAllowCrafts,
		allowBarters,
		setAllowBarters,
	} = useProfitOptions(gameMode);
	const [showPinnedOnly, setShowPinnedOnly] = useState(false);
	const [traderLevelsOpen, setTraderLevelsOpen] = useState(false);
	const kindConfig = PROFIT_KINDS[kind];
	const [drawerState, setDrawerState] = useStoredProfitValue(kindConfig.drawerStorageKey);
	const [ingredientRouteSelections, setIngredientRouteSelections] = useState<Record<string, Record<number, string>>>(
		{},
	);
	const targetRecipeId = searchParams.get("recipe");
	const [scrollRequestId, setScrollRequestId] = useState(0);
	const [sortKey, setSortKey] = useState<SortKey>(kindConfig.defaultSortKey);
	const [sortDirection, setSortDirection] = useState<SortDirection>("descending");
	const pricingPlayerLevel = ignorePlayerLevel ? undefined : playerLevel;
	const calculatorInput = useMemo(
		() => ({
			craftingSkillLevel,
			hideoutManagementSkillLevel,
			playerLevel: pricingPlayerLevel,
			stationLevels,
			useTraderSaleForLockedOutputs,
			itemsById: itemById,
			barters: data.barters,
			crafts,
			allowCrafts,
			allowBarters,
			traderLoyaltyLevels,
			completedQuests,
		}),
		[
			craftingSkillLevel,
			hideoutManagementSkillLevel,
			pricingPlayerLevel,
			stationLevels,
			useTraderSaleForLockedOutputs,
			allowBarters,
			allowCrafts,
			completedQuests,
			data.barters,
			crafts,
			itemById,
			traderLoyaltyLevels,
		],
	);
	const baselineEvaluations = useMemo(
		() =>
			PROFIT_KINDS[kind]
				.evaluate(createRecipeCalculator(calculatorInput))
				.map((evaluation) => preferLockedRecipeRoutes(evaluation, preferBestLockedRoute)),
		[calculatorInput, kind, preferBestLockedRoute],
	);
	const baselineEvaluationsById = useMemo(
		() => Object.fromEntries(baselineEvaluations.map((evaluation) => [evaluation.id, evaluation])),
		[baselineEvaluations],
	);
	const evaluations = useMemo(
		() =>
			PROFIT_KINDS[kind]
				.evaluate(createRecipeCalculator({ ...calculatorInput, overrides }))
				.map((evaluation) => preferLockedRecipeRoutes(evaluation, preferBestLockedRoute)),
		[calculatorInput, kind, overrides, preferBestLockedRoute],
	);
	const tradersById = useMemo(
		() => Object.fromEntries(data.traders.map((trader) => [trader.id, trader])) as Record<string, Trader>,
		[data.traders],
	);
	const stationsById = useMemo(
		() =>
			Object.fromEntries(data.stations.map((station) => [station.id, station])) as Record<string, ProfitStationSource>,
		[data.stations],
	);
	const bartersById = useMemo(
		() => Object.fromEntries(data.barters.map((barter) => [barter.id, barter])) as Record<string, BarterRecord>,
		[data.barters],
	);
	const craftsById = useMemo(
		() =>
			Object.fromEntries(
				crafts.map((craft) => [craft.id, { ...craft, duration: craftingDuration(craft, craftingSkillLevel) }]),
			) as Record<string, CraftRecord>,
		[crafts, craftingSkillLevel],
	);
	const lockChipNames = useMemo(
		() => ({
			station: (id: string) => stationsById[id]?.name,
			trader: (id: string) => tradersById[id]?.name,
		}),
		[stationsById, tradersById],
	);
	const profileLockGaps = useMemo(
		() =>
			getProfileLockGaps(kind, { playerLevel, stationLevels, traderLoyaltyLevels }).filter(
				(gap) => !ignorePlayerLevel || gap.key !== "player",
			),
		[kind, playerLevel, stationLevels, traderLoyaltyLevels, ignorePlayerLevel],
	);
	const sources = useMemo(() => {
		const ids =
			kind === "barter" ? data.barters.map((entry) => entry.traderId) : crafts.map((entry) => entry.stationId);
		const map: Readonly<Record<string, Trader | ProfitStationSource>> = kind === "barter" ? tradersById : stationsById;
		return [...new Set(ids)]
			.map((id) => ({
				id,
				name: map[id]?.name ?? id,
				...(kind === "craft"
					? {
							imageLink: stationsById[id]?.imageLink,
							level: stationLevels[id] ?? 0,
						}
					: { imageLink: tradersById[id]?.imageLink ?? tradersById[id]?.image4xLink ?? undefined }),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [data.barters, crafts, kind, stationLevels, stationsById, tradersById]);
	const visibleEvaluations = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();
		const filtered = evaluations
			.filter((evaluation) => {
				if (PROFIT_KINDS[kind].supportsPinning && showPinnedOnly && !pinnedCrafts[evaluation.id]) return false;
				if (evaluation.id === targetRecipeId) return true;
				if (!passesLockFilters(evaluation, availableOnly, lockFilters)) return false;
				const item = itemById[evaluation.outputItemId];
				if (
					normalizedSearch &&
					!item?.name.toLowerCase().includes(normalizedSearch) &&
					!item?.shortName?.toLowerCase().includes(normalizedSearch)
				)
					return false;
				const recipeSourceId = getRecipeSourceId(evaluation);
				if (
					kind === "craft"
						? stationSourceIds.length > 0 && !stationSourceIds.includes(recipeSourceId)
						: traderSourceIds.length > 0 && !traderSourceIds.includes(recipeSourceId)
				)
					return false;
				if (profitableOnly && (evaluation.profit ?? Number.NEGATIVE_INFINITY) <= 0) return false;
				if (availableOnly && !isRecipeAvailable(evaluation, stationLevels, traderLoyaltyLevels, completedQuests))
					return false;
				return true;
			})
			.sort((a, b) => compareEvaluationsByBaseline(a, b, sortKey, sortDirection, itemById, baselineEvaluationsById));
		return showTopOnly
			? topEvaluationsPerSource(
					filtered,
					topCount,
					kindConfig.defaultSortKey,
					baselineEvaluationsById,
					itemById,
					targetRecipeId,
				)
			: filtered;
	}, [
		availableOnly,
		baselineEvaluationsById,
		kindConfig.defaultSortKey,
		lockFilters,
		completedQuests,
		evaluations,
		itemById,
		kind,
		showTopOnly,
		topCount,
		profitableOnly,
		pinnedCrafts,
		search,
		showPinnedOnly,
		sortDirection,
		sortKey,
		traderSourceIds,
		stationSourceIds,
		stationLevels,
		targetRecipeId,
		traderLoyaltyLevels,
	]);
	const recipeErrors = [data.errors.barters, data.errors.crafts].filter((message): message is string =>
		Boolean(message),
	);
	function clearRecipeFocus() {
		router.replace(recipeFocusHref(window.location.href, null), { scroll: false });
	}
	const activeFilters: ActiveFilter[] = [];
	if (search.trim())
		activeFilters.push({
			id: "search",
			label: `Search: ${search.trim()}`,
			icon: Search,
			onRemove: () => setSearch(""),
		});
	const selectedSources = kind === "craft" ? stationSourceIds : traderSourceIds;
	const setSelectedSources = kind === "craft" ? setStationSourceIds : setTraderSourceIds;
	for (const id of selectedSources)
		activeFilters.push({
			id: `source:${id}`,
			label: sources.find((source) => source.id === id)?.name ?? id,
			icon: kind === "craft" ? Wrench : Users,
			onRemove: () => setSelectedSources(selectedSources.filter((sourceId) => sourceId !== id)),
		});
	if (showPinnedOnly && kindConfig.supportsPinning)
		activeFilters.push({ id: "pinned", label: "Pinned only", icon: Pin, onRemove: () => setShowPinnedOnly(false) });
	if (availableOnly)
		activeFilters.push({ id: "available", label: "Hide locked recipes", onRemove: () => setAvailableOnly(false) });
	if (!availableOnly)
		for (const key of ["flea", "quest", "vendor", "station"] as const) {
			if (lockFilters[key])
				activeFilters.push({
					id: `lock:${key}`,
					label: {
						flea: "Hide no flea sale",
						quest: "Hide quest locked",
						vendor: "Hide vendor locked",
						station: "Hide station locked",
					}[key],
					onRemove: () => setLockFilters({ ...lockFilters, [key]: false }),
				});
		}
	if (profitableOnly)
		activeFilters.push({
			id: "profitable",
			label: "Profitable only",
			icon: TrendingUp,
			onRemove: () => setProfitableOnly(false),
		});
	if (showTopOnly)
		activeFilters.push({
			id: "top",
			label: `Top ${topCount} per ${kind === "craft" ? "station" : "trader"}`,
			icon: ListFilter,
			onRemove: () => setShowTopOnly(false),
		});
	if (targetRecipeId)
		activeFilters.push({
			id: "focus",
			label: "Recipe Focussed",
			icon: Focus,
			removeLabel: "Clear recipe focus",
			description:
				"Viewing a linked recipe bypasses search, source, availability, profit and top filters; pinned-only still applies. Remove focus to restore filtering.",
			onRemove: clearRecipeFocus,
		});
	function clearSearchAndFilters() {
		setSearch("");
		setTraderSourceIds([]);
		setStationSourceIds([]);
		setShowPinnedOnly(false);
		setAvailableOnly(false);
		setLockFilters({ flea: false, quest: false, vendor: false, station: false });
		setProfitableOnly(false);
		setShowTopOnly(false);
		if (targetRecipeId) clearRecipeFocus();
	}
	if (!items || itemsError || recipeErrors.length > 0)
		return (
			<main className="container mx-auto px-6 py-8">
				<DataLoadError
					title={`${kindConfig.label} profit data is unavailable`}
					messages={[itemsError, ...recipeErrors, !items ? "Item prices could not be loaded." : null].filter(
						(message): message is string => Boolean(message),
					)}
				/>
			</main>
		);
	function goToRecipe(method: "barter" | "craft", recipeId: string) {
		const href = profitRecipeHref(method, recipeId);
		if (method !== kind) {
			router.push(href);
			return;
		}
		router.replace(recipeFocusHref(window.location.href, recipeId), { scroll: false });
		setScrollRequestId((value) => value + 1);
	}
	return (
		<ProfitPricingContext.Provider
			value={{
				playerLevel: pricingPlayerLevel,
				stationLevels,
				hideoutManagementSkillLevel,
				traderLoyaltyLevels,
				useTraderSaleForLockedOutputs,
				taskUnlocksById: data.taskUnlocksById,
				lockChipNames,
				coveredFleaLevel:
					!availableOnly && profileLockGaps.some((gap) => gap.key === "player") ? FLEA_UNLOCK_LEVEL : undefined,
			}}
		>
			<main className="container mx-auto px-4 py-8 sm:px-6">
				<ProfitPageHeader kind={kind} />
				{data.errors.taskUnlocks && (
					<p role="status" className="mb-4 text-xs text-warning">
						Quest unlock details are partially unavailable: {data.errors.taskUnlocks}
					</p>
				)}
				<div className="mb-4">
					<ProfitPageControls
						activeFilterCount={activeFilters.length}
						key={profileScope}
						craftingSkillForced={craftingSkillForced}
						craftingSkillNote={craftingSkillNote}
						craftingSkillLevel={craftingSkillLevel}
						onCraftingSkillLevelChange={setCraftingSkillLevel}
						hideoutManagementSkillLevel={hideoutManagementSkillLevel}
						onHideoutManagementSkillLevelChange={setHideoutManagementSkillLevel}
						kind={kind}
						search={search}
						onSearchChange={setSearch}
						traderSourceIds={traderSourceIds}
						onTraderSourceIdsChange={setTraderSourceIds}
						stationSourceIds={stationSourceIds}
						onStationSourceIdsChange={setStationSourceIds}
						sources={sources}
						lockFilters={lockFilters}
						onLockFiltersChange={setLockFilters}
						useTraderSaleForLockedOutputs={useTraderSaleForLockedOutputs}
						onUseTraderSaleForLockedOutputsChange={setUseTraderSaleForLockedOutputs}
						availableOnly={availableOnly}
						onAvailableOnlyChange={setAvailableOnly}
						showTopOnly={showTopOnly}
						onShowTopOnlyChange={setShowTopOnly}
						topCount={topCount}
						onTopCountChange={setTopCount}
						ignorePlayerLevel={ignorePlayerLevel}
						onIgnorePlayerLevelChange={setIgnorePlayerLevel}
						profitableOnly={profitableOnly}
						onProfitableOnlyChange={setProfitableOnly}
						preferBestLockedRoute={preferBestLockedRoute}
						onPreferBestLockedRouteChange={setPreferBestLockedRoute}
						allowCrafts={allowCrafts}
						onAllowCraftsChange={setAllowCrafts}
						allowBarters={allowBarters}
						onAllowBartersChange={setAllowBarters}
						showPinnedOnly={showPinnedOnly}
						onShowPinnedOnlyChange={setShowPinnedOnly}
					/>
					<FilterDrawer
						label="active filters and profile details"
						open={drawerState !== "hidden"}
						onOpenChange={(open) => setDrawerState(() => (open ? "shown" : "hidden"))}
					>
						<ActiveFilters filters={activeFilters} />
						{targetRecipeId && (
							<p className="mt-1 pr-2 text-xs text-muted-foreground">
								Viewing a linked recipe; most filters are bypassed until you clear focus.
							</p>
						)}
						{!availableOnly && profileLockGaps.length > 0 && (
							<ProfitProfileBanner
								gaps={profileLockGaps}
								onHideLocked={() => setAvailableOnly(true)}
								onSetTraders={() => setTraderLevelsOpen(true)}
							/>
						)}
					</FilterDrawer>
				</div>
				<TraderLevelsModal open={traderLevelsOpen} onOpenChange={setTraderLevelsOpen} traders={data.traders} />
				<BackToTopChip />
				<ProfitTable
					onClearSearchAndFilters={activeFilters.length > 0 ? clearSearchAndFilters : undefined}
					kind={kind}
					evaluations={visibleEvaluations}
					baselineEvaluationsById={baselineEvaluationsById}
					itemById={itemById}
					tradersById={tradersById}
					stationsById={stationsById}
					bartersById={bartersById}
					craftsById={craftsById}
					overrides={overrides}
					onPriceChange={setItemOverride}
					onGoToRecipe={goToRecipe}
					targetRecipeId={targetRecipeId}
					scrollRequestId={scrollRequestId}
					pinnedCrafts={pinnedCrafts}
					onTogglePinnedCraft={togglePinnedCraft}
					showPinnedOnly={showPinnedOnly}
					ingredientRouteSelections={ingredientRouteSelections}
					sortKey={sortKey}
					sortDirection={sortDirection}
					onSortChange={(nextSortKey) => {
						if (nextSortKey === sortKey) {
							setSortDirection((current) => (current === "ascending" ? "descending" : "ascending"));
							return;
						}
						setSortKey(nextSortKey);
						setSortDirection(nextSortKey === "cost" ? "ascending" : "descending");
					}}
					onIngredientRouteChange={(recipeId, index, routeKey) =>
						setIngredientRouteSelections((current) => ({
							...current,
							[recipeId]: {
								...current[recipeId],
								[index]: routeKey,
							},
						}))
					}
				/>
			</main>
		</ProfitPricingContext.Provider>
	);
}
