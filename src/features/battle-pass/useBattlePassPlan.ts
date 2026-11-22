"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSeason } from "@/lib/cfg/seasons";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";
import { rewardCostStatus, type RewardConfiguration } from "./lib/battle-pass-configuration";
import {
	buildDocumentRouteModel,
	replayClaims,
	type DocumentRouteRequest,
	type RouteColumns,
} from "./lib/document-route-model";
import { compareCurrencyBundles, optimizeRouteFunding, tarCoinFarmingSavings } from "./lib/funding-model";
import { DAILY_HEADROOM } from "./lib/gathering-caps";
import {
	applyMapFilter,
	mapExcludedTypes,
	previewGathering,
	type FewestMapsInput,
	type FewestTypesInput,
	type GatheringPreview,
} from "./lib/map-filter-model";
import {
	gatheringScenario,
	parallelDays,
	seasonDaysLeft,
	type cashFreeGatheringPlan,
	type GatheringBreakpoint,
	type GatheringFilters,
	type SavingsRoute,
} from "./lib/gathering-savings-model";
import { BALANCED_MODE, preferOwners } from "./lib/owner-preference-model";
import { applyClaims, plannedSpend, type ClaimRow } from "./lib/claim-deduction-model";
import type { Costs } from "./lib/battle-pass-model";
import { planNeeds } from "./lib/plan-needs-model";
import { purchaseFlow } from "./lib/purchase-flow-model";
import { fundingClaims, priceRoutes } from "./lib/route-options-model";
import { alternateEntries, baseEntry, routeEntryAt, type RouteEntry } from "./lib/alternate-entries-model";
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
/** How entered claim amounts change the saved plan compared with claiming its planned rewards as planned. */
export interface ClaimPreview {
	/** Documents the rest of the plan must additionally gather or buy (negative: fewer). */
	extraDocuments: number;
	/** Change in the plan's checkout. */
	cashDeltaCents: number;
	/** Claims outside the saved plan. */
	offPlan: number;
}
type CashFreePlan = ReturnType<typeof cashFreeGatheringPlan>;
interface GatheringInput {
	route: Route;
	startingTarCoins: number;
	allowSpecial: boolean;
	filters: GatheringFilters;
	reserve: number;
	/** Days left in the season: no mode gathers beyond it. */
	days: number;
}
interface GatheringResult {
	input: GatheringInput;
	breakpoints?: GatheringBreakpoint[];
	cashFree?: CashFreePlan;
	error?: string;
}

/** Shown instead of a profile for claims paid only with classified documents. */
export const ANY_PROFILE = "Any";
/** The breakpoint recommended when no gathering target is saved: the first saving $4.99 or more. */
const recommendedBreakpoint = (breakpoints: GatheringBreakpoint[]) =>
	breakpoints.find((point) => point.savingsCents >= 499) ?? breakpoints.at(-1);
const FUNDING_ERROR = "Could not calculate a purchase schedule. Change the balance or offer setting to try again.";

const subscribeToMinutes = (onChange: () => void) => {
	const timer = setInterval(onChange, 60_000);
	return () => clearInterval(timer);
};
/** Whole days left in the season, rechecked each minute; Infinity without an end date and before hydration. */
function useSeasonDaysLeft(endsAt: number | null) {
	return useSyncExternalStore(
		subscribeToMinutes,
		() => seasonDaysLeft(endsAt, Date.now()),
		() => Infinity,
	);
}

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

/** Balanced owners for `routes` (see `balanceOwners`), solved in a worker:
 * undefined while solving; the routes unchanged if the worker fails. */
function useBalancedRoutes(
	request: DocumentRouteRequest,
	routes: Route[] | null,
	target: number,
	filters: GatheringFilters,
	reserve: number,
) {
	const input = useMemo(
		() => (routes ? { request, routes, target, filters, reserve } : null),
		[request, routes, target, filters, reserve],
	);
	const [result, setResult] = useState<{ input: typeof input; routes: Route[] } | null>(null);
	useEffect(() => {
		if (!input) return;
		const worker = new Worker(new URL("./lib/owner-balance.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<Route[] | null>) => {
			setResult({ input, routes: event.data ?? input.routes });
			worker.terminate();
		};
		worker.onerror = () => {
			setResult({ input, routes: input.routes });
			worker.terminate();
		};
		// The solver model is not needed to replay claims.
		worker.postMessage({ ...input, request: { ...input.request, model: null } });
		return () => worker.terminate();
	}, [input]);
	return input && result?.input === input ? result.routes : undefined;
}

/** Fastest cash-free days for the active route and each preferred-mode route, solved in a worker. */
function useModeCashFree(
	previews: { modes: { route: Route }[] } | null,
	route: Route | null,
	startingTarCoins: number,
	filters: GatheringFilters,
	reserve: number,
) {
	const [result, setResult] = useState<{ previews: typeof previews; days: (number | null)[] } | null>(null);
	useEffect(() => {
		if (!previews || !route) return;
		const worker = new Worker(new URL("./lib/mode-preview.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<(number | null)[]>) => {
			setResult({ previews, days: event.data });
			worker.terminate();
		};
		worker.onerror = () => worker.terminate();
		worker.postMessage({
			routes: [route, ...previews.modes.map((mode) => mode.route)],
			startingTarCoins,
			filters,
			reserve,
		});
		return () => worker.terminate();
	}, [previews, route, startingTarCoins, filters, reserve]);
	return result?.previews === previews ? result.days : undefined;
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
	const daysLeft = useSeasonDaysLeft(getSeason(seasonId).endsAt);

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

	const reserve = dailyHeadroom ? DAILY_HEADROOM : 0;
	// Applied maps narrow the document types every mode may gather.
	const profileKeys = useMemo(() => input.profiles.map((profile) => profile.key), [input.profiles]);
	const mapFiltersFor = useCallback(
		(maps: string[] | null) => applyMapFilter(gatheringFilters, profileKeys, mapExcludedTypes(maps, mapNames)),
		[gatheringFilters, profileKeys, mapNames],
	);
	const filters = useMemo(() => mapFiltersFor(settings.gatheringMaps), [mapFiltersFor, settings.gatheringMaps]);

	// Preferred mode first, skipped (gathering turned off) modes last. Balanced
	// instead spreads the saved gathering target (everything gatherable without
	// one) across modes, in a worker; it runs whenever several profiles plan, so
	// the Balanced card can preview it. The same preference applies to every
	// route before it is priced.
	const preferFor = useCallback(
		(mode: string | null, candidate: Route) =>
			preferOwners(request, candidate, (key) => (key === mode ? 0 : gatheringFilters[key]?.disabled ? 2 : 1)),
		[request, gatheringFilters],
	);
	const balancing = !locked && input.profiles.length > 1;
	/** Balanced needs two or more profiles; with one, a saved Balanced preference means no preference. */
	const balanced = balancing && preferredMode === BALANCED_MODE;
	const baseRoutes = useMemo(() => (balancing && base ? [base] : null), [balancing, base]);
	const candidateRoutes = useMemo(
		() => (balancing && Array.isArray(candidates) ? candidates.map((candidate) => candidate.route) : null),
		[balancing, candidates],
	);
	const balanceTarget = gatheringTarget ?? Infinity;
	const balancedBase = useBalancedRoutes(request, baseRoutes, balanceTarget, filters, reserve)?.[0];
	const balancedCandidates = useBalancedRoutes(request, candidateRoutes, balanceTarget, filters, reserve);
	/** The fewest-documents route with preferred owners; null while Balanced is solving. */
	const preferredBase = useMemo(
		() => (!base ? null : balanced ? (balancedBase ?? null) : preferFor(preferredMode, base)),
		[base, balanced, balancedBase, preferFor, preferredMode],
	);
	const alternatives = useMemo(() => {
		if (!Array.isArray(candidates)) return null;
		if (balanced && !balancedCandidates) return null;
		return candidates.map((candidate, index) => ({
			columns: candidate.columns,
			route: balanced ? balancedCandidates![index] : preferFor(preferredMode, candidate.route),
		}));
	}, [candidates, balanced, balancedCandidates, preferFor, preferredMode]);

	// The default route is the cheapest checkout among the fewest-documents route
	// and its alternatives, each gathering the same amount: the gathering target as
	// it applies to the fewest-documents route. Its breakpoints are kept once
	// solved, so switching to an alternative cannot move the comparison.
	const [baseGathering, setBaseGathering] = useState<{ route: Route; breakpoints: GatheringBreakpoint[] } | null>(null);
	const baseBreakpoints = baseGathering && baseGathering.route === preferredBase ? baseGathering.breakpoints : null;
	// Picking an alternate entry saves that entry's own count as the target, which
	// need not be a fewest-documents breakpoint. The comparison keeps the amount it
	// had, so the suggested route cannot move because an alternate was picked.
	const [entryPick, setEntryPick] = useState<{ request: typeof request; target: number; compared: number } | null>(
		null,
	);
	const pinnedCompared =
		entryPick && entryPick.request === request && entryPick.target === gatheringTarget ? entryPick.compared : null;
	const comparedGathering =
		baseBreakpoints === null
			? null
			: (pinnedCompared ??
				(gatheringTarget === 0
					? 0
					: ((
							baseBreakpoints.find((point) => point.gathered === gatheringTarget) ??
							recommendedBreakpoint(baseBreakpoints)
						)?.gathered ?? 0)));
	// Every route priced at the compared gathering amount; the suggested route is the cheapest checkout.
	const routeOptions = useMemo(() => {
		if (!preferredBase || !alternatives?.length || comparedGathering === null) return null;
		const priced = priceRoutes(
			[preferredBase, ...alternatives.map((alternative) => alternative.route)],
			comparedGathering,
			filters,
			daysLeft,
			startingTarCoins,
			allowSpecial,
			reserve,
		);
		return priced.options.length ? priced : null;
	}, [preferredBase, alternatives, comparedGathering, filters, startingTarCoins, allowSpecial, daysLeft, reserve]);
	const cheapest = useMemo(() => {
		const suggested = routeOptions?.options.find((option) => option.routeIndex === routeOptions.suggestedIndex);
		const fewest = routeOptions?.options.find((option) => option.routeIndex === 0);
		return suggested && fewest && comparedGathering !== null
			? {
					index: suggested.routeIndex,
					gathering: comparedGathering,
					savingsCents: fewest.cashCents - suggested.cashCents,
				}
			: null;
	}, [routeOptions, comparedGathering]);

	// Target-list entries: the fewest-documents route's breakpoints (kept while an
	// alternate is active) plus the alternates that beat them. Alternates cost tens
	// of milliseconds, so they are priced in a timer after render; the previous
	// ones stay on screen meanwhile.
	const entryBaseline = baseBreakpoints?.[0] ? baseBreakpoints[0].cashCents + baseBreakpoints[0].savingsCents : null;
	const entryRoutes = useMemo(
		() =>
			preferredBase && alternatives ? [preferredBase, ...alternatives.map((alternative) => alternative.route)] : null,
		[preferredBase, alternatives],
	);
	/** TarCoins left after the pass when nothing is gathered on the fewest-documents route. */
	const noGatheringTarCoinsLeft = useMemo(() => {
		if (!preferredBase) return null;
		try {
			return optimizeRouteFunding(
				gatheringScenario(preferredBase, 0, filters, daysLeft, reserve).claims,
				startingTarCoins,
				allowSpecial,
			).balanceTarCoins;
		} catch {
			return null;
		}
	}, [preferredBase, filters, daysLeft, reserve, startingTarCoins, allowSpecial]);
	const cheapestIndex = cheapest?.index ?? null;
	const cheapestGathering = cheapest?.gathering ?? null;
	const [alternateState, setAlternateState] = useState<{ entries: RouteEntry[]; suggested?: RouteEntry }>({
		entries: [],
	});
	useEffect(() => {
		if (!baseBreakpoints || entryBaseline === null || !entryRoutes) return;
		const timer = setTimeout(() => {
			const entries = alternateEntries(
				entryRoutes,
				baseBreakpoints,
				entryBaseline,
				filters,
				daysLeft,
				reserve,
				startingTarCoins,
				allowSpecial,
			);
			// The suggested alternate is always listed, even when the show rule would hide it.
			const suggested =
				cheapestIndex !== null && cheapestIndex > 0 && cheapestGathering !== null
					? routeEntryAt(
							entryRoutes,
							cheapestIndex,
							cheapestGathering,
							baseBreakpoints,
							entryBaseline,
							filters,
							daysLeft,
							reserve,
							startingTarCoins,
							allowSpecial,
						)
					: undefined;
			if (suggested && !entries.some((e) => e.routeIndex === suggested.routeIndex && e.gathered === suggested.gathered))
				entries.push(suggested);
			setAlternateState({ entries, suggested });
		}, 0);
		return () => clearTimeout(timer);
	}, [
		baseBreakpoints,
		entryBaseline,
		entryRoutes,
		cheapestIndex,
		cheapestGathering,
		filters,
		daysLeft,
		reserve,
		startingTarCoins,
		allowSpecial,
	]);
	const [lastBase, setLastBase] = useState<RouteEntry[]>([]);
	const baseEntries = useMemo(
		() =>
			baseBreakpoints && entryBaseline !== null
				? baseBreakpoints.map((point) => baseEntry(point, entryBaseline))
				: null,
		[baseBreakpoints, entryBaseline],
	);
	if (baseEntries && baseEntries !== lastBase) setLastBase(baseEntries);
	const entries = useMemo(
		() =>
			[...(baseEntries ?? lastBase), ...alternateState.entries].sort(
				(a, b) => a.gathered - b.gathered || a.routeIndex - b.routeIndex,
			),
		[baseEntries, lastBase, alternateState.entries],
	);
	/** The default pick: the cheapest route at the compared amount; undefined for no gathering on route 0 or while comparing. */
	const suggestedEntry =
		cheapestIndex === null
			? undefined
			: cheapestIndex > 0
				? alternateState.suggested && { routeIndex: cheapestIndex, gathered: alternateState.suggested.gathered }
				: cheapestGathering
					? { routeIndex: 0, gathered: cheapestGathering }
					: undefined;

	// A route the player picks lasts until any route input changes or the page reloads.
	const [adopted, setAdopted] = useState<{ request: typeof request; columns: RouteColumns | null } | null>(null);
	const adoptedCandidate =
		adopted?.request === request && alternatives
			? adopted.columns === null
				? 0
				: alternatives.findIndex((alternative) => alternative.columns === adopted.columns) + 1 || undefined
			: undefined;
	/** Route options index of the active route: 0 is the fewest-documents route. */
	const activeCandidate = adoptedCandidate ?? cheapest?.index ?? 0;
	const adoptedIndex = activeCandidate - 1;
	/** The active route, or a message while it cannot be shown. */
	const result: Route | string = locked
		? lockedStatus?.kind === "broken"
			? lockedStatus.reason
			: (lockedRoute ?? "Could not replay the saved plan. Re-optimize to plan again.")
		: typeof solved === "string"
			? solved
			: adoptedIndex >= 0
				? alternatives![adoptedIndex].route
				: (preferredBase ?? CALCULATING_ROUTE);
	const ready = typeof result !== "string";
	const calculating = result === CALCULATING_ROUTE;
	// Keep the last route on screen during recalculation so the page does not collapse and jump.
	const [lastRoute, setLastRoute] = useState<Route | null>(null);
	if (ready && result !== lastRoute) setLastRoute(result);
	const route = ready ? result : calculating ? lastRoute : null;
	const syncing = !ready && !!route;

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
	const gatheringInput = useMemo(
		() => (route ? { route, startingTarCoins, allowSpecial, filters, reserve, days: daysLeft } : null),
		[route, startingTarCoins, allowSpecial, filters, reserve, daysLeft],
	);
	const { result: shown, current } = useGatheringWorker(gatheringInput);
	const breakpoints = useMemo(() => shown?.breakpoints ?? [], [shown]);
	const recommended = recommendedBreakpoint(breakpoints);
	// Remember the fewest-documents route's breakpoints for pricing every route.
	if (
		!locked &&
		current &&
		shown?.breakpoints &&
		shown.input.route === preferredBase &&
		baseGathering?.route !== preferredBase
	)
		setBaseGathering({ route: preferredBase, breakpoints: shown.breakpoints });
	// A saved plan gathers what is left of its target: documents acquired since
	// saving count toward it, and the largest breakpoint within the remainder
	// prices the same as gathering exactly that many.
	const lockedGathering =
		locked && lockedRoute ? Math.max(0, locked.gathering - (locked.shortfall - lockedRoute.additionalClassified)) : 0;
	// Breakpoints only gather what fits before the season ends. A target that
	// needs more days is kept as saved and gathers the most that fits (the last
	// breakpoint); the rest is bought.
	const shownInput = shown?.input;
	const wanted = locked ? lockedGathering : (gatheringTarget ?? 0);
	const wantedPoint = breakpoints.find((point) => point.gathered === wanted);
	const wantedDays = useMemo(
		() =>
			shownInput && wanted > 0
				? parallelDays(gatheringScenario(shownInput.route, wanted, shownInput.filters).quantities, shownInput.reserve)
				: 0,
		[shownInput, wanted],
	);
	const pastSeason = wanted > 0 && !wantedPoint && !!breakpoints.length && wantedDays > daysLeft;
	// A saved target that no longer exists falls back to the recommended breakpoint; 0 means no gathering.
	// On an alternate route the target is usually another route's count, and the
	// largest breakpoint within it prices the same as gathering exactly that many.
	// Without a saved target the default route keeps the amount it was compared at.
	const alternateTarget = gatheringTarget ?? comparedGathering ?? 0;
	const selected = locked
		? breakpoints.findLast((point) => point.gathered <= lockedGathering)
		: gatheringTarget === 0
			? undefined
			: (wantedPoint ??
				(pastSeason
					? breakpoints.at(-1)
					: activeCandidate > 0
						? breakpoints.findLast((point) => point.gathered <= alternateTarget)
						: recommended));
	const first = breakpoints[0];
	const adoptRoute = (columns: RouteColumns | null) => setAdopted({ request, columns });
	/** Adopt the entry's route and save its gathered count as the target together. */
	const selectEntry = (routeIndex: number, gathered: number) => {
		if (routeIndex > 0 && !alternatives?.[routeIndex - 1]) return;
		adoptRoute(routeIndex === 0 ? null : alternatives![routeIndex - 1].columns);
		setEntryPick(
			routeIndex === 0 || comparedGathering === null
				? null
				: { request, target: gathered, compared: comparedGathering },
		);
		settings.setGatheringTarget(gathered);
	};
	/** The route and gathered count the plan is on, or undefined for the fewest-documents route without gathering. */
	const activeEntry =
		selected || activeCandidate > 0 ? { routeIndex: activeCandidate, gathered: selected?.gathered ?? 0 } : undefined;
	const gathering = {
		calculating: !shown,
		stale: !!shown && !current,
		error: shown?.error,
		breakpoints,
		recommended,
		/** The chosen breakpoint, or undefined for no gathering. */
		selected,
		/** Target-list rows: the fewest-documents route's breakpoints plus the alternates that beat them, by gathered then route. */
		entries,
		/** The route and count in use: undefined is the fewest-documents route without gathering. */
		activeEntry,
		/** The entry the default pick chooses (cheapest route at the compared amount); undefined without gathering on route 0 or while comparing. */
		suggested: suggestedEntry,
		/** Adopt the entry's route and save its count as the gathering target in one update. */
		selectEntry,
		/** Checkout without gathering. */
		baselineCents: entryBaseline ?? (first ? first.cashCents + first.savingsCents : null),
		/** TarCoins left without gathering; null while unknown. */
		baselineTarCoinsLeft: noGatheringTarCoinsLeft,
		/** Fastest cash-free finish: undefined while calculating, null when none exists. */
		cashFree: shown ? (shown.cashFree ?? null) : undefined,
		select: settings.setGatheringTarget,
		/** The saved target when it needs more days than the season has left, else null. */
		pastSeason: pastSeason ? { gathered: wanted, days: wantedDays } : null,
	};
	/** Season-end limits on gathering. */
	const deadline = {
		/** Whole days left in the season; Infinity without an end date. */
		daysLeft,
		/** The fastest cash-free finish's days when it ends after the season, else null. */
		cashFreeDays: gathering.cashFree && gathering.cashFree.days > daysLeft ? gathering.cashFree.days : null,
	};

	// Step-by-step flow for the gathering target. A breakpoint carries its own
	// purchase schedule, priced on the route the worker solved.
	// Preferred-mode cards: the active route re-ranked for each mode, priced at the
	// same gathering amount, so each card shows what switching would change.
	const modePreviews = useMemo(() => {
		if (locked || !route || !base || input.profiles.length < 2) return null;
		// The active route before owner preference: the solved route or the chosen alternative.
		const raw = activeCandidate > 0 && Array.isArray(candidates) ? candidates[activeCandidate - 1]?.route : base;
		if (!raw) return null;
		const gathered = selected?.gathered ?? 0;
		const owners = new Map(route.claims.map((claim) => [claim.rewardId, claim.profileKey]));
		try {
			const price = (candidate: Route) =>
				previewGathering(candidate, gathered, filters, startingTarCoins, allowSpecial, reserve, daysLeft);
			// Balanced comes from the worker; its card waits while it solves.
			const balancedRaw = activeCandidate > 0 ? balancedCandidates?.[activeCandidate - 1] : balancedBase;
			const arranged = [
				...input.profiles.map((profile) => ({ mode: profile.key, route: preferFor(profile.key, raw) })),
				...(balancedRaw ? [{ mode: BALANCED_MODE, route: balancedRaw }] : []),
			];
			const modes = arranged.map(({ mode, route: preferred }) => {
				return {
					/** A profile key, or BALANCED_MODE. */
					profileKey: mode,
					route: preferred,
					preview: price(preferred),
					/** Claims that would change claiming profile. */
					moved: preferred.claims.filter((claim) => owners.get(claim.rewardId) !== claim.profileKey).length,
				};
			});
			return { gathered, current: price(route), modes };
		} catch {
			return null;
		}
	}, [
		locked,
		route,
		base,
		input.profiles,
		activeCandidate,
		candidates,
		selected,
		filters,
		startingTarCoins,
		allowSpecial,
		reserve,
		daysLeft,
		preferFor,
		balancedBase,
		balancedCandidates,
	]);
	const modeCashFree = useModeCashFree(modePreviews, route, startingTarCoins, filters, reserve);

	/** Classified documents the route may spend before buying any. */
	const ownedClassified = useClassified ? stored.classified : 0;
	const flow = useMemo(() => {
		if (!route || typeof funding !== "object" || !funding) return null;
		try {
			if (selected && shownInput) {
				const scenario = gatheringScenario(
					shownInput.route,
					selected.gathered,
					shownInput.filters,
					shownInput.days,
					shownInput.reserve,
				);
				return purchaseFlow(
					selected.plan,
					scenario.claims,
					shownInput.startingTarCoins,
					scenario.gatheredByClaim,
					ownedClassified,
				);
			}
			const claims = funding.claims.map((claim, index) => ({
				...claim,
				classifiedUsed: route.claims[index]?.classifiedUsed ?? 0,
			}));
			return purchaseFlow(funding.plan, claims, startingTarCoins, [], ownedClassified);
		} catch {
			return null;
		}
	}, [route, funding, selected, shownInput, startingTarCoins, ownedClassified]);
	/** What is left after the whole route at the gathering target, with the recommended purchase. */
	const leftover = useMemo(() => {
		if (!route || typeof funding !== "object" || !funding) return null;
		try {
			const scenario =
				selected && shownInput
					? gatheringScenario(
							shownInput.route,
							selected.gathered,
							shownInput.filters,
							shownInput.days,
							shownInput.reserve,
						)
					: null;
			const plan = selected && scenario ? selected.plan : funding.plan;
			const usedOwned = scenario
				? scenario.claims.reduce((sum, claim) => sum + claim.classifiedUsed, 0)
				: route.classifiedUsed;
			const ownedLeft = Math.max(0, stored.classified - usedOwned);
			return {
				/** Owned classified documents the route does not use. */
				ownedClassified: ownedLeft,
				/** Classified documents bought in packs beyond what the claims need. */
				spareClassified: plan.balanceDocuments,
				classified: ownedLeft + plan.balanceDocuments,
				/** Classified documents still to buy after owned classified and gathering. */
				classifiedToBuy: scenario
					? scenario.claims.reduce((sum, claim) => sum + claim.additionalClassified, 0)
					: route.additionalClassified,
				/** Documents gathered for the target. */
				gathered: scenario ? scenario.quantities.reduce((sum, row) => sum + row.quantity, 0) : 0,
				tarCoins: plan.balanceTarCoins,
				cashCents: plan.cashCents,
			};
		} catch {
			return null;
		}
	}, [route, funding, selected, shownInput, stored.classified]);
	/** The route the step plan describes (the worker's route while it recalculates). */
	const flowRoute = selected && shownInput ? shownInput.route : route;

	// Claims paid only with classified documents (no owned or gathered ordinary
	// documents) can be claimed on any profile.
	const anyProfileIds = useMemo(() => {
		if (!route) return new Set<string>();
		const gathering = new Set<string>();
		if (selected && shownInput) {
			const { gatheredByClaim } = gatheringScenario(
				shownInput.route,
				selected.gathered,
				shownInput.filters,
				shownInput.days,
				shownInput.reserve,
			);
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
					gatheringScenario(
						shownInput.route,
						selected.gathered,
						shownInput.filters,
						shownInput.days,
						shownInput.reserve,
					).claims,
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
					shownInput.days,
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
						days: shownInput.days,
					}
				: null,
		[shownInput, mapTarget, gatheringFilters, profileKeys, mapOrder, mapNames],
	);
	const fewestTypesInput = useMemo<FewestTypesInput | null>(
		() =>
			shownInput && mapTarget > 0
				? {
						route: shownInput.route,
						target: mapTarget,
						filters: shownInput.filters,
						profileKeys,
						startingTarCoins: shownInput.startingTarCoins,
						allowSpecial: shownInput.allowSpecial,
						reserve: shownInput.reserve,
						days: shownInput.days,
					}
				: null,
		[shownInput, mapTarget, profileKeys],
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

	// Saved-plan needs for the document inventory, including the gathering it plans.
	const documentNeeds = useMemo(() => {
		if (!locked || !route) return null;
		try {
			return selected && shownInput
				? planNeeds(
						shownInput.route,
						gatheringScenario(
							shownInput.route,
							selected.gathered,
							shownInput.filters,
							shownInput.days,
							shownInput.reserve,
						),
					)
				: planNeeds(route, null);
		} catch {
			return null;
		}
	}, [locked, route, selected, shownInput]);

	// Claiming under a saved plan: what each claim should cost and how entered amounts change the plan.
	const claimPlanning = useMemo(() => {
		if (!locked || !lockedRoute || lockedStatus?.kind !== "ok") return null;
		const scenario =
			selected && shownInput?.route === lockedRoute
				? gatheringScenario(lockedRoute, selected.gathered, shownInput.filters, shownInput.days, shownInput.reserve)
				: null;
		const inventories = Object.fromEntries(input.profiles.map((profile) => [profile.key, profile.inventory]));
		const tileOf = new Map(request.rewards.map((reward) => [reward.tile.id, reward]));
		const invalid = new Set(input.invalidRewardIds);
		const pageOrder = pages.flatMap((page) => page.cells.map((tile) => tile.id));

		const draft = (ids: string[]): ClaimRow[] => {
			const wanted = new Set(ids);
			const spend = plannedSpend(lockedRoute.claims, scenario?.gatheredByClaim ?? null);
			const planned: ClaimRow[] = lockedRoute.claims.flatMap((claim) => {
				if (!wanted.has(claim.rewardId)) return [];
				const plannedAt = locked.claims.findIndex((entry) => entry.rewardId === claim.rewardId);
				return [
					{
						rewardId: claim.rewardId,
						profileKey: claim.profileKey,
						profileLabel: claim.profileLabel,
						cost: claim.cost,
						expected: spend.get(claim.rewardId)!.documents,
						planIndex: plannedAt + 1,
					},
				];
			});
			const plannedIds = new Set(planned.map((row) => row.rewardId));
			// Rewards outside the plan claim with the selected inventory profile and what it owns now.
			const profile = inventory.selectedProfile;
			const stock: Costs = { ...(inventories[profile.key] ?? profile.inventory) };
			const offPlan: ClaimRow[] = pageOrder
				.filter((id) => wanted.has(id) && !plannedIds.has(id))
				.map((id) => {
					const reward = tileOf.get(id);
					const cost = reward && !invalid.has(id) ? reward.tile.cost : null;
					const expected: Costs = {};
					for (const [key, amount] of Object.entries(cost ?? {})) {
						expected[key] = Math.min(amount, stock[key] ?? 0);
						stock[key] = (stock[key] ?? 0) - expected[key];
					}
					return {
						rewardId: id,
						profileKey: profile.key,
						profileLabel: profile.label,
						cost,
						expected,
						planIndex: null,
					};
				});
			return [...planned, ...offPlan];
		};

		/** Remaining saved-plan shortfall and checkout after these claims. */
		const after = (rows: (ClaimRow & { have: Costs })[]) => {
			const outcome = applyClaims(rows, inventories, stored.classified);
			const ids = new Set(rows.map((row) => row.rewardId));
			const replayInput = {
				...request.input,
				profiles: request.input.profiles.map((profile) => ({
					...profile,
					inventory: { ...profile.inventory, ...outcome.inventories[profile.key] },
				})),
				classified: outcome.classified,
				completedIds: [...request.input.completedIds, ...ids],
			};
			const replayed = replayClaims(
				{ ...request, input: replayInput },
				lockedStatus.remaining
					.filter((claim) => !ids.has(claim.rewardId))
					.map((claim) => {
						const reward = tileOf.get(claim.rewardId)!;
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
			const gather = Math.max(0, locked.gathering - (locked.shortfall - replayed.additionalClassified));
			const priced = gatheringScenario(replayed, gather, filters, daysLeft, reserve);
			return {
				shortfall: replayed.additionalClassified,
				cashCents: optimizeRouteFunding(priced.claims, startingTarCoins, allowSpecial).cashCents,
			};
		};

		const preview = (rows: (ClaimRow & { have: Costs })[]): ClaimPreview | null => {
			try {
				const planned = rows.filter((row) => row.planIndex !== null).map((row) => ({ ...row, have: row.expected }));
				const base = after(planned);
				const next = after(rows);
				return {
					extraDocuments: next.shortfall - base.shortfall,
					cashDeltaCents: next.cashCents - base.cashCents,
					offPlan: rows.length - planned.length,
				};
			} catch {
				return null;
			}
		};
		return { draft, preview };
	}, [
		locked,
		lockedRoute,
		lockedStatus,
		selected,
		shownInput,
		input.profiles,
		input.invalidRewardIds,
		request,
		pages,
		inventory.selectedProfile,
		stored.classified,
		filters,
		startingTarCoins,
		allowSpecial,
		daysLeft,
		reserve,
	]);

	/** What each claim of the active route spends, including its gathering target. */
	const routeSpend = useMemo(() => {
		if (!route) return null;
		try {
			const scenario =
				selected && shownInput?.route === route
					? gatheringScenario(route, selected.gathered, shownInput.filters, shownInput.days, shownInput.reserve)
					: null;
			return plannedSpend(route.claims, scenario?.gatheredByClaim ?? null);
		} catch {
			return null;
		}
	}, [route, selected, shownInput]);

	const canSave = !locked && ready && !syncing && !!shown && current;
	// Reconfiguring that ends on the saved plan's settings and route has nothing to replace.
	const unchanged = (() => {
		const plan = saved.locked;
		if (!reconfiguring || !plan || !canSave || typeof result === "string") return false;
		const done = new Set(stored.completed);
		const remaining = plan.claims.filter((claim) => !done.has(claim.rewardId));
		return (
			selectedGoal === plan.destination &&
			buyAll === plan.buyAll &&
			allProfiles === plan.allProfiles &&
			useClassified === plan.useClassified &&
			(selected?.gathered ?? 0) === plan.gathering &&
			remaining.length === result.claims.length &&
			remaining.every(
				(claim, index) =>
					claim.rewardId === result.claims[index].rewardId && claim.profileKey === result.claims[index].profileKey,
			)
		);
	})();
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
		inventory.setPreference("planNeeds", true);
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
		/** Per-reward spend on the active route (ordinary documents and classified), or null without a route. */
		routeSpend,
		/** Claim drafting and effect preview while a saved plan replays, else null. */
		claimPlanning,
		/** The saved plan's document needs, or null without a replayable saved plan. */
		documentNeeds,
		canSave,
		/** Reconfiguring ended on exactly the saved plan: closing writes nothing. */
		unchanged,
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
		/** The player picked the active route in Route options. */
		routePicked: adoptedCandidate !== undefined,
		/** Why the default route was chosen: the cheapest checkout at a gathering amount, or null while comparing. */
		cheapest,
		/** Pick a route in Route options; null picks the fewest-documents route. */
		adoptRoute: (columns: RouteColumns | null) => setAdopted({ request, columns }),
		/** Go back to the cheapest route chosen automatically. */
		pickCheapestRoute: () => setAdopted(null),
		routeOptions,
		// Funding, gathering and the step plan
		funding,
		gathering,
		deadline,
		flow,
		flowRoute,
		leftover,
		/** What switching the preferred gathering mode would change, or null when it cannot. */
		modePreviews,
		/** Fastest cash-free days: the active route first, then each mode's route; undefined while solving. */
		modeCashFree,
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
		/** Input for the "fewest document types" search, or null without a gathering target. */
		fewestTypesInput,
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
