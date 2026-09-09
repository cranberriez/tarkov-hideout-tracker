import type { AcquisitionPlan } from "../../../lib/price-calculation/types";
import { acquisitionRouteKey, getAcquisitionRoutes } from "../utils/recipes";

/** Nearby prices stay inline; every other source remains available in the menu. */
export function ingredientSourceOptions(plan: AcquisitionPlan) {
	const routes = getAcquisitionRoutes(plan);
	const cheapest = routes[0]?.totalCost;
	const selectedKey = acquisitionRouteKey(plan);
	const inline = routes.filter((route) => acquisitionRouteKey(route) !== selectedKey && cheapest !== undefined && route.totalCost <= cheapest * 1.1);
	return {
		routes,
		inline,
		hasMore: routes.some((route) => acquisitionRouteKey(route) !== selectedKey && !inline.includes(route)),
	};
}
