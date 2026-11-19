import { Wallet } from "lucide-react";
import { CurrencyComparison } from "./CurrencyComparison";
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

/** Wallet inputs live with the route configuration; the funding panel only reports results. */
export function FundingInputs() {
	const id = useId();
	const { settings } = useBattlePassPlanContext();
	const [balanceDraft, setBalanceDraft] = useState<string | null>(null);
	return (
		<div className="flex flex-wrap items-end gap-2">
			<label htmlFor={id} className={fieldLabel}>
				<span>
					Starting TarCoins <TarCoin />
				</span>
				<input
					id={id}
					type="number"
					min={0}
					max={9999999}
					step={1}
					value={balanceDraft ?? settings.startingTarCoins}
					onChange={(event) => {
						setBalanceDraft(event.target.value);
						settings.setStartingTarCoins(event.target.value === "" ? 0 : event.target.valueAsNumber);
					}}
					onBlur={() => setBalanceDraft(null)}
					className={cn(flatField, "w-32 tabular-nums")}
				/>
			</label>
			<Toggle indicator className="h-9 text-sm" checked={settings.allowSpecial} onChange={settings.setAllowSpecial}>
				One-time 2,000 <TarCoin /> offer ($9.99)
			</Toggle>
		</div>
	);
}

export function RouteFundingPanel() {
	const { route, funding: state, claimProfileLabel } = useBattlePassPlanContext();
	if (!route || !state) return null;
	const result = typeof state === "string" ? state : state.plan;
	const funding = typeof state === "string" ? null : state.comparison;
	return (
		<Disclosure
			title="Route funding"
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
					<div aria-live="polite" className={cn("space-y-2", syncValue)}>
						<CurrencyComparison funding={funding!} />
						<p className="text-xs text-muted-foreground">{result.balanceDocuments} classified documents left</p>
					</div>
					<div className="flex flex-col gap-3">
						<SubDisclosure title="Pack purchases by claim">
							<ol className="max-h-96 space-y-3 overflow-auto text-sm">
								{result.steps.map((step, index) => (
									<li key={step.rewardId} className="space-y-1 rounded-md bg-surface-raised/30 p-3">
										<p className="font-medium">
											{index + 1}. {route.selected.find((tile) => tile.id === step.rewardId)?.displayName}{" "}
											<span className="ml-2 font-normal text-muted-foreground">
												{(() => {
													const claim = route.claims.find((entry) => entry.rewardId === step.rewardId);
													return claim && claimProfileLabel(claim);
												})()}
											</span>
										</p>
										{step.documentPacks.map((pack, i) => (
											<p key={i} className="text-xs">
												Buy {pack.count} × {pack.documents} classified at {pack.tarCoins.toLocaleString()} <TarCoin />{" "}
												each = {(pack.tarCoins * pack.count).toLocaleString()} <TarCoin />
											</p>
										))}
										<p className="text-xs text-muted-foreground">
											Claim reward
											{step.rewardTarCoins > 0 && (
												<>
													{" "}
													and receive {step.rewardTarCoins.toLocaleString()} <TarCoin />
												</>
											)}{" "}
											<br />
											Balance {step.balanceTarCoins.toLocaleString()} <TarCoin />, {step.balanceDocuments} purchased
											classified left
										</p>
									</li>
								))}
							</ol>
						</SubDisclosure>
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
					</div>
				</>
			)}
		</Disclosure>
	);
}
