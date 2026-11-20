import { useEffect, useState } from "react";
import { interpretDocumentRoute, type DocumentRouteRequest, type RouteColumns } from "./lib/document-route-model";
import {
	ROUTE_OPTION_EXTRA_DOCUMENTS,
	ROUTE_OPTION_MAX_LEVELS,
	coinLevelModel,
	routeRewardTarCoins,
} from "./lib/route-options-model";

type Route = ReturnType<typeof interpretDocumentRoute>;
export interface RouteCandidate {
	columns: RouteColumns;
	route: Route;
}

/** Solves successive reward-TarCoin levels after the active route is ready.
 * Wallet and offer settings only reprice these routes, so they never re-solve. */
export function useRouteOptions(request: DocumentRouteRequest, base: Route | null, enabled: boolean) {
	const [state, setState] = useState<{ request: DocumentRouteRequest; candidates: RouteCandidate[] } | null>(null);
	useEffect(() => {
		if (!enabled || !base || !request.model) return;
		let cancelled = false;
		const worker = new Worker("/battle-pass/route.mjs", { type: "module" });
		const solve = (model: string) =>
			new Promise<RouteColumns | null>((resolve) => {
				worker.onmessage = (event: MessageEvent<RouteColumns | null>) => resolve(event.data);
				worker.onerror = () => resolve(null);
				worker.postMessage({ model });
			});
		(async () => {
			const candidates: RouteCandidate[] = [];
			try {
				let minCoins = routeRewardTarCoins(base) + 1;
				const maxMissing = base.additionalClassified + ROUTE_OPTION_EXTRA_DOCUMENTS;
				const keepIds = base.selected.map((tile) => tile.id);
				for (let level = 0; level < ROUTE_OPTION_MAX_LEVELS && !cancelled; level++) {
					const model = coinLevelModel(request, minCoins, maxMissing, keepIds);
					const columns = model ? await solve(model) : null;
					if (!columns || cancelled) break;
					const route = interpretDocumentRoute(request, columns);
					candidates.push({ columns, route });
					minCoins = routeRewardTarCoins(route) + 1;
				}
			} catch (error) {
				// Keep the candidates found so far instead of leaving the options calculating forever.
				console.error("Could not build battle pass route options", error);
			}
			if (!cancelled) setState({ request, candidates });
			worker.terminate();
		})();
		return () => {
			cancelled = true;
			worker.terminate();
		};
	}, [request, base, enabled]);
	if (!enabled || !base || !request.model) return null;
	return state?.request === request ? state.candidates : "calculating";
}
