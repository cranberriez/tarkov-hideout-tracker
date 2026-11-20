import { Coins, Files } from "lucide-react";
import { TarCoin } from "./ui/TarCoin";
import { CurrencyComparison } from "./CurrencyComparison";
import { useBattlePassData } from "../BattlePassSeason";
import type { GatheringBreakpoint } from "../lib/gathering-savings-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { documentDisplayName } from "../lib/battle-pass-display";
import { GATHERING_DAILY_CAPS } from "../lib/gathering-caps";
import { Disclosure, SubDisclosure } from "./ui/Disclosure";
import { syncValue } from "./ui/field";
import { cn } from "@/lib/utils";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const periods = (count: number) => `${count} acquisition ${count === 1 ? "period" : "periods"}`;

export function GatheringSavings() {
	const { documents } = useBattlePassData();
	const { gathering, farming } = useBattlePassPlanContext();
	const farm = farming[0];
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
	const breakpoints = gathering.breakpoints;
	const highlight = gathering.selected;
	const shown = gathering.calculating ? null : gathering;
	return (
		<Disclosure
			syncing={gathering.stale}
			title="Save cash by gathering"
			icon={<Files className="size-4 text-brand" aria-hidden />}
			meta={
				!shown ? (
					"Calculating…"
				) : (
					<span className={cn("flex flex-wrap items-center justify-end gap-x-3", syncValue)}>
						{highlight ? (
							<span className="text-sm font-semibold text-success">Save {usd(highlight.savingsCents)}</span>
						) : (
							breakpoints.length > 0 && "No gathering"
						)}
						{farm && (
							<span className="inline-flex items-center gap-1 text-xs">
								<Coins className="size-3.5 text-success" aria-hidden />+{farm.extraTarCoins.toLocaleString()}{" "}
								<TarCoin /> saves {usd(farm.savingsCents)}
							</span>
						)}
					</span>
				)
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
			) : !breakpoints.length ? (
				<p className="text-xs text-muted-foreground">No partial gathering option reduces cash with these choices.</p>
			) : (
				highlight && (
					<div className={cn("space-y-2 rounded-md bg-success/[0.07] p-3 text-sm", syncValue)} aria-live="polite">
						<p>
							<strong>
								{highlight === gathering.recommended ? "Recommended: g" : "Your target: g"}ather {highlight.gathered}{" "}
								more documents to save {usd(highlight.savingsCents)}.
							</strong>{" "}
							<span className="text-muted-foreground">
								Cash drops to {usd(highlight.cashCents)} over {periods(highlight.parallelWindows)} of 24 hours.
							</span>
						</p>
						{quantities(highlight)}
					</div>
				)
			)}
			{shown && farming.length > 0 && (
				<ul className={cn("space-y-1 rounded-md bg-success/[0.07] p-3 text-sm", syncValue)} aria-live="polite">
					{farming.map((option) => (
						<li key={option.extraTarCoins} className="flex items-start gap-2">
							<Coins className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
							<span>
								<strong>
									Farm {option.extraTarCoins.toLocaleString()} <TarCoin /> more to save {usd(option.savingsCents)}.
								</strong>{" "}
								<span className="text-muted-foreground">
									Earn them in PVP or the seasonal mode before buying; cash drops to {usd(option.cashCents)}.
								</span>
							</span>
						</li>
					))}
				</ul>
			)}
			<div className="flex flex-col gap-3">
				<p className="text-xs text-muted-foreground">
					Choose modes, document types and daily headroom under Route configuration → Advanced. Daily caps: PVE{" "}
					{GATHERING_DAILY_CAPS.PVE}, PVP {GATHERING_DAILY_CAPS.PVP}, Seasonal {GATHERING_DAILY_CAPS.seasonal}.
				</p>
				{breakpoints.length > 0 && (
					<SubDisclosure title="All gathering options">
						<ol className="max-h-96 space-y-3 overflow-auto text-xs">
							{breakpoints.map((point) => (
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
