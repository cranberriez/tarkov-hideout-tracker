import { Check, LockKeyhole } from "lucide-react";
import type { AcquisitionPlan } from "@/lib/price-calculation";
import { formatCompactRoubles } from "@/lib/utils/market-price";

export function RecommendationBadge({ plan, unstable }: { plan: AcquisitionPlan; unstable: boolean }) {
	const label =
		plan.method === "empty"
			? "Empty value"
			: plan.method === "flea"
				? "Buy"
				: plan.method === "sell"
					? "Found"
					: plan.method === "trader"
						? "Trader"
						: plan.method === "craft"
							? "Craft"
							: plan.method === "barter"
								? "Barter"
								: "Unpriced";
	const classes =
		plan.method === "craft"
			? "bg-acquisition-craft/10 text-acquisition-craft"
			: plan.method === "trader"
				? "bg-acquisition-trader/10 text-acquisition-trader"
				: plan.method === "barter"
					? "bg-acquisition-barter/10 text-acquisition-barter"
					: plan.method === "flea"
						? "bg-acquisition-flea/10 text-acquisition-flea"
						: plan.method === "sell" || plan.method === "empty"
							? "bg-acquisition-sell-value/10 text-acquisition-sell-value"
							: "bg-highlight/5 text-muted-foreground";
	const valueUnstable = unstable && plan.method === "flea";
	return (
		<span className="flex flex-wrap items-center gap-1.5">
			<span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${classes}`}>{label}</span>
			{plan.method === "sell" && plan.totalCost !== null && (
				<span className="text-[10px] font-normal text-muted-foreground">(sell value)</span>
			)}
			{plan.totalCost !== null && (
				<span className="flex shrink-0 items-baseline gap-1 leading-none">
					<span
						className={`font-mono text-[10px] font-semibold ${valueUnstable ? "text-warning" : "text-foreground/80"}`}
						title={valueUnstable ? "Value unstable" : undefined}
					>
						{valueUnstable && "~"}
						{formatCompactRoubles(Math.round(plan.totalCost))} ₽
					</span>
					<span className="text-[7px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Total</span>
				</span>
			)}
		</span>
	);
}

export function AvailabilityBadge({ available }: { available: boolean }) {
	return (
		<span
			className={available ? "text-success" : "text-danger"}
			title={available ? "Available" : "Locked"}
			aria-label={available ? "Available" : "Locked"}
		>
			{available ? <Check size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
		</span>
	);
}
