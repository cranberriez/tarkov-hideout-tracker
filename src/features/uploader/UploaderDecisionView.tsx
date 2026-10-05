"use client";

import { ArrowLeft } from "lucide-react";
import type { Ref } from "react";
import type { useUploaderSummary } from "./useUploaderSummary";
import type { useUploaderDecisions } from "./useUploaderDecisions";
import { DecisionMarker } from "./DecisionMarker";
import { UploaderItemPrice } from "./UploaderItemPrice";
import { UploaderInventoryActions } from "./UploaderInventoryActions";
import { foundInRaidLabel } from "./found-in-raid";

/** Decision-mode contents of the existing review sidebar. */
export function UploaderDecisionView({
	data,
	decisions,
	ignoredCount,
	onReview,
	backRef,
}: {
	data: ReturnType<typeof useUploaderSummary>;
	decisions: ReturnType<typeof useUploaderDecisions>;
	ignoredCount: number;
	onReview: () => void;
	backRef: Ref<HTMLButtonElement>;
}) {
	const { summary, prices, error, retry, loading } = data;
	const { groups, activeKey, select, decide } = decisions;
	const active = activeKey ? groups.get(activeKey) : undefined;
	const item = active?.[0].item;
	const reasons = [
		...new Map(
			(active ?? []).flatMap((row) => row.reasons).map((reason) => [`${reason.kind}:${reason.id}`, reason]),
		).values(),
	];
	return (
		<div aria-label="Item decision details" className="space-y-3">
			<div className="-mx-4 -mt-4 bg-brand/10 p-4">
				<h1 className="text-base font-semibold text-foreground">Item decisions</h1>
			</div>
			<button
				ref={backRef}
				onClick={onReview}
				className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft size={14} />
				Back to review
			</button>
			<div className="flex gap-3 text-[10px] text-muted-foreground">
				{(["KEEP", "HOLD", "SELL"] as const).map((action) => (
					<span key={action} className="flex items-center gap-1">
						<DecisionMarker action={action} />
						{action}
					</span>
				))}
			</div>
			{groups.size > 0 && (
				<label className="block text-xs text-muted-foreground">
					Selected item
					<select
						aria-label="Select item decision"
						value={activeKey ?? ""}
						onChange={(event) => select(event.target.value)}
						className="mt-1 w-full rounded border border-border-color bg-surface-raised px-2 py-1.5 text-xs text-foreground"
					>
						{[...groups].map(([key, rows]) => (
							<option key={key} value={key}>
								{rows[0].item.name} · {foundInRaidLabel(rows[0].foundInRaid)}
							</option>
						))}
					</select>
				</label>
			)}
			{!!summary?.unresolved && (
				<p role="alert" className="text-xs text-warning">
					Some entries have missing data or invalid quantities. Return to review before sending to inventory.
				</p>
			)}
			{ignoredCount > 0 && <p className="text-xs text-warning">{ignoredCount} unidentified boxes excluded.</p>}
			{error ? (
				<p role="alert" className="text-xs text-warning">
					Requirements unavailable.{" "}
					<button disabled={loading} onClick={() => void retry()} className="underline">
						Retry
					</button>
				</p>
			) : !summary ? (
				<p role="status" className="text-xs text-muted-foreground">
					Loading requirements and prices…
				</p>
			) : null}
			{summary && prices.fetching && (
				<p role="status" className="text-xs text-muted-foreground">
					Loading prices…
				</p>
			)}
			{prices.state === "error" && (
				<p role="alert" className="text-xs text-warning">
					Some prices failed.{" "}
					<button disabled={prices.fetching} onClick={() => void prices.refresh()} className="underline">
						Retry prices
					</button>
				</p>
			)}
			{summary?.hasPartialChoices && (
				<p className="text-xs text-warning">
					Some quest alternatives are incompletely listed. Surplus is held for review.
				</p>
			)}
			{item && !error && (
				<div className="space-y-3">
					<div className="space-y-1" aria-label="Decision breakdown">
						{active!.map((row) => {
							const decision = decide(row);
							return (
								<details
									key={`${activeKey}:${row.category}`}
									className="rounded border border-border-color px-2 py-1.5"
								>
									<summary className="cursor-pointer text-xs text-foreground">
										<strong>
											{decision.action} ×{row.quantity}
										</strong>
										<span className="ml-2 text-muted-foreground">
											{row.category === "save"
												? "FIR required"
												: row.category === "needed"
													? "Needed later"
													: row.category === "review"
														? row.foundInRaid === "unknown"
															? "Confirm FIR"
															: "Quest option"
														: decision.pending
															? "Loading price"
															: decision.action === "SELL"
																? "Surplus · price falling"
																: "Surplus · see reason"}
										</span>
									</summary>
									<p className="mt-2 text-xs text-muted-foreground">{decision.why}</p>
								</details>
							);
						})}
					</div>
					<section>
						<h3 className="mb-1 text-xs font-semibold text-foreground">Needed for</h3>
						{reasons.length ? (
							reasons.map((reason) => (
								<p key={`${reason.kind}:${reason.id}`} className="mb-1 text-xs text-foreground">
									{reason.label} · ×{reason.count}
									{reason.firCount ? ` · ${reason.firCount} FIR` : " · Non-FIR accepted"}
									{reason.tool ? " · Tool" : ""}
								</p>
							))
						) : (
							<p className="text-xs text-muted-foreground">No remaining hideout or quest uses.</p>
						)}
					</section>
					<details key={activeKey} className="border-t border-border-color pt-2">
						<summary className="cursor-pointer text-xs font-semibold text-foreground">Prices &amp; trend</summary>
						<UploaderItemPrice
							price={prices.prices[item.id]}
							state={prices.states[item.id]}
							quantity={active!.reduce((total, row) => total + row.quantity, 0)}
						/>
						<p className="mt-2 text-[11px] text-muted-foreground">
							Flea values are before fees. ±5% over 48 hours is the trend threshold; no strong signal defaults to HOLD.
							Sell suggestions apply only to surplus.
						</p>
					</details>
				</div>
			)}
			<UploaderInventoryActions rows={summary?.rows ?? []} disabled={!summary || !!error || summary.unresolved > 0} />
		</div>
	);
}
