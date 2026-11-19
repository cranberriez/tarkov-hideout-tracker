"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";
import { rewardCostStatus, type RewardConfiguration } from "./lib/battle-pass-configuration";
import { buildDocumentRouteModel, replayClaims, type RouteColumns } from "./lib/document-route-model";
import { compareCurrencyBundles, optimizeRouteFunding, tarCoinFarmingSavings } from "./lib/funding-model";
import { DAILY_HEADROOM } from "./lib/gathering-caps";
import {
	applyMapFilter,
	mapExcludedTypes,
	previewGathering,
	type FewestMapsInput,
	type GatheringPreview,
} from "./lib/map-filter-model";
import {
	gatheringScenario,
	type cashFreeGatheringPlan,
	type GatheringBreakpoint,
	type GatheringFilters,
	type SavingsRoute,
} from "./lib/gathering-savings-model";
import { preferOwners } from "./lib/owner-preference-model";
import { purchaseFlow } from "./lib/purchase-flow-model";
import { buildRouteOptions, fundingClaims } from "./lib/route-options-model";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { useDocumentInventory } from "./useDocumentInventory";
import { CALCULATING_ROUTE, useDocumentRoute } from "./useDocumentRoute";
import { useFundingSettings } from "./useFundingSettings";
import { useRouteOptions } from "./useRouteOptions";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import {
	destinationInput,
	lockedRouteStatus,
	parseSavedRoute,
	savedRouteKey,
	updateSavedRoute,
	type RouteSettings,
} from "./lib/saved-route-model";

type Route = SavingsRoute;
type CashFreePlan = ReturnType<typeof cashFreeGatheringPlan>;
interface GatheringInput {
	route: Route;
	startingTarCoins: number;
	allowSpecial: boolean;
	filters: GatheringFilters;
	reserve: number;
}
interface GatheringResult {
	input: GatheringInput;
	breakpoints?: GatheringBreakpoint[];
	cashFree?: CashFreePlan;
	error?: string;
}

/** Shown instead of a profile for claims paid only with classified documents. */
export const ANY_PROFILE = "Any";
const NONE: number[] = [];
const FUNDING_ERROR = "Could not calculate a purchase schedule. Change the balance or offer setting to try again.";

/** Breakpoints and the cash-free plan for `input`, solved once per input in a worker. */
function useGatheringWorker(input: GatheringInput | null) {
	const [result, setResult] = useState<GatheringResult | null>(null);
	useEffect(() => {
		if (!input) return;
		const worker = new Worker(new URL("./lib/gathering-savings.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<Omit<GatheringResult, "input">>) => {
			setResult({ input, ...event.data });
			worker.terminate();
		};
		worker.onerror = () => {
			setResult({ input, error: "Could not calculate gathering savings. Try again." });
			worker.terminate();
		};
		worker.postMessage(input);
		return () => worker.terminate();
	}, [input]);
	return { result, current: !!input && result?.input === input };
}

/** The single owner of the Docs breakdown planning pipeline:
 * route settings → solved route → preferred-owner route → alternatives and
 * route options → funding → gathering breakpoints and target → cash-free plan
 * → step-by-step flow. Each step runs once; panels only read the results. */
export function useBattlePassPlan(
	inventory: ReturnType<typeof useDocumentInventory>,
	configuration: RewardConfiguration,
	enabled = true,
) {
	const { pages, documentKeys, seasonId, mapNames, mapOrder } = useBattlePassData();
	const seasonalAvailable = useUserStore((state) => !!state.seasonalProfiles[seasonId]);
	const { stored } = useBattlePassSave();
	const settings = useFundingSettings();
	const { startingTarCoins, allowSpecial, preferredMode, gatheringFilters, dailyHeadroom, gatheringTarget } = settings;

	// Route settings and the saved plan, per season and shared by every profile.
	const [savedRaw, writeSaved] = useStoredProfitValue(savedRouteKey(seasonId));
	const saved = useMemo(() => parseSavedRoute(savedRaw), [savedRaw]);
	// Reconfiguring shows the editable configuration; the saved plan stays until replaced or discarded.
	const [reconfiguring, setReconfiguring] = useState(false);
	const locked = reconfiguring ? null : saved.locked;
	const { destination, buyAll, allProfiles } = locked ?? saved.settings;
	const setSetting = (change: Partial<RouteSettings>) =>
		writeSaved((current) =>
			updateSavedRoute(current, { settings: { ...parseSavedRoute(current).settings, ...change } }),
		);
	const useClassified = locked ? locked.useClassified : inventory.preferences.useClassified;
	const replaying = !!locked;
	const destinationIds = [...new Set([...stored.goals, ...(pages.at(-1)?.cells.map((tile) => tile.id) ?? [])])];
	const selectedGoal =
		destination === "owned"
			? "owned"
			: destination === "goals" && stored.goals.length
				? "goals"
				: destination !== "finish" && destinationIds.includes(destination)
					? destination
					: "finish";
	const input = useMemo(() => {
		const invalidRewardIds: string[] = [];
		const configuredPages = pages.map((page) => ({
			...page,
			cells: page.cells.map((tile) => {
				const status = rewardCostStatus(tile, configuration[tile.id], documentKeys);
				if (!status.costs) invalidRewardIds.push(tile.id);
				return {
					...tile,
					cost: status.costs ?? {},
					totalDocumentCost: Object.values(status.costs ?? {}).reduce((a, b) => a + b, 0),
				};
			}),
		}));
		return {
			pages: configuredPages,
			// A saved plan names its own owners, so switching the selected profile cannot break it.
			profiles:
				allProfiles || replaying
					? inventory.profiles.filter((profile) => profile.key !== seasonId || seasonalAvailable)
					: [inventory.selectedProfile],
			completedIds: stored.completed,
			// A saved plan replays against every page, whatever its destination.
			...destinationInput(replaying ? "finish" : selectedGoal, buyAll, stored.goals),
			classified: stored.classified,
			useClassified,
			invalidRewardIds,
		};
	}, [
		pages,
		configuration,
		documentKeys,
		allProfiles,
		inventory.profiles,
		inventory.selectedProfile,
		stored.completed,
		selectedGoal,
		buyAll,
		useClassified,
		replaying,
		stored.classified,
		stored.goals,
		seasonId,
		seasonalAvailable,
	]);
	const lastRelevantPage =
		selectedGoal === "finish" || selectedGoal === "owned"
			? pages.length - 1
			: pages.findLastIndex((page) => page.cells.some((tile) => input.goalIds.includes(tile.id)));
	const incompleteCount = pages
		.slice(0, lastRelevantPage + 1)
		.reduce(
			(count, page) =>
				count +
				page.cells.filter((tile) => !stored.completed.includes(tile.id) && input.invalidRewardIds.includes(tile.id))
					.length,
			0,
		);

	// Route request → solved route → alternative routes (HiGHS workers). Owner
	// preference and pricing never re-solve.
	const request = useMemo(() => buildDocumentRouteModel(input), [input]);
	// A saved plan replays its own claims, owners and order against current
	// progress and inventory; it never runs the solver.
	const lockedStatus = useMemo(
		() =>
			locked
				? lockedRouteStatus(
						locked,
						pages,
						input.profiles.map((profile) => profile.key),
						stored.completed,
					)
				: null,
		[locked, pages, input.profiles, stored.completed],
	);
	const lockedRoute = useMemo(() => {
		if (lockedStatus?.kind !== "ok") return null;
		try {
			return replayClaims(
				request,
				lockedStatus.remaining.map((claim) => {
					const reward = request.rewards.find((entry) => entry.tile.id === claim.rewardId)!;
					const profile = input.profiles.find((entry) => entry.key === claim.profileKey)!;
					return {
						rewardId: claim.rewardId,
						profileKey: profile.key,
						profileLabel: profile.label,
						page: reward.page,
						cost: reward.tile.cost,
					};
				}),
			);
		} catch {
			return null;
		}
	}, [lockedStatus, request, input.profiles]);
	const solving = enabled && !locked && (allProfiles || inventory.available);
	const solved = useDocumentRoute(request, solving);
	const base = typeof solved === "string" ? null : solved;
	const candidates = useRouteOptions(request, base, solving && !input.mostRewardsNow);

	// Preferred mode first, skipped (gathering turned off) modes last. The same
	// preference applies to every route before it is priced.
	const rank = useCallback(
		(key: string) => (key === preferredMode ? 0 : gatheringFilters[key]?.disabled ? 2 : 1),
		[preferredMode, gatheringFilters],
	);
	const preferredBase = useMemo(() => base && preferOwners(request, base, rank), [request, base, rank]);
	const alternatives = useMemo(
		() =>
			Array.isArray(candidates)
				? candidates.map((candidate) => ({
						columns: candidate.columns,
						route: preferOwners(request, candidate.route, rank),
					}))
				: null,
		[candidates, request, rank],
	);

	// An adopted alternative lasts until any route input changes or the page reloads.
	const [adopted, setAdopted] = useState<{ request: typeof request; columns: RouteColumns } | null>(null);
	const adoptedIndex =
		adopted?.request === request && alternatives
			? alternatives.findIndex((alternative) => alternative.columns === adopted.columns)
			: -1;
	/** The active route, or a message while it cannot be shown. */
	const result: Route | string = locked
		? lockedStatus?.kind === "broken"
			? lockedStatus.reason
			: (lockedRoute ?? "Could not replay the saved plan. Re-optimize to plan again.")
		: typeof solved === "string"
			? solved
			: adoptedIndex >= 0
				? alternatives![adoptedIndex].route
				: preferredBase!;
	const ready = typeof result !== "string";
	const calculating = result === CALCULATING_ROUTE;
	// Keep the last route on screen during recalculation so the page does not collapse and jump.
	const [lastRoute, setLastRoute] = useState<Route | null>(null);
	if (ready && result !== lastRoute) setLastRoute(result);
	const route = ready ? result : calculating ? lastRoute : null;
	const syncing = !ready && !!route;

	// Route options: every route priced with the same wallet and offer.
	const [expanded, setExpanded] = useState<{ alternatives: typeof alternatives; routes: number[] }>({
		alternatives: null,
		routes: [],
	});
	// "Show more options" resets whenever the routes are re-solved.
	const expandedRoutes = expanded.alternatives === alternatives ? expanded.routes : NONE;
	const routeOptions = useMemo(
		() =>
			preferredBase && alternatives
				? buildRouteOptions(
						[preferredBase, ...alternatives.map((alternative) => alternative.route)],
						startingTarCoins,
						allowSpecial,
						(index) => expandedRoutes.includes(index),
						adoptedIndex + 1,
					)
				: null,
		[preferredBase, alternatives, startingTarCoins, allowSpecial, expandedRoutes, adoptedIndex],
	);

	// Funding for the active route.
	const funding = useMemo(() => {
		if (!route) return null;
		try {
			const claims = fundingClaims(route);
			const plan = optimizeRouteFunding(claims, startingTarCoins, allowSpecial);
			return { claims, plan, comparison: compareCurrencyBundles(plan, allowSpecial) };
		} catch {
			return FUNDING_ERROR;
		}
	}, [route, startingTarCoins, allowSpecial]);

	// Gathering breakpoints and cash-free plan (worker). The previous answer
	// stays on screen while the worker recalculates.
	const reserve = dailyHeadroom ? DAILY_HEADROOM : 0;
	// Applied maps narrow the document types every mode may gather.
	const profileKeys = useMemo(() => input.profiles.map((profile) => profile.key), [input.profiles]);
	const mapFiltersFor = useCallback(
		(maps: string[] | null) => applyMapFilter(gatheringFilters, profileKeys, mapExcludedTypes(maps, mapNames)),
		[gatheringFilters, profileKeys, mapNames],
	);
	const filters = useMemo(() => mapFiltersFor(settings.gatheringMaps), [mapFiltersFor, settings.gatheringMaps]);
	const gatheringInput = useMemo(
		() => (route ? { route, startingTarCoins, allowSpecial, filters, reserve } : null),
		[route, startingTarCoins, allowSpecial, filters, reserve],
	);
	const { result: shown, current } = useGatheringWorker(gatheringInput);
	const breakpoints = useMemo(() => shown?.breakpoints ?? [], [shown]);
	const recommended = breakpoints.find((point) => point.savingsCents >= 499) ?? breakpoints.at(-1);
	// A saved plan gathers what is left of its target: documents acquired since
	// saving count toward it, and the largest breakpoint within the remainder
	// prices the same as gathering exactly that many.
	const lockedGathering =
		locked && lockedRoute ? Math.max(0, locked.gathering - (locked.shortfall - lockedRoute.additionalClassified)) : 0;
	// A saved target that no longer exists falls back to the recommended breakpoint; 0 means no gathering.
	const selected = locked
		? breakpoints.findLast((point) => point.gathered <= lockedGathering)
		: gatheringTarget === 0
			? undefined
			: (breakpoints.find((point) => point.gathered === gatheringTarget) ?? recommended);
	const first = breakpoints[0];
	const gathering = {
		calculating: !shown,
		stale: !!shown && !current,
		error: shown?.error,
		breakpoints,
		recommended,
		/** The chosen breakpoint, or undefined for no gathering. */
		selected,
		/** Checkout without gathering. */
		baselineCents: first ? first.cashCents + first.savingsCents : null,
		/** Fastest cash-free finish: undefined while calculating, null when none exists. */
		cashFree: shown ? (shown.cashFree ?? null) : undefined,
		select: settings.setGatheringTarget,
	};

	// Step-by-step flow for the gathering target. A breakpoint carries its own
	// purchase schedule, priced on the route the worker solved.
	const shownInput = shown?.input;
	const flow = useMemo(() => {
		if (!route || typeof funding !== "object" || !funding) return null;
		try {
			if (selected && shownInput) {
				const scenario = gatheringScenario(shownInput.route, selected.gathered, shownInput.filters);
				return purchaseFlow(selected.plan, scenario.claims, shownInput.startingTarCoins, scenario.gatheredByClaim);
			}
			return purchaseFlow(funding.plan, funding.claims, startingTarCoins);
		} catch {
			return null;
		}
	}, [route, funding, selected, shownInput, startingTarCoins]);
	/** The route the step plan describes (the worker's route while it recalculates). */
	const flowRoute = selected && shownInput ? shownInput.route : route;

	// Claims paid only with classified documents (no owned or gathered ordinary
	// documents) can be claimed on any profile.
	const anyProfileIds = useMemo(() => {
		if (!route) return new Set<string>();
		const gathering = new Set<string>();
		if (selected && shownInput) {
			const { gatheredByClaim } = gatheringScenario(shownInput.route, selected.gathered, shownInput.filters);
			shownInput.route.claims.forEach((claim, index) => {
				if (gatheredByClaim[index]?.length) gathering.add(claim.rewardId);
			});
		}
		return new Set(
			route.claims
				.filter(
					(claim) => !gathering.has(claim.rewardId) && Object.values(claim.ordinaryUsed).every((count) => count === 0),
				)
				.map((claim) => claim.rewardId),
		);
	}, [route, selected, shownInput]);
	// Small TarCoin top-ups (farmed in PVP or the seasonal mode) that lower the
	// cash paid for the chosen gathering target.
	const farming = useMemo(() => {
		try {
			if (selected && shownInput)
				return tarCoinFarmingSavings(
					gatheringScenario(shownInput.route, selected.gathered, shownInput.filters).claims,
					shownInput.startingTarCoins,
					shownInput.allowSpecial,
				);
			if (typeof funding === "object" && funding)
				return tarCoinFarmingSavings(funding.claims, startingTarCoins, allowSpecial);
		} catch {
			// No hint without a purchase schedule.
		}
		return [];
	}, [selected, shownInput, funding, startingTarCoins, allowSpecial]);
	// Map choice: price the current gathering amount with other maps, on the
	// route the breakpoints were solved for.
	const mapTarget = selected?.gathered ?? 0;
	const previewMaps = useCallback(
		(maps: string[] | null): GatheringPreview | null => {
			if (!shownInput) return null;
			try {
				return previewGathering(
					shownInput.route,
					mapTarget,
					mapFiltersFor(maps),
					shownInput.startingTarCoins,
					shownInput.allowSpecial,
					shownInput.reserve,
				);
			} catch {
				return null;
			}
		},
		[shownInput, mapTarget, mapFiltersFor],
	);
	const fewestMapsInput = useMemo<FewestMapsInput | null>(
		() =>
			shownInput
				? {
						route: shownInput.route,
						target: mapTarget,
						filters: gatheringFilters,
						profileKeys,
						maps: mapOrder,
						mapNames,
						startingTarCoins: shownInput.startingTarCoins,
						allowSpecial: shownInput.allowSpecial,
						reserve: shownInput.reserve,
					}
				: null,
		[shownInput, mapTarget, gatheringFilters, profileKeys, mapOrder, mapNames],
	);
	const mapExcluded = useMemo(
		() => mapExcludedTypes(settings.gatheringMaps, mapNames),
		[settings.gatheringMaps, mapNames],
	);
	/** The profile to show for a claim: "Any" when it uses only classified documents. */
	const claimProfileLabel = useCallback(
		(claim: { rewardId: string; profileLabel: string }) =>
			anyProfileIds.has(claim.rewardId) ? ANY_PROFILE : claim.profileLabel,
		[anyProfileIds],
	);

	const canSave = !locked && ready && !syncing && !!shown && current;
	const savePlan = () => {
		if (!canSave || typeof result === "string") return;
		const plan = {
			destination: selectedGoal,
			buyAll,
			allProfiles,
			useClassified,
			savedAt: new Date().toISOString(),
			claims: result.claims.map((claim) => ({ rewardId: claim.rewardId, profileKey: claim.profileKey })),
			gathering: selected?.gathered ?? 0,
			shortfall: result.additionalClassified,
			completedAtSave: stored.completed,
		};
		writeSaved((raw) => updateSavedRoute(raw, { locked: plan }));
		setReconfiguring(false);
	};

	return {
		settings,
		// Route settings
		selectedGoal,
		destinationIds,
		buyAll,
		allProfiles,
		setDestination: (value: string) => setSetting({ destination: value }),
		setBuyAll: (value: boolean) => setSetting({ buyAll: value }),
		setAllProfiles: (value: boolean) => setSetting({ allProfiles: value }),
		// Saved plan
		/** The saved plan being followed, or null while configuring. */
		locked,
		/** A saved plan exists, even while reconfiguring it. */
		hasSavedPlan: !!saved.locked,
		reconfiguring,
		lockedStatus,
		/** Documents still to gather under the saved plan. */
		lockedGathering,
		canSave,
		savePlan,
		/** Edit the configuration, starting from the saved plan's settings. */
		reconfigure: () => {
			if (saved.locked) {
				const { destination, buyAll, allProfiles } = saved.locked;
				setSetting({ destination, buyAll, allProfiles });
				inventory.setPreference("useClassified", saved.locked.useClassified);
				settings.setGatheringTarget(saved.locked.gathering);
			}
			setReconfiguring(true);
		},
		/** Return to the saved plan without changes. */
		cancelReconfigure: () => setReconfiguring(false),
		/** Forget the saved plan and keep configuring. */
		discardPlan: () => {
			writeSaved((raw) => updateSavedRoute(raw, { locked: null }));
			setReconfiguring(false);
		},
		incompleteCount,
		/** Profiles the route may claim with. */
		profiles: allProfiles ? inventory.availableProfiles : [inventory.selectedProfile],
		// Route
		result,
		route,
		syncing,
		calculating,
		// Route options
		/** "off" when alternatives are not compared (no route model or most rewards now). */
		optionsStatus: locked || candidates === null ? "off" : Array.isArray(candidates) ? "ready" : "calculating",
		alternatives,
		adoptedIndex,
		adoptRoute: (columns: RouteColumns | null) => setAdopted(columns ? { request, columns } : null),
		routeOptions,
		setRouteExpanded: (routeIndex: number, show: boolean) =>
			setExpanded({
				alternatives,
				routes: show ? [...expandedRoutes, routeIndex] : expandedRoutes.filter((index) => index !== routeIndex),
			}),
		expandedRoutes,
		// Funding, gathering and the step plan
		funding,
		gathering,
		flow,
		flowRoute,
		/** Reward IDs whose claim uses only classified documents. */
		anyProfileIds,
		claimProfileLabel,
		// Maps to gather on
		/** Document types no applied map spawns. */
		mapExcluded,
		/** Documents the map preview prices: the chosen gathering amount. */
		mapTarget,
		previewMaps,
		/** Input for the "fewest maps" search, or null until gathering is solved. */
		fewestMapsInput,
		/** Extra TarCoins that would lower the cash paid, smallest first (at most two). */
		farming,
	};
}

export type BattlePassPlan = ReturnType<typeof useBattlePassPlan>;
export type PlannedRoute = Route;
export type GatheringTarget = BattlePassPlan["gathering"];

export const BattlePassPlanContext = createContext<BattlePassPlan | null>(null);

export function useBattlePassPlanContext() {
	const plan = use(BattlePassPlanContext);
	if (!plan) throw new Error("useBattlePassPlanContext must be used inside BattlePassPlanContext.");
	return plan;
}
