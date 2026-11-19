import { ChevronDown, Scale } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tile } from "../lib/battle-pass-model";
import { CASH_TOLERANCE_CENTS, rewardTarCoins } from "../lib/funding-model";
import { ROUTE_OPTION_CASH_WINDOW_CENTS, type RouteOption } from "../lib/route-options-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { Disclosure } from "./ui/Disclosure";
import { RouteDocumentPlans } from "./RouteDocumentPlans";
import { syncValue } from "./ui/field";
import { TarCoin } from "./ui/TarCoin";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const tileName = (tile: Tile) => {
	const coins = rewardTarCoins(tile);
	return coins > 0 ? `${tile.displayName} ×${coins}` : tile.displayName;
};
const names = (tiles: Tile[]) => tiles.map(tileName).join(" and ");

function headline(option: RouteOption) {
	const { cashDeltaCents: cash, tarCoinsLeftDelta: coins } = option;
	if (cash === 0 && coins === 0) return option.swaps.length ? "Same checkout, same TarCoins left" : "Cheapest checkout";
	const pay = cash > 0 ? `Spend ${usd(cash)} more` : cash < 0 ? `Spend ${usd(-cash)} less` : "Same checkout";
	if (coins === 0) return pay;
	return (
		<>
			{pay} and keep {Math.abs(coins).toLocaleString()} {coins > 0 ? "more" : "fewer"} <TarCoin />
		</>
	);
}

/** TarCoins left per extra dollar compared with the purchase above it on the
 * same route. Purchases within one price tier (a few cents apart) get none. */
function marginalValue(option: RouteOption, previous: RouteOption | undefined) {
	if (!previous) return null;
	const cents = option.purchase.cashCents - previous.purchase.cashCents;
	const coins = option.purchase.balanceTarCoins - previous.purchase.balanceTarCoins;
	return cents > CASH_TOLERANCE_CENTS ? Math.round(coins / (cents / 100)) : null;
}

/** Viable claim routes and TarCoin purchases that trade checkout against TarCoins left after the pass. */
export function RouteOptions() {
	const plan = useBattlePassPlanContext();
	const { alternatives: ready, adoptedIndex, adoptRoute, expandedRoutes: expanded, cheapest, routePicked } = plan;
	const toggle = plan.setRouteExpanded;
	// Routes with their details open; collapsed by default, reset when routes re-solve.
	const [open, setOpen] = useState<{ ready: typeof ready; routes: number[] }>({ ready: null, routes: [] });
	const details = open.ready === ready ? open.routes : [];
	const showDetails = (routeIndex: number, show: boolean) =>
		setOpen({ ready, routes: show ? [...details, routeIndex] : details.filter((index) => index !== routeIndex) });
	const { options, singlePacks } = plan.routeOptions ?? { options: [], singlePacks: [] };
	if (typeof plan.result === "string" || plan.optionsStatus === "off") return null;
	const activeIndex = adoptedIndex + 1;
	// One card per route; its purchases are the rows inside it.
	const routes = [...new Set(options.map((option) => option.routeIndex))].map((routeIndex) => ({
		routeIndex,
		purchases: options.filter((option) => option.routeIndex === routeIndex),
	}));
	return (
		<Disclosure
			title="Route options"
			icon={<Scale className="size-4 text-brand" aria-hidden />}
			syncing={!ready}
			meta={
				ready
					? routes.length === 1
						? "No better alternative route"
						: `${routes.length - 1} alternative ${routes.length === 2 ? "route" : "routes"}`
					: "Comparing routes…"
			}
		>
			<p className="text-xs text-muted-foreground">
				The active route is the cheapest checkout when every route gathers the same amount
				{cheapest ? ` (${cheapest.gathering} documents)` : ""}; ties gather less, then leave more TarCoins. Each route
				lists TarCoin purchases worth considering, up to {usd(ROUTE_OPTION_CASH_WINDOW_CENTS)} above its minimum,
				without gathering. Show more options adds the nearest single larger pack. Differences compare with the cheapest
				checkout for the fewest-documents route. Routes and purchases that cost more and leave fewer TarCoins are
				hidden.
			</p>
			{ready && (
				<ol className={cn("space-y-3", syncValue)}>
					{routes.map(({ routeIndex, purchases }) => {
						const active = routeIndex === activeIndex;
						const { swaps, classifiedToBuy, classifiedDelta } = purchases[0];
						return (
							<li
								key={routeIndex}
								className={cn("space-y-3 rounded-md p-3 text-sm", active ? "bg-brand/[0.08]" : "bg-surface-raised/30")}
							>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0 space-y-1">
										<p className="flex flex-wrap items-center gap-2 font-semibold">
											{routeIndex === 0 ? "Fewest documents" : "Alternative route"}
											{cheapest?.index === routeIndex && (
												<span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
													Lowest checkout
													{cheapest.savingsCents > 0 && ` · saves ${usd(cheapest.savingsCents)}`}
												</span>
											)}
										</p>
										{swaps.map((swap) => (
											<p key={swap.page} className="text-xs">
												Page {swap.page}: claim {names(swap.claim)}
												{swap.skip.length > 0 && <> instead of {names(swap.skip)}</>}
											</p>
										))}
										<p className="text-xs text-muted-foreground">
											{classifiedToBuy} classified to buy
											{classifiedDelta !== 0 && (
												<>
													{" "}
													({classifiedDelta > 0 ? "+" : ""}
													{classifiedDelta})
												</>
											)}
										</p>
									</div>
									{active ? (
										<span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand">Active</span>
									) : (
										<Button
											size="xs"
											tone="brand"
											onClick={() => adoptRoute(routeIndex === 0 ? null : ready[routeIndex - 1].columns)}
										>
											Use this route
										</Button>
									)}
								</div>
								<div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card/60 px-3 py-2 text-xs">
									<span className="flex flex-wrap items-center gap-x-1">
										<span className="text-muted-foreground">Cheapest</span>
										<strong className="tabular-nums">{usd(purchases[0].purchase.cashCents)}</strong>
										<span className="text-muted-foreground">· leaves</span>
										<strong className="tabular-nums">{purchases[0].purchase.balanceTarCoins.toLocaleString()}</strong>
										<TarCoin />
										{purchases.length > 1 && (
											<span className="text-muted-foreground">
												· up to {purchases.at(-1)!.purchase.balanceTarCoins.toLocaleString()} TC for{" "}
												{usd(purchases.at(-1)!.purchase.cashCents)}
											</span>
										)}
									</span>
									<Button
										size="xs"
										variant="ghost"
										tone="brand"
										aria-expanded={details.includes(routeIndex)}
										onClick={() => showDetails(routeIndex, !details.includes(routeIndex))}
									>
										{details.includes(routeIndex) ? "Hide details" : "Details"}
										<ChevronDown
											className={cn("size-3.5 transition-transform", details.includes(routeIndex) && "rotate-180")}
											aria-hidden
										/>
									</Button>
								</div>
								{details.includes(routeIndex) && (
									<>
										<RouteDocumentPlans purchases={purchases} />
										<h4 className="text-xs font-semibold">TarCoin purchases</h4>
										<ul className="space-y-2">
											{purchases.map((option, index) => {
												const receipt = option.purchase.cashReceipt;
												const perDollar = marginalValue(option, purchases[index - 1]);
												return (
													<li
														key={index}
														className="grid gap-x-4 gap-y-1 rounded-md bg-card/60 px-3 py-2 text-xs sm:grid-cols-[1fr_auto]"
													>
														<div className="min-w-0 space-y-0.5">
															<p className="text-sm font-medium">{headline(option)}</p>
															<p className="text-muted-foreground">
																{receipt.length
																	? receipt
																			.map(
																				(pack) =>
																					`${pack.count} × ${pack.tarCoins.toLocaleString()}${pack.special ? " (one-time offer)" : ""}`,
																			)
																			.join(" + ")
																	: "No TarCoin purchase"}
																{receipt.length > 0 && <TarCoin />}
																{option.singlePack && <span className="ml-1">· nearest single larger pack</span>}
																{active && option.purchase.recommended && (
																	<span className="ml-1 text-brand">· shown in Route funding</span>
																)}
															</p>
														</div>
														<div className="flex flex-col gap-y-1 sm:items-end">
															<dl className="flex items-start gap-x-4">
																<div className="flex items-start gap-1">
																	<dt className="text-muted-foreground">Pay</dt>
																	<dd className="font-semibold tabular-nums">{usd(option.purchase.cashCents)}</dd>
																</div>
																<div className="flex items-start gap-1">
																	<dt className="text-muted-foreground">Left</dt>
																	<dd className="flex items-center font-semibold tabular-nums">
																		{option.purchase.balanceTarCoins.toLocaleString()}
																		<TarCoin />
																	</dd>
																</div>
															</dl>
															{perDollar !== null && (
																<dl
																	className="flex items-start gap-1"
																	title="TarCoins left after the pass for each extra dollar compared with the purchase above"
																>
																	<dt className="text-muted-foreground">Extra</dt>
																	<dd className="flex items-center tabular-nums">
																		{perDollar.toLocaleString()}
																		<TarCoin />
																		per extra $1
																	</dd>
																</dl>
															)}
														</div>
													</li>
												);
											})}
										</ul>
										{singlePacks[routeIndex] && (
											<div className="flex justify-center">
												{expanded.includes(routeIndex) ? (
													<Button size="xs" variant="ghost" onClick={() => toggle(routeIndex, false)}>
														Show fewer
													</Button>
												) : (
													<Button size="xs" variant="ghost" tone="brand" onClick={() => toggle(routeIndex, true)}>
														Show more options
													</Button>
												)}
											</div>
										)}
									</>
								)}
							</li>
						);
					})}
				</ol>
			)}
			{ready && routePicked && (
				<p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
					Claim markers and funding follow the route you picked until a route setting changes or the page reloads.
					{cheapest && cheapest.index !== activeIndex && (
						<button
							type="button"
							onClick={plan.pickCheapestRoute}
							className="cursor-pointer text-brand underline-offset-2 hover:underline"
						>
							Use the cheapest route
						</button>
					)}
				</p>
			)}
		</Disclosure>
	);
}
