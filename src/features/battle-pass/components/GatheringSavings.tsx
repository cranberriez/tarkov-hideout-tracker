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
import { Disclosure, SubDisclosure } from "./ui/Disclosure";
import { Toggle } from "./ui/Toggle";
import { syncValue } from "./ui/field";
import { cn } from "@/lib/utils";

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
					<strong>{profile.profileLabel}:</strong>{" "}
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
	// Keep the previous answer on screen while the worker recalculates, so the section keeps its height.
	const shown = current ?? result;
	const highlight = shown?.breakpoints?.find((point) => point.savingsCents >= 499) ?? shown?.breakpoints?.at(-1);
	return (
		<Disclosure
			syncing={!!result && !current}
			title="Save cash by gathering"
			icon={<Files className="size-4 text-brand" aria-hidden />}
			meta={
				highlight ? (
					<span className={cn("text-sm font-semibold text-success", syncValue)}>
						Save {usd(highlight.savingsCents)}
					</span>
				) : !shown ? (
					"Calculating…"
				) : null
			}
		>
			{!shown ? (
				<p role="status" className="text-xs">
					Calculating gathering savings…
				</p>
			) : shown.error ? (
				<p role="status" className="text-xs">
					{shown.error}
				</p>
			) : !shown.breakpoints?.length ? (
				<p className="text-xs text-muted-foreground">No partial gathering option reduces cash with these choices.</p>
			) : (
				highlight && (
					<div className={cn("space-y-2 rounded-md bg-success/[0.07] p-3 text-sm", syncValue)} aria-live="polite">
						<p>
							<strong>
								Gather {highlight.gathered} more documents to save {usd(highlight.savingsCents)}.
							</strong>{" "}
							<span className="text-muted-foreground">
								Cash drops to {usd(highlight.cashCents)} over {periods(highlight.parallelWindows)} of 24 hours.
							</span>
						</p>
						{quantities(highlight)}
					</div>
				)
			)}
			<div className="flex flex-col gap-3">
				<SubDisclosure title="Modes and documents to gather">
					<p className="mb-3 text-xs text-muted-foreground">
						Daily caps: PVP {GATHERING_DAILY_CAPS.PVP}, PVE {GATHERING_DAILY_CAPS.PVE}, Seasonal{" "}
						{GATHERING_DAILY_CAPS.seasonal}. Modes gather in parallel. Saved on this device.
					</p>
					<div className="space-y-3">
						{options.map(([key, group]) => {
							const filter = filters[key] ?? {};
							return (
								<fieldset key={key} className="flex flex-wrap items-center gap-2">
									<legend className="sr-only">{group.label}</legend>
									<Toggle
										indicator
										className="font-semibold"
										checked={!filter.disabled}
										onChange={(value) => setGatheringChoice(key, value)}
									>
										{group.label}
									</Toggle>
									<span aria-hidden className="mx-1 h-4 w-px bg-border" />
									{group.keys.map((doc) => (
										<Toggle
											key={doc}
											indicator
											disabled={filter.disabled}
											checked={!filter.disabled && !filter.excluded?.includes(doc)}
											onChange={(value) => setGatheringChoice(key, value, doc)}
										>
											{name(doc)}
										</Toggle>
									))}
								</fieldset>
							);
						})}
					</div>
				</SubDisclosure>
				{shown?.breakpoints && shown.breakpoints.length > 0 && (
					<SubDisclosure title="All gathering options">
						<ol className="max-h-96 space-y-3 overflow-auto text-xs">
							{shown.breakpoints.map((point) => (
								<li key={point.gathered} className="space-y-1 rounded-md bg-surface-raised/30 p-3">
									<p className="font-medium">
										Gather {point.gathered} total: {usd(point.cashCents)} cash, save {usd(point.savingsCents)}
									</p>
									{quantities(point)}
									<CurrencyComparison funding={point.funding} />
									<p className="text-muted-foreground">
										{periods(point.parallelWindows)} in parallel.{" "}
										{point.windows
											.map(
												(row) =>
													`${row.profileLabel}: ${periods(row.windows)} (${row.quantity} documents, cap ${row.cap})`,
											)
											.join("; ")}
									</p>
									<p className="text-muted-foreground">{point.remainingClassified} classified needed from packs.</p>
								</li>
							))}
						</ol>
					</SubDisclosure>
				)}
			</div>
		</Disclosure>
	);
}
