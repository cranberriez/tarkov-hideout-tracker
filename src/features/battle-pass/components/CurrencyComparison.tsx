import { Coins } from "lucide-react";
import type { CurrencyComparison as Comparison } from "../lib/funding-model";
import { TarCoin } from "./ui/TarCoin";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** Headline purchase: one price, TarCoins left, an optional saving and the pack chips. */
export function CurrencyComparison({ funding, savedCents }: { funding: Comparison; savedCents?: number }) {
	const exact = funding.minimumPurchase;
	const next = funding.alternatives[0];
	return (
		<div className="space-y-3 text-xs">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<span className="text-2xl font-semibold tabular-nums">
					{funding.cashCents > 0 ? usd(funding.cashCents) : "No purchase"}
				</span>
				{funding.totalTarCoins > 0 && (
					<span className="tabular-nums text-muted-foreground">
						{funding.totalTarCoins.toLocaleString()} <TarCoin /> bought
					</span>
				)}
				<span className="tabular-nums text-muted-foreground">
					{funding.balanceTarCoins.toLocaleString()} <TarCoin /> left
				</span>
				{!!savedCents && savedCents > 0 && (
					<span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
						Saves {usd(savedCents)} by gathering
					</span>
				)}
			</div>
			{funding.cashReceipt.length > 0 && (
				<ul className="flex flex-wrap gap-2">
					{funding.cashReceipt.map((pack) => (
						<li
							key={pack.tarCoins}
							className="rounded-lg bg-surface-raised/40 px-2.5 py-1.5 tabular-nums"
							title={`${usd(pack.cents)} each = ${usd(pack.subtotalCents)}`}
						>
							{pack.count} × {pack.tarCoins.toLocaleString()} <TarCoin />
							{pack.special && <span className="text-amber-300"> once</span>}
							<span className="text-muted-foreground"> · {usd(pack.subtotalCents)}</span>
						</li>
					))}
				</ul>
			)}
			{(exact || next) && (
				<p className="text-muted-foreground">
					{exact && (
						<>
							Exact minimum {usd(exact.cashCents)} ({exact.totalTarCoins.toLocaleString()} <TarCoin /> bought,{" "}
							{exact.balanceTarCoins.toLocaleString()} left).{" "}
						</>
					)}
					{next && (
						<>
							Next bundle +{usd(next.cents - funding.cashCents)}: {(next.balanceTarCoins - funding.balanceTarCoins).toLocaleString()} <TarCoin /> more
							left.
						</>
					)}
				</p>
			)}
		</div>
	);
}

/** One compact line: farm a few TarCoins before buying to cut cash. */
export function FarmTip({ extraTarCoins, savingsCents }: { extraTarCoins: number; savingsCents: number }) {
	return (
		<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
			<Coins className="size-3.5 shrink-0 text-success" aria-hidden />
			Farm {extraTarCoins.toLocaleString()} <TarCoin /> before buying to save {usd(savingsCents)}.
		</p>
	);
}
