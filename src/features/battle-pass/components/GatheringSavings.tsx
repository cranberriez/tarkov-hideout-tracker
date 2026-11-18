import { Files } from "lucide-react";
import { useFundingSettings } from "../useFundingSettings";
import { CurrencyComparison } from "./CurrencyComparison";
import { useEffect, useMemo, useState } from "react";
import { useBattlePassData } from "../BattlePassSeason";
import {
	gatheringScenario,
	type GatheringFilters,
	type GatheringBreakpoint,
	type SavingsRoute,
} from "../lib/gathering-savings-model";
import { documentDisplayName } from "../lib/battle-pass-display";
import { GATHERING_DAILY_CAPS } from "../lib/gathering-caps";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const periods = (count: number) => `${count} acquisition ${count === 1 ? "period" : "periods"}`;

export function GatheringSavings(props: { route: SavingsRoute; startingTarCoins: number; allowSpecial: boolean }) {
	const { documents } = useBattlePassData();
	const { gatheringFilters: filters, setGatheringChoice } = useFundingSettings();
	const options = useMemo(() => {
		const groups = new Map<string, { label: string; keys: string[] }>();
		for (const row of gatheringScenario(props.route, Infinity).quantities) {
			const group = groups.get(row.profileKey) ?? { label: row.profileLabel, keys: [] };
			group.keys.push(row.documentKey);
			groups.set(row.profileKey, group);
		}
		return [...groups];
	}, [props.route]);
	const name = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	const quantities = (point: GatheringBreakpoint) => (
		<ul className="space-y-1 text-xs">
			{point.windows.map((profile) => (
				<li key={profile.profileKey}>
					<strong>{profile.profileLabel}</strong> ·{" "}
					{point.quantities
						.filter((row) => row.profileKey === profile.profileKey)
						.map((row) => `${row.quantity} ${name(row.documentKey)}`)
						.join(", ")}
				</li>
			))}
		</ul>
	);
	const [result, setResult] = useState<{
		input: typeof props & { filters: GatheringFilters };
		breakpoints?: GatheringBreakpoint[];
		error?: string;
	} | null>(null);
	const { route, startingTarCoins, allowSpecial } = props;
	useEffect(() => {
		const input = { route, startingTarCoins, allowSpecial, filters };
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
	}, [route, startingTarCoins, allowSpecial, filters]);
	const current =
		result?.input.route === route &&
		result.input.startingTarCoins === startingTarCoins &&
		result.input.allowSpecial === allowSpecial &&
		result.input.filters === filters
			? result
			: null;
	const highlight = current?.breakpoints?.find((point) => point.savingsCents >= 499) ?? current?.breakpoints?.at(-1);
	return (
		<section className="mt-7 space-y-4 border-t border-border pt-6">
			<h3 className="flex items-center gap-2 text-base font-semibold">
				<Files className="size-4 text-brand" aria-hidden />
				Save cash by gathering
			</h3>
			<p className="text-xs text-muted-foreground">
				Daily caps · PVP {GATHERING_DAILY_CAPS.PVP} · PVE {GATHERING_DAILY_CAPS.PVE} · Seasonal{" "}
				{GATHERING_DAILY_CAPS.seasonal}. Modes gather in parallel.
			</p>
			<details>
				<summary className="cursor-pointer text-xs font-medium">Choose modes and documents to gather</summary>
				<p className="mt-2 text-xs text-muted-foreground">Saved on this device.</p>
				<div className="mt-2 space-y-3">
					{options.map(([key, group]) => {
						const filter = filters[key] ?? {};
						return (
							<fieldset key={key} className="text-xs">
								<legend>
									<label>
										<input
											type="checkbox"
											checked={!filter.disabled}
											onChange={(event) => setGatheringChoice(key, event.target.checked)}
										/>{" "}
										Gather in {group.label}
									</label>
								</legend>
								<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
									{group.keys.map((doc) => (
										<label key={doc}>
											<input
												type="checkbox"
												disabled={filter.disabled}
												checked={!filter.disabled && !filter.excluded?.includes(doc)}
												onChange={(event) => setGatheringChoice(key, event.target.checked, doc)}
											/>{" "}
											{name(doc)}
										</label>
									))}
								</div>
							</fieldset>
						);
					})}
				</div>
			</details>
			{!current ? (
				<p role="status" className="text-xs">
					Calculating gathering savings…
				</p>
			) : current.error ? (
				<p role="status" className="text-xs">
					{current.error}
				</p>
			) : !current.breakpoints?.length ? (
				<p className="text-xs text-muted-foreground">No partial gathering option reduces cash with these choices.</p>
			) : (
				<>
					{highlight && (
						<div className="space-y-2 rounded-md bg-muted p-3 text-sm" aria-live="polite">
							<strong>
								Gather {highlight.gathered} more documents to save {usd(highlight.savingsCents)}.
							</strong>{" "}
							Cash drops to {usd(highlight.cashCents)} · {periods(highlight.parallelWindows)} of 24 hours.
							{quantities(highlight)}
						</div>
					)}
					<details>
						<summary className="cursor-pointer text-xs font-medium">All gathering options</summary>
						<ol className="max-h-96 space-y-3 overflow-auto text-xs">
							{current.breakpoints.map((point) => (
								<li key={point.gathered} className="space-y-1 border-b border-border pb-3 last:border-0">
									<p className="font-medium">
										Gather {point.gathered} total · {usd(point.cashCents)} cash · save {usd(point.savingsCents)}
									</p>
									{quantities(point)}
									<CurrencyComparison funding={point.funding} />
									<p className="text-muted-foreground">
										{periods(point.parallelWindows)} in parallel ·{" "}
										{point.windows
											.map(
												(row) =>
													`${row.profileLabel}: ${periods(row.windows)} (${row.quantity} documents, cap ${row.cap})`,
											)
											.join(" · ")}
									</p>
									<p className="text-muted-foreground">{point.remainingClassified} classified needed from packs.</p>
								</li>
							))}
						</ol>
					</details>
				</>
			)}
		</section>
	);
}
