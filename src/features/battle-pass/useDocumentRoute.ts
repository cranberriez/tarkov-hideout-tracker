import { useEffect, useMemo, useState } from "react";
import {
	buildDocumentRouteModel,
	interpretDocumentRoute,
	type DocumentRouteInput,
	type RouteColumns,
} from "./lib/document-route-model";

export const CALCULATING_ROUTE = "Calculating document route…";

export function useDocumentRoute(input: DocumentRouteInput, enabled = true) {
	const request = useMemo(() => buildDocumentRouteModel(input), [input]);
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
		if (!request.model) return interpretDocumentRoute(request, {});
		if (result?.request !== request) return CALCULATING_ROUTE;
		if (!result.columns)
			return "Could not calculate a complete route. Configure costs for the destination and enough rewards on every preceding page, then try again.";
		return interpretDocumentRoute(request, result.columns);
	}, [enabled, request, result]);
}
