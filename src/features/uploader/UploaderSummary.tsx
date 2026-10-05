"use client";

/* eslint-disable @next/next/no-img-element -- Catalog previews. */
import type { ItemSummary } from "@/types/items";
import { ChevronDown } from "lucide-react";
import { itemImageUrl } from "@/lib/utils/item-images";
import type { ReviewEntry } from "./review-model";
import { foundInRaidLabel } from "./found-in-raid";
import { useUploaderSummary } from "./useUploaderSummary";
import { UploaderItemPrice } from "./UploaderItemPrice";
import type { SummaryCategory, SummaryRow } from "./summary-model";

const sections: {
	id: SummaryCategory | "review-fir";
	title: string;
	tone: string;
	description: string;
}[] = [
	{
		id: "save",
		title: "Save for progression",
		tone: "bg-success/10 text-success",
		description: "Reserved for found-in-raid requirements.",
	},
	{
		id: "needed",
		title: "Keep for later",
		tone: "bg-brand/10 text-brand",
		description: "Needed for progression; replacements can be non-FIR.",
	},
	{
		id: "review-fir",
		title: "Confirm found-in-raid status",
		tone: "bg-warning/10 text-warning",
		description: "The scan could not confirm FIR. Return to review and check the in-game FIR badge before deciding.",
	},
	{
		id: "review",
		title: "Optional quest hand-ins",
		tone: "bg-warning/10 text-warning",
		description:
			"A quest accepts this item or an alternative. Keep the option you plan to hand in; you do not need every option.",
	},
	{
		id: "pricing",
		title: "Check price",
		tone: "bg-surface-raised text-muted-foreground",
		description:
			"Flea prices are before fees; trader offers are in rouble equivalents. Historical movement is not a forecast.",
	},
];

function purpose(row: SummaryRow) {
	if (row.category === "pricing")
		return row.reasons.length ? "Surplus or ineligible for remaining needs" : "No matching hideout or quest need";
	if (row.category === "review")
		return row.foundInRaid === "unknown" ? "Confirm FIR · possible quest or hideout use" : "Choose a quest alternative";
	const reasons = row.reasons.filter(
		(reason) => !reason.choice && (row.category === "save" ? reason.firCount > 0 : reason.count > reason.firCount),
	);
	const hideout = reasons.some((reason) => reason.kind === "hideout");
	const quests = reasons.some((reason) => reason.kind === "quest");
	return hideout && quests ? "For hideout + quests" : hideout ? "For hideout" : "For quests";
}

export function UploaderSummary({
	entries,
	items,
	ignoredCount,
}: {
	entries: readonly ReviewEntry[];
	items: readonly ItemSummary[];
	ignoredCount: number;
}) {
	const { summary, prices, error, retry, loading } = useUploaderSummary(entries, items);
	return (
		<div className="mx-auto w-full max-w-4xl space-y-3 py-3">
			<header>
				<p className="text-xs uppercase tracking-widest text-brand">Screenshot review</p>
				<h1 className="mt-1 text-xl font-semibold text-foreground">Item decisions</h1>
				<p className="mt-1 text-xs text-muted-foreground">
					Screenshot + added items · All future upgrades and eligible quests · Expand an item for every reason.
				</p>
				<p className="mt-1 text-xs text-muted-foreground">Saved inventory is not subtracted or changed.</p>
				{ignoredCount > 0 && (
					<p className="mt-2 text-sm text-warning">
						{ignoredCount} unidentified boxes excluded. Return to review to identify them.
					</p>
				)}
			</header>
			{error ? (
				<div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-foreground">
					Requirements could not be loaded. Recommendations are unavailable until both hideout and quest data are ready.
					<button disabled={loading} onClick={() => void retry()} className="ml-2 underline">
						{loading ? "Retrying…" : "Retry"}
					</button>
				</div>
			) : !summary ? (
				<p role="status" className="text-sm text-muted-foreground">
					Checking hideout and quest requirements…
				</p>
			) : (
				<>
					{summary.unresolved > 0 && (
						<p role="alert" className="text-warning">
							{summary.unresolved} entries have missing catalog data or invalid quantities. Return to review to correct
							them.
						</p>
					)}
					{summary.hasPartialChoices && (
						<p role="alert" className="rounded-lg border border-warning/40 p-3 text-sm text-warning">
							Some quests accept a broad range of items that is only partially listed. Check those quest objectives
							before selling; an absent tag is not proof an item has no use.
						</p>
					)}
					<div className="space-y-3">
						{sections.map((section) => {
							const rows = summary.rows.filter((row) => {
								if (section.id === "review-fir") return row.category === "review" && row.foundInRaid === "unknown";
								if (section.id === "review") return row.category === "review" && row.foundInRaid !== "unknown";
								return row.category === section.id;
							});
							if (rows.length === 0 && (section.id === "review" || section.id === "review-fir")) return null;
							const groups = new Map<string, SummaryRow[]>();
							for (const row of rows) {
								const label =
									row.category === "review"
										? foundInRaidLabel(row.foundInRaid)
										: row.category === "save"
											? purpose(row)
											: `${purpose(row)} · ${foundInRaidLabel(row.foundInRaid)}`;
								groups.set(label, [...(groups.get(label) ?? []), row]);
							}
							return (
								<section
									key={section.id}
									aria-label={section.title}
									className="overflow-hidden rounded-lg border border-border-color"
								>
									<div className={`border-b border-border-color px-3 py-2 ${section.tone}`}>
										<h2 className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
											{section.title}{" "}
											<span className="shrink-0 text-xs font-normal text-muted-foreground">
												{rows.reduce((sum, row) => sum + row.quantity, 0).toLocaleString()} units
											</span>
										</h2>
										<p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
										{section.id === "pricing" && prices.fetching && (
											<p role="status" className="mt-1 text-xs text-muted-foreground">
												Loading prices…
											</p>
										)}
										{section.id === "pricing" && prices.state === "error" && (
											<p role="alert" className="mt-1 text-xs text-warning">
												Some prices could not be refreshed.{" "}
												<button disabled={prices.fetching} onClick={() => void prices.refresh()} className="underline">
													Retry prices
												</button>
											</p>
										)}
									</div>
									{rows.length === 0 ? (
										<p className="px-3 py-2 text-xs text-muted-foreground">None</p>
									) : (
										[...groups].map(([label, groupRows]) => (
											<div key={label}>
												{section.id !== "review-fir" && (
													<h3 className="border-b border-border-color bg-surface-raised/30 px-3 py-1 text-[11px] font-medium text-muted-foreground">
														{label}
													</h3>
												)}
												{groupRows.map((row) => (
													<details
														key={`${row.item.id}:${row.foundInRaid}`}
														className="group border-b border-border-color last:border-0"
													>
														<summary className="grid min-h-11 cursor-pointer list-none grid-cols-[1.75rem_minmax(0,1fr)_auto_0.875rem] items-center gap-2 px-3 py-1 hover:bg-surface-raised/50 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
															<img src={itemImageUrl(row.item)} alt="" className="h-7 w-7 shrink-0 object-contain" />
															<div className="min-w-0">
																<p className="truncate text-sm font-medium text-foreground" title={row.item.name}>
																	{row.item.name}
																</p>
																{row.category === "pricing" && (
																	<UploaderItemPrice
																		price={prices.prices[row.item.id]}
																		state={prices.states[row.item.id]}
																		quantity={row.quantity}
																	/>
																)}
															</div>
															<div className="w-16 text-right">
																<p className="min-w-8 text-xs tabular-nums text-foreground">
																	×{row.quantity.toLocaleString()}
																</p>
															</div>
															<ChevronDown
																aria-hidden="true"
																size={14}
																className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
															/>
														</summary>
														<div className="border-t border-border-color bg-surface-raised/20 px-3 py-2 text-xs">
															{row.reasons.length === 0 && (
																<p className="text-muted-foreground">No remaining hideout or quest uses.</p>
															)}
															<div className="space-y-1">
																{row.reasons.map((reason) => (
																	<span key={`${reason.kind}:${reason.id}`} className="block text-xs text-foreground">
																		{reason.kind === "hideout" ? "Hideout" : "Quest"}: {reason.label} · {reason.count}{" "}
																		needed
																		{reason.firCount > 0 ? ` · ${reason.firCount} FIR` : " · Any FIR status"}
																		{reason.tool ? " · Reusable tool" : ""}
																	</span>
																))}
															</div>
														</div>
													</details>
												))}
											</div>
										))
									)}
								</section>
							);
						})}
					</div>
				</>
			)}
		</div>
	);
}
