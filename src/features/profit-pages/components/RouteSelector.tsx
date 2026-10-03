"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AcquisitionPlan } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { RouteContext } from "../types";
import { acquisitionRouteKey, getAcquisitionRoutes, hasCheaperLockedRoute } from "../utils/recipes";
import { AcquisitionRouteOption, routeLabels } from "./AcquisitionRouteOption";
import { RouteIcon } from "./RouteIcon";

export function RouteSelector({
	plan,
	item,
	routeContext,
	onSelect,
	onOpen,
	changedFromBase = false,
	bestRouteKey,
}: {
	plan: AcquisitionPlan;
	item?: ItemSummary;
	routeContext: RouteContext;
	onSelect: (routeKey: string) => void;
	onOpen?: () => void;
	changedFromBase?: boolean;
	bestRouteKey?: string;
}) {
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const descriptionId = useId();
	const routes = getAcquisitionRoutes(plan);
	const alternativeCount = plan.alternatives.length;
	const lockedCount = plan.lockedAlternatives?.length ?? 0;
	const automaticFallback = !changedFromBase && hasCheaperLockedRoute(plan);
	const recommendedRouteKey = bestRouteKey ?? acquisitionRouteKey(plan);
	const routeDescription = [
		plan.method === "unavailable"
			? "No available route"
			: `${routeLabels[plan.method]} · ${changedFromBase ? "selected manually" : "recommended"}`,
		alternativeCount > 0
			? `${alternativeCount} alternative${alternativeCount === 1 ? "" : "s"} available`
			: "No other available routes",
		...(lockedCount > 0 ? [`${lockedCount} locked source${lockedCount === 1 ? "" : "s"}`] : []),
		...(automaticFallback ? ["Using this route because a cheaper source is locked"] : []),
		"Open to compare sources",
	].join(". ");

	useEffect(() => {
		if (!position) return;
		const close = (event: MouseEvent) => {
			if (!(event.target as HTMLElement).closest("[data-route-selector]")) setPosition(null);
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setPosition(null);
		};
		const scroll = (event: Event) => {
			if (event.target instanceof Element && event.target.closest("[data-route-selector]")) return;
			setPosition(null);
		};
		const resize = () => setPosition(null);
		window.addEventListener("mousedown", close);
		window.addEventListener("keydown", escape);
		window.addEventListener("scroll", scroll, true);
		window.addEventListener("resize", resize);
		return () => {
			window.removeEventListener("mousedown", close);
			window.removeEventListener("keydown", escape);
			window.removeEventListener("scroll", scroll, true);
			window.removeEventListener("resize", resize);
		};
	}, [position]);

	return (
		<>
			<span id={descriptionId} className="sr-only">
				{routeDescription}
			</span>
			<button
				ref={buttonRef}
				type="button"
				data-route-selector
				data-isolated-hover="true"
				aria-expanded={position !== null}
				aria-label={`Choose acquisition route for ${item?.name ?? "item"}`}
				title={routeDescription}
				aria-describedby={descriptionId}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					if (position) return setPosition(null);
					const rect = buttonRef.current?.getBoundingClientRect();
					if (!rect) return;
					onOpen?.();
					setPosition({
						left: Math.min(rect.right + 6, window.innerWidth - 330),
						top: Math.max(
							8,
							Math.min(
								rect.top,
								window.innerHeight -
									Math.max(160, routes.length * 42 + (plan.lockedAlternatives ?? []).length * 84) -
									16,
							),
						),
					});
				}}
				className="relative z-10 h-full w-8 shrink-0 self-stretch outline-none ring-inset ring-highlight/30 hover:brightness-110 hover:ring-1 focus:ring-1 focus:ring-brand"
			>
				<RouteIcon
					method={plan.method}
					rowRail
					switchable
					changedFromBase={changedFromBase}
					automaticFallback={automaticFallback}
					title={routeDescription}
				/>
			</button>
			{position &&
				createPortal(
					<>
						<button
							type="button"
							data-isolated-hover="true"
							aria-label="Close acquisition route picker"
							className="fixed inset-0 z-[129] cursor-default bg-transparent"
							onMouseDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
								setPosition(null);
							}}
						/>
						<span
							data-route-selector
							data-isolated-hover="true"
							className="fixed z-130 space-y-1 block w-[320px] overflow-y-auto overscroll-contain rounded-md border border-highlight/15 bg-[var(--background)] p-1 shadow-[0_18px_55px_color-mix(in_oklab,_var(--shadow)_80%,_transparent)]"
							style={{
								left: Math.max(8, position.left),
								top: position.top,
								maxHeight: `calc(100dvh - ${position.top + 8}px)`,
							}}
						>
							{[...routes, ...(plan.lockedAlternatives ?? [])].map((route, index) => {
								const locked = "lockReasons" in route;
								const key = acquisitionRouteKey(route);
								return (
									<AcquisitionRouteOption
										key={`${key}:${index}`}
										route={route}
										unitPrice={
											locked
												? (route.estimatedUnitPrice ?? null)
												: plan.quantity > 0
													? route.totalCost / plan.quantity
													: null
										}
										priceTitle={
											locked && route.estimatedUnitPrice !== undefined
												? "Estimated unit price; route is locked"
												: undefined
										}
										item={item}
										routeContext={routeContext}
										selected={key === acquisitionRouteKey(plan)}
										best={key === recommendedRouteKey}
										onSelect={() => {
											onSelect(key);
											setPosition(null);
										}}
									/>
								);
							})}
						</span>
					</>,
					document.body,
				)}
		</>
	);
}
