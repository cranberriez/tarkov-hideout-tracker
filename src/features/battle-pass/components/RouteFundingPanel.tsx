import { Wallet } from "lucide-react";
import { CurrencyComparison, FarmTip } from "./CurrencyComparison";
import { useId, useState } from "react";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { CASH_TOLERANCE_CENTS, DOCUMENT_PACKS, TARCOIN_PACKS } from "../lib/funding-model";
import { TarCoin } from "./ui/TarCoin";
import { Toggle } from "./ui/Toggle";
import { Disclosure, SubDisclosure } from "./ui/Disclosure";
import { fieldLabel, flatField, syncValue } from "./ui/field";
import { cn } from "@/lib/utils";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** Purchase and wallet inputs live with the route configuration; the funding panel only reports results.
 * Buying TarCoins needs buying classified, so each toggle carries the other along. */
export function FundingInputs() {
	const id = useId();
	const { settings } = useBattlePassPlanContext();
	const [balanceDraft, setBalanceDraft] = useState<string | null>(null);
	const { purchases } = settings;
	return (
		<div className="flex flex-wrap items-end gap-2">
			<Toggle
				indicator
				className="h-9 text-sm"
				checked={purchases !== "none"}
				onChange={(value) => settings.setPurchases(value ? "tarcoins" : "none")}
				title="Buy classified documents with TarCoins. Off: gather every missing document instead."
			>
				Buy classified
			</Toggle>
			<Toggle
				indicator
				className="h-9 text-sm"
				checked={purchases === "cash"}
				onChange={(value) => settings.setPurchases(value ? "cash" : "tarcoins")}
				title="Buy TarCoins with cash. Off: only TarCoins you hold or earn from rewards buy classified documents."
			>
				Buy TarCoins
			</Toggle>
			{/* Unused inputs stay in place, disabled, so the row does not shift. */}
			<label
				htmlFor={id}
				className={cn(fieldLabel, purchases === "none" && "opacity-40")}
				title={purchases === "none" ? "Unused while buying classified is off." : undefined}
			>
				<span>
					Starting TarCoins <TarCoin />
				</span>
				<input
					id={id}
					type="number"
					min={0}
					max={9999999}
					step={1}
					disabled={purchases === "none"}
					value={balanceDraft ?? settings.startingTarCoins}
					onChange={(event) => {
						setBalanceDraft(event.target.value);
						settings.setStartingTarCoins(event.target.value === "" ? 0 : event.target.valueAsNumber);
					}}
					onBlur={() => setBalanceDraft(null)}
					className={cn(flatField, "w-32 tabular-nums")}
				/>
			</label>
			<Toggle
				indicator
				className="h-9 text-sm"
				checked={settings.allowSpecial}
				onChange={settings.setAllowSpecial}
				disabled={purchases !== "cash"}
			>
				One-time 2,000 <TarCoin /> offer ($9.99)
			</Toggle>
		</div>
	);
}

export function RouteFundingPanel() {
	const { route: baseRoute, funding: state, gathering, farming } = useBattlePassPlanContext();
	// Without cash purchases there is nothing to fund; the Plan lists any TarCoin buys.
	if (!baseRoute || !state || gathering.purchases !== "cash") return null;
	// The chosen gathering target carries its own purchase schedule, priced on
	// the route the gathering worker solved; without one, buy every missing document.
	const point = gathering.selected;
	const result = point ? point.plan : typeof state === "string" ? state : state.plan;
	const funding = point ? point.funding : typeof state === "string" ? null : state.comparison;
	const farm = farming[0];
	return (
		<Disclosure
			title="Route funding"
			syncing={gathering.stale}
			icon={<Wallet className="size-4 text-brand" aria-hidden />}
			meta={
				funding ? (
					<span className="text-sm font-semibold text-foreground">
						{funding.cashCents > 0 ? usd(funding.cashCents) : "No purchase needed"}
					</span>
				) : typeof result === "string" ? (
					result
				) : null
			}
		>
			{typeof result === "string" ? (
				<p role="status" className="text-sm">
					{result}
				</p>
			) : (
				<>
					<div aria-live="polite" className={cn("space-y-3", syncValue)}>
						<CurrencyComparison funding={funding!} savedCents={point?.savingsCents} />
						<p className="text-xs text-muted-foreground">
							{point ? `Gather ${point.gathered.toLocaleString()} documents, buy the rest. ` : "No gathering. "}
							{result.balanceDocuments} classified left over.
						</p>
						{farm && <FarmTip extraTarCoins={farm.extraTarCoins} savingsCents={farm.savingsCents} />}
					</div>
					<SubDisclosure title="Pack prices">
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<h4 className="mb-2 text-xs font-medium">Classified documents</h4>
								<ul className="space-y-1 text-xs text-muted-foreground">
									{DOCUMENT_PACKS.map((pack) => (
										<li key={pack.documents}>
											{pack.documents} classified for {pack.tarCoins.toLocaleString()} <TarCoin />
										</li>
									))}
								</ul>
							</div>
							<div>
								<h4 className="mb-2 text-xs font-medium">TarCoins in USD</h4>
								<ul className="space-y-1 text-xs text-muted-foreground">
									{TARCOIN_PACKS.map((pack, index) => (
										<li key={index}>
											{pack.tarCoins.toLocaleString()} <TarCoin /> for {usd(pack.cents)}
											{pack.special && <span className="text-amber-300"> (once only)</span>}
										</li>
									))}
								</ul>
							</div>
						</div>
						<p className="mt-3 text-xs text-muted-foreground">
							Most TarCoins within {usd(CASH_TOLERANCE_CENTS)} of the minimum. Prices in USD before tax.
						</p>
					</SubDisclosure>
				</>
			)}
		</Disclosure>
	);
}
