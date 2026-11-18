import { useId, useMemo, useState } from "react";
import type { useDocumentRoute } from "../useDocumentRoute";
import { useFundingSettings } from "../useFundingSettings";
import { useRouteFunding } from "../useRouteFunding";
import { DOCUMENT_PACKS, TARCOIN_PACKS, rewardTarCoins } from "../lib/funding-model";
import { TarCoin } from "./ui/TarCoin";
import { Toggle } from "./ui/Toggle";
import { GatheringSavings } from "./GatheringSavings";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function RouteFundingPanel({ route }: { route: Exclude<ReturnType<typeof useDocumentRoute>, string> | null }) {
	const id = useId();
	const settings = useFundingSettings();
	const [balanceDraft, setBalanceDraft] = useState<string | null>(null);
	const claims = useMemo(
		() =>
			route?.claims.map((claim) => ({
				rewardId: claim.rewardId,
				page: claim.page,
				additionalClassified: claim.additionalClassified,
				tarCoins: rewardTarCoins(route.selected.find((tile) => tile.id === claim.rewardId)!),
			})) ?? [],
		[route],
	);
	const result = useRouteFunding(claims, settings.startingTarCoins, settings.allowSpecial);
	return (
		<div className="space-y-3 border-t border-border pt-4">
			<h3 className="text-sm font-semibold">Fund this document route</h3>
			<p className="text-xs text-muted-foreground">
				Estimate for the selected destination, reward scope and claim order above. Reward TarCoins become available
				after each claim. Balance and offer availability are shared across seasons and profiles; this preview does not
				change them.
			</p>
			<div className="flex flex-wrap items-end gap-3">
				<label htmlFor={id} className="grid gap-1 text-xs text-muted-foreground">
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
						className="h-9 w-36 rounded-md border border-border bg-background px-3 text-sm text-foreground"
					/>
				</label>
				<Toggle checked={settings.allowSpecial} onChange={settings.setAllowSpecial}>
					One-time 2,000 <TarCoin /> offer available ($9.99)
				</Toggle>
			</div>
			<p className="text-xs text-muted-foreground">
				Uses the supplied USD prices. Regional pricing, taxes and store offers may vary. Larger regular currency and
				document packs cost less per unit, but this plan minimizes total cash for this route, including your balance and
				rewards received along the way.
			</p>
			<details className="rounded-md border border-border p-3">
				<summary className="cursor-pointer text-xs font-medium">Pack prices</summary>
				<div className="mt-3 grid gap-4 sm:grid-cols-2">
					<div>
						<h4 className="mb-2 text-xs font-medium">Classified documents</h4>
						<ul className="space-y-1 text-xs text-muted-foreground">
							{DOCUMENT_PACKS.map((pack) => (
								<li key={pack.documents}>
									{pack.documents} classified · {pack.tarCoins.toLocaleString()} <TarCoin />
								</li>
							))}
						</ul>
					</div>
					<div>
						<h4 className="mb-2 text-xs font-medium">TarCoins · USD</h4>
						<ul className="space-y-1 text-xs text-muted-foreground">
							{TARCOIN_PACKS.map((pack, index) => (
								<li key={index}>
									{pack.tarCoins.toLocaleString()} <TarCoin /> · {usd(pack.cents)}
									{pack.special && <span className="text-amber-300"> · once only</span>}
								</li>
							))}
						</ul>
					</div>
				</div>
			</details>
			{!route ? (
				<p className="text-xs text-muted-foreground">A purchase schedule appears once the document route is ready.</p>
			) : typeof result === "string" ? (
				<p role="status" className="text-sm">
					{result}
				</p>
			) : (
				<>
					<div className="rounded-md border border-border p-3" aria-live="polite">
						<h4 className="text-sm font-semibold">Cash purchase receipt</h4>
						{result.cashReceipt.length > 0 && (
							<p className="mt-1 text-xs text-muted-foreground">
								Buy these currency packs once before the document purchases below.
							</p>
						)}
						<ul className="my-3 space-y-2 text-sm">
							{result.cashReceipt.map((pack) => (
								<li key={`${pack.tarCoins}-${pack.special}`}>
									{pack.count} × {pack.tarCoins.toLocaleString()} <TarCoin /> pack
									{pack.special && " (one-time offer)"} · {usd(pack.cents)} each ={" "}
									<strong>{usd(pack.subtotalCents)}</strong>
								</li>
							))}
						</ul>
						{result.cashReceipt.length === 0 && <p className="my-3 text-xs">No cash purchases needed.</p>}
						<p className="border-t border-border pt-2 text-sm">
							<strong>Total additional cash: {usd(result.cashCents)}</strong> · {result.totalTarCoins.toLocaleString()}{" "}
							<TarCoin /> purchased
						</p>
					</div>
					<p className="text-xs text-muted-foreground">
						{result.balanceTarCoins.toLocaleString()} <TarCoin /> left · {result.balanceDocuments} purchased classified
						left
					</p>
					<details className="rounded-md border border-border p-3">
						<summary className="cursor-pointer text-sm font-medium">Document pack purchases and claims</summary>
						<ol className="mt-3 max-h-96 space-y-3 overflow-auto text-sm">
							{result.steps.map((step, index) => (
								<li key={step.rewardId} className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0">
									<p className="font-medium">
										{index + 1}. {route.selected.find((tile) => tile.id === step.rewardId)?.displayName}{" "}
										<span className="font-normal text-muted-foreground">
											· {route.claims.find((claim) => claim.rewardId === step.rewardId)?.profileLabel}
										</span>
									</p>
									{step.documentPacks.map((pack, i) => (
										<p key={i} className="text-xs">
											Buy {pack.count} × {pack.documents} classified · {pack.tarCoins.toLocaleString()} <TarCoin /> each
											= {(pack.tarCoins * pack.count).toLocaleString()} <TarCoin />
										</p>
									))}
									<p className="text-xs text-muted-foreground">
										Claim reward
										{step.rewardTarCoins > 0 && (
											<>
												{" "}
												· receive {step.rewardTarCoins.toLocaleString()} <TarCoin />
											</>
										)}{" "}
										· balance {step.balanceTarCoins.toLocaleString()} <TarCoin /> · {step.balanceDocuments} purchased
										classified left
									</p>
								</li>
							))}
						</ol>
					</details>
					{result.cashCents > 0 && (
						<GatheringSavings
							route={route}
							startingTarCoins={settings.startingTarCoins}
							allowSpecial={settings.allowSpecial}
						/>
					)}
				</>
			)}
		</div>
	);
}
