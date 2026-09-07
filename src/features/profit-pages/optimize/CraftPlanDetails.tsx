"use client";

import { ArrowUpRight, ShoppingBasket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ItemSummary } from "@/types/items";
import type { ProfitStationSource } from "../types";
import { formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { craftWindowProfitHour, placeCraftPlan, type CraftBooking, type CraftPlan } from "./craft-plans";
import { CraftImage } from "./CraftImage";
import { CraftAcquisitionChain } from "./CraftAcquisitionChain";
import { CraftSalePrice } from "./CraftSalePrice";

export function CraftPlanDetails({
	plan,
	items,
	stations,
	traders,
	slots,
	bookings,
	target,
	cadence,
	continuousRate,
	onClose,
	onItemOpen,
}: {
	plan: CraftPlan | null;
	items: Readonly<Record<string, ItemSummary>>;
	stations: Record<string, ProfitStationSource>;
	traders: Record<string, { name: string }>;
	slots: number;
	bookings: CraftBooking[];
	target: number;
	cadence: number;
	continuousRate?: number;
	onClose: () => void;
	onItemOpen: (id: string) => void;
}) {
	const scheduled = bookings.filter((booking) => booking.planId === plan?.id);
	const steps = plan ? (scheduled.length ? scheduled : (placeCraftPlan(plan, [], slots) ?? [])).sort((a, b) => a.start - b.start) : [];
	const finish = Math.max(0, ...steps.map((step) => step.finish));
	return (
		<Dialog
			open={!!plan}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-h-[85dvh] overflow-y-auto p-5 sm:max-w-5xl sm:p-6">
				{plan && (
					<>
						<div className="mb-5 flex items-center gap-4 pr-6">
							<CraftImage item={items[plan.itemId]} size={76} className="rounded-lg bg-black/20 p-2" />
							<div>
								<DialogTitle className="leading-snug">{plan.name}</DialogTitle>
								<DialogDescription className="mt-2">
									{plan.steps.length} {plan.steps.length === 1 ? "craft" : "linked crafts"} · ready in {formatDuration(finish)}
								</DialogDescription>
								<button
									type="button"
									onClick={() => {
										onClose();
										onItemOpen(plan.itemId);
									}}
									className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
								>
									Item details
									<ArrowUpRight size={12} aria-hidden="true" />
								</button>
							</div>
						</div>
						<div className="mb-4">
							<CraftSalePrice plan={plan} />
						</div>
						<div className="mb-5 flex flex-wrap gap-6 text-sm">
							<span>
								Sales <span className="ml-1 font-mono">{formatRoundedRoubles(plan.cost + plan.profit)}</span>
								<span className="mt-1 block text-xs text-muted-foreground">
									{plan.sellSourceLabel ?? "Estimated sale"} · ×{formatQuantity(plan.count)}
								</span>
							</span>
							<span>
								− Inputs <span className="ml-1 font-mono">{formatRoundedRoubles(plan.cost)}</span>
							</span>
							<span>
								= Profit <strong className="ml-1 font-mono text-tarkov-green">+{formatRoundedRoubles(plan.profit)}</strong>
							</span>
						</div>
						<p className="mb-4 text-xs text-muted-foreground">
							{continuousRate !== undefined ? (
								<>
									<span className="font-mono text-foreground">{formatRoundedRoubles(continuousRate)}/h</span> averaged over 24 hours, including shared-station
									waits. Sales and inputs above are per batch.
								</>
							) : (
								<>
									<span className="font-mono text-foreground">
										{formatRoundedRoubles(craftWindowProfitHour(plan.profit, finish, scheduled.length ? cadence : target))}/h
									</span>{" "}
									over {formatDuration(Math.max(finish, scheduled.length ? cadence : target))}, including wait
									{scheduled.length ? " for your next run" : " before restarting"}.
								</>
							)}{" "}
							Before fuel and flea fees.
						</p>
						<div className="grid items-start gap-8 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
							<CraftAcquisitionChain plan={plan} items={items} stations={stations} traders={traders} />
							<section aria-label="Shopping list" className="md:sticky md:top-0">
								<h3 className="text-sm">
									<ShoppingBasket size={14} className="mr-2 inline" aria-hidden="true" />
									Buy inputs{" "}
									<span className="text-muted-foreground">
										· {plan.shopping.length} {plan.shopping.length === 1 ? "item" : "items"}
									</span>
								</h3>
								<p className="mt-1 text-xs text-muted-foreground">Full craft · {plan.name}</p>
								<ul className="mt-3 space-y-2">
									{plan.shopping.map((item) => (
										<li key={`${item.itemId}:${item.sourceId ?? "flea"}`} className="flex items-center gap-2 text-sm">
											<CraftImage item={items[item.itemId]} size={30} />
											<span className="min-w-0 flex-1">
												{item.name} <span className="text-muted-foreground">×{formatQuantity(item.count)}</span>
												<span className="block text-xs text-muted-foreground">
													{item.traderId ? (traders[item.traderId]?.name ?? `Trader ${item.traderId}`) : "Flea market"}
												</span>
											</span>
											<span className="font-mono text-xs">{formatRoundedRoubles(item.cost)}</span>
										</li>
									))}
								</ul>
							</section>
						</div>
						<p className="mt-4 text-xs text-muted-foreground">Tools assumed owned. Collect and restart at each step. Batch leftovers are not valued.</p>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
