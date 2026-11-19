import { useEffect, useState } from "react";
import type { GatheringBreakpoint, GatheringFilters, SavingsRoute } from "./lib/gathering-savings-model";
import { useFundingSettings } from "./useFundingSettings";
import { DAILY_HEADROOM } from "./lib/gathering-caps";

/** Gathering breakpoints for the shown route, solved once in a worker, plus the
 * player's chosen target. A saved target that no longer exists falls back to
 * the recommended breakpoint; 0 means no gathering. */
export function useGatheringTarget(route: SavingsRoute | null) {
	const {
		startingTarCoins,
		allowSpecial,
		gatheringFilters: filters,
		gatheringTarget,
		setGatheringTarget,
		dailyHeadroom,
	} = useFundingSettings();
	const reserve = dailyHeadroom ? DAILY_HEADROOM : 0;
	const [result, setResult] = useState<{
		input: {
			route: SavingsRoute;
			startingTarCoins: number;
			allowSpecial: boolean;
			filters: GatheringFilters;
			reserve: number;
		};
		breakpoints?: GatheringBreakpoint[];
		error?: string;
	} | null>(null);
	useEffect(() => {
		if (!route) return;
		const input = { route, startingTarCoins, allowSpecial, filters, reserve };
		const worker = new Worker(new URL("./lib/gathering-savings.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<{ breakpoints?: GatheringBreakpoint[]; error?: string }>) => {
			setResult({ input, ...event.data });
			worker.terminate();
		};
		worker.onerror = () => {
			setResult({ input, error: "Could not calculate gathering savings. Try again." });
			worker.terminate();
		};
		worker.postMessage(input);
		return () => worker.terminate();
	}, [route, startingTarCoins, allowSpecial, filters, reserve]);
	const current =
		result?.input.route === route &&
		result.input.startingTarCoins === startingTarCoins &&
		result.input.allowSpecial === allowSpecial &&
		result.input.filters === filters &&
		result.input.reserve === reserve
			? result
			: null;
	// Keep the previous answer on screen while the worker recalculates.
	const shown = current ?? result;
	const breakpoints = shown?.breakpoints ?? [];
	const recommended = breakpoints.find((point) => point.savingsCents >= 499) ?? breakpoints.at(-1);
	const selected =
		gatheringTarget === 0
			? undefined
			: (breakpoints.find((point) => point.gathered === gatheringTarget) ?? recommended);
	const first = breakpoints[0];
	return {
		calculating: !shown,
		stale: !!result && !current,
		error: shown?.error,
		breakpoints,
		recommended,
		/** The chosen breakpoint, or undefined for no gathering. */
		selected,
		/** Checkout without gathering. */
		baselineCents: first ? first.cashCents + first.savingsCents : null,
		select: (gathered: number) => setGatheringTarget(gathered),
	};
}
export type GatheringTarget = ReturnType<typeof useGatheringTarget>;
