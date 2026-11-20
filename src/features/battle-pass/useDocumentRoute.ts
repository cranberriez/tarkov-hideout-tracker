import { useEffect, useMemo, useState } from "react";
import { interpretDocumentRoute, type DocumentRouteRequest, type RouteColumns } from "./lib/document-route-model";

export const CALCULATING_ROUTE = "Calculating document route…";
const ROUTE_ERROR =
	"Could not read the calculated route. Check your saved goals and inventory profiles, then try again.";

/** Interpreting a solved route throws on inconsistent input (for example a missing claiming profile). */
function interpretSafely(...args: Parameters<typeof interpretDocumentRoute>) {
	try {
		return interpretDocumentRoute(...args);
	} catch (error) {
		console.error("Could not interpret battle pass route", error);
		return ROUTE_ERROR;
	}
}

export function useDocumentRoute(request: DocumentRouteRequest, enabled = true) {
	const [result, setResult] = useState<{ request: typeof request; columns: RouteColumns | null } | null>(null);
	useEffect(() => {
		if (!enabled || !request.model || request.unresolvedIds.length) return;
		const worker = new Worker("/battle-pass/route.mjs", { type: "module" });
		worker.onmessage = (event: MessageEvent<RouteColumns | null>) => {
			setResult({ request, columns: event.data });
			worker.terminate();
		};
		worker.onerror = () => {
			setResult({ request, columns: null });
			worker.terminate();
		};
		worker.postMessage({ model: request.model });
		return () => worker.terminate();
	}, [request, enabled]);
	return useMemo(() => {
		if (!enabled)
			return "This seasonal character is not activated. Select an available inventory profile or include all profiles.";
		if (request.unresolvedIds.length)
			return `Unavailable saved goals: ${request.unresolvedIds.join(", ")}. Select an available destination.`;
		if (!request.model) return interpretSafely(request, {});
		if (result?.request !== request) return CALCULATING_ROUTE;
		if (!result.columns)
			return "Could not calculate a complete route. Configure costs for the destination and enough rewards on every preceding page, then try again. If costs are set, the route may have taken too long to solve; try a nearer destination or fewer gathering limits.";
		return interpretSafely(request, result.columns);
	}, [enabled, request, result]);
}
