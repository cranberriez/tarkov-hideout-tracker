"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";
import { rewardCostStatus, type RewardConfiguration } from "./lib/battle-pass-configuration";
import { buildDocumentRouteModel, type RouteColumns } from "./lib/document-route-model";
import { compareCurrencyBundles, optimizeRouteFunding } from "./lib/funding-model";
import { DAILY_HEADROOM } from "./lib/gathering-caps";
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
	const { pages, documentKeys, seasonId } = useBattlePassData();
	const seasonalAvailable = useUserStore((state) => !!state.seasonalProfiles[seasonId]);
	const { stored } = useBattlePassSave();
	const settings = useFundingSettings();
	const { startingTarCoins, allowSpecial, preferredMode, gatheringFilters, dailyHeadroom, gatheringTarget } = settings;

	// Route settings (session only).
	const [destination, setDestination] = useState("finish");
	const [buyAll, setBuyAll] = useState(false);
	const [allProfiles, setAllProfiles] = useState(true);
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
			profiles: allProfiles
				? inventory.profiles.filter((profile) => profile.key !== seasonId || seasonalAvailable)
				: [inventory.selectedProfile],
			completedIds: stored.completed,
			goalIds:
				selectedGoal === "finish" || selectedGoal === "owned"
					? []
					: selectedGoal === "goals"
						? stored.goals
						: [selectedGoal],
			finishSeason: selectedGoal === "finish",
			buyAll: selectedGoal === "owned" ? false : buyAll,
			mostRewardsNow: selectedGoal === "owned",
			classified: stored.classified,
			useClassified: inventory.preferences.useClassified,
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
		inventory.preferences.useClassified,
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
	const solving = enabled && (allProfiles || inventory.available);
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
	const result: Route | string =
		typeof solved === "string" ? solved : adoptedIndex >= 0 ? alternatives![adoptedIndex].route : preferredBase!;
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
	const gatheringInput = useMemo(
		() => (route ? { route, startingTarCoins, allowSpecial, filters: gatheringFilters, reserve } : null),
		[route, startingTarCoins, allowSpecial, gatheringFilters, reserve],
	);
	const { result: shown, current } = useGatheringWorker(gatheringInput);
	const breakpoints = useMemo(() => shown?.breakpoints ?? [], [shown]);
	const recommended = breakpoints.find((point) => point.savingsCents >= 499) ?? breakpoints.at(-1);
	// A saved target that no longer exists falls back to the recommended breakpoint; 0 means no gathering.
	const selected =
		gatheringTarget === 0
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

	return {
		settings,
		// Route settings
		selectedGoal,
		destinationIds,
		buyAll,
		allProfiles,
		setDestination,
		setBuyAll,
		setAllProfiles,
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
		optionsStatus: candidates === null ? "off" : Array.isArray(candidates) ? "ready" : "calculating",
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
