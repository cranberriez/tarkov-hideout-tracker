import type { DocumentRouteRequest } from "./document-route-model";
import type { GatheringFilters, SavingsRoute } from "./gathering-savings-model";
import { balanceOwners, preferOwners } from "./owner-preference-model";

/** Balanced owners for each route: claims leave modes with gathering off, then
 * spread so the modes finish gathering `target` together. The local search
 * replays the route many times, so it runs off the page thread. */
self.onmessage = (
	event: MessageEvent<{
		request: DocumentRouteRequest;
		routes: SavingsRoute[];
		target: number;
		filters: GatheringFilters;
		reserve: number;
	}>,
) => {
	const { request, routes, target, filters, reserve } = event.data;
	try {
		self.postMessage(
			routes.map((route) =>
				balanceOwners(
					request,
					preferOwners(request, route, (key) => (filters[key]?.disabled ? 2 : 1)),
					target,
					filters,
					reserve,
				),
			),
		);
	} catch {
		self.postMessage(null);
	}
};
