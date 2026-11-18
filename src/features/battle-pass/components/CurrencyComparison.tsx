import type { CurrencyComparison as Comparison } from "../lib/funding-model";
import { TarCoin } from "./ui/TarCoin";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function CurrencyComparison({ funding }: { funding: Comparison }) {
	return (
		<div className="space-y-2 text-xs">
			<p>
				<strong>
					{funding.minimumPurchase ? "Recommended spend" : "Minimum spend"} {usd(funding.cashCents)}
				</strong>{" "}
				· {funding.totalTarCoins.toLocaleString()} <TarCoin /> purchased · {funding.balanceTarCoins.toLocaleString()}{" "}
				<TarCoin /> left after all claims
			</p>
			{funding.cashReceipt.map((pack) => (
				<p key={pack.tarCoins}>
					{pack.count} × {pack.tarCoins.toLocaleString()} <TarCoin /> {pack.special && "(one-time offer) "}at{" "}
					{usd(pack.cents)} each = {usd(pack.subtotalCents)}
				</p>
			))}
			{funding.minimumPurchase && (
				<p className="text-muted-foreground">
					<strong>Exact minimum {usd(funding.minimumPurchase.cashCents)}</strong> ·{" "}
					{funding.minimumPurchase.cashReceipt
						.map((p) => `${p.count} × ${p.tarCoins.toLocaleString()}${p.special ? " (one-time offer)" : ""}`)
						.join(" + ")}{" "}
					· {funding.minimumPurchase.totalTarCoins.toLocaleString()} <TarCoin /> purchased ·{" "}
					{funding.minimumPurchase.balanceTarCoins.toLocaleString()} <TarCoin /> left. The recommended purchase adds{" "}
					{(funding.totalTarCoins - funding.minimumPurchase.totalTarCoins).toLocaleString()} <TarCoin /> for{" "}
					{usd(funding.cashCents - funding.minimumPurchase.cashCents)} more.
				</p>
			)}
			{funding.alternatives.map((pack) => (
				<p className="text-muted-foreground" key={pack.tarCoins}>
					<strong>
						Alternative {usd(pack.cents)} (+{usd(pack.cents - funding.cashCents)})
					</strong>{" "}
					· one {pack.tarCoins.toLocaleString()} <TarCoin /> bundle{pack.special && " (one-time offer)"} ·{" "}
					{pack.balanceTarCoins.toLocaleString()} <TarCoin /> left with the same document purchases
				</p>
			))}
		</div>
	);
}
