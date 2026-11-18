import { useEffect, useState } from "react";
import { useBattlePassData } from "../BattlePassSeason";
import type { GatheringBreakpoint, SavingsRoute } from "../lib/gathering-savings-model";
import { documentDisplayName } from "../lib/battle-pass-display";
import { GATHERING_DAILY_CAPS } from "../lib/gathering-caps";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const periods = (count: number) => `${count} acquisition ${count === 1 ? "period" : "periods"}`;

export function GatheringSavings(props: { route: SavingsRoute; startingTarCoins: number; allowSpecial: boolean }) {
	const { documents } = useBattlePassData();
	const [result, setResult] = useState<{
		input: typeof props;
		breakpoints?: GatheringBreakpoint[];
		error?: string;
	} | null>(null);
	const { route, startingTarCoins, allowSpecial } = props;
	useEffect(() => {
		const input = { route, startingTarCoins, allowSpecial };
		const worker = new Worker(new URL("../lib/gathering-savings.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = (event: MessageEvent<{ breakpoints?: GatheringBreakpoint[]; error?: string }>) => {
			setResult({ input, ...event.data });
			worker.terminate();
		};
		worker.onerror = () => {
			setResult({ input, error: "Could not calculate gathering savings. Try again." });
			worker.terminate();
		};
		worker.postMessage(input);
		return () => worker.terminate();
	}, [route, startingTarCoins, allowSpecial]);
	const current =
		result?.input.route === route &&
		result.input.startingTarCoins === startingTarCoins &&
		result.input.allowSpecial === allowSpecial
			? result
			: null;
	const highlight = current?.breakpoints?.find((point) => point.savingsCents >= 499) ?? current?.breakpoints?.at(-1);
	return (
		<section className="space-y-3 rounded-md border border-border p-3">
			<h4 className="text-sm font-medium">Save cash by gathering</h4>
			<p className="text-xs text-muted-foreground">
				For this fixed route and claim order. Listed quantities are cumulative additions to current stock.
			</p>
			<p className="text-xs text-muted-foreground">
				Acquisition caps per 24 hours, across all document types: PVP {GATHERING_DAILY_CAPS.PVP}, PVE{" "}
				{GATHERING_DAILY_CAPS.PVE}, seasonal {GATHERING_DAILY_CAPS.seasonal}. Acquisition periods assume the full cap is
				available; profiles run in parallel.
			</p>
			{!current ? (
				<p role="status" className="text-xs">
					Calculating gathering savings…
				</p>
			) : current.error ? (
				<p role="status" className="text-xs">
					{current.error}
				</p>
			) : !current.breakpoints?.length ? (
				<p className="text-xs text-muted-foreground">
					No cash reductions before the route is fully covered by gathered and owned documents.
				</p>
			) : (
				<>
					{highlight && (
						<p className="rounded-md bg-muted p-3 text-sm" aria-live="polite">
							<strong>
								Gather {highlight.gathered} more documents to save {usd(highlight.savingsCents)}.
							</strong>{" "}
							Cash drops to {usd(highlight.cashCents)} · {periods(highlight.parallelWindows)} of 24 hours.
						</p>
					)}
					<details>
						<summary className="cursor-pointer text-xs font-medium">
							Exact quantities and all savings breakpoints
						</summary>
						<ol className="max-h-96 space-y-3 overflow-auto text-xs">
							{current.breakpoints.map((point) => (
								<li key={point.gathered} className="space-y-1 border-b border-border pb-3 last:border-0">
									<p className="font-medium">
										Gather {point.gathered} total · {usd(point.cashCents)} cash · save {usd(point.savingsCents)}
									</p>
									<ul>
										{point.quantities.map((row) => (
											<li key={`${row.profileKey}:${row.documentKey}`}>
												{row.profileLabel}: {row.quantity}{" "}
												{documentDisplayName(
													documents.find((doc) => doc.key === row.documentKey)?.name ?? row.documentKey,
												)}
											</li>
										))}
									</ul>
									<p className="text-muted-foreground">
										{periods(point.parallelWindows)} in parallel ·{" "}
										{point.windows
											.map(
												(row) =>
													`${row.profileLabel}: ${periods(row.windows)} (${row.quantity} documents, cap ${row.cap})`,
											)
											.join(" · ")}
									</p>
									<p className="text-muted-foreground">
										{point.remainingClassified} classified still needed from packs, funded by cash, wallet and route
										rewards.
									</p>
								</li>
							))}
						</ol>
					</details>
				</>
			)}
		</section>
	);
}
