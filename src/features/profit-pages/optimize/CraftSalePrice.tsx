import { formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import type { CraftPlan } from "./craft-plans";

export function CraftSalePrice({ plan, compact = false }: { plan: CraftPlan; compact?: boolean }) {
	const total = plan.cost + plan.profit;
	return (
		<span className="block w-full text-left">
			<span className="block text-[10px] text-muted-foreground">Estimated sale · {plan.sellSourceLabel ?? "Unknown source"}</span>
			<span className="mt-1 block text-sm">
				<strong className="font-mono font-medium">{formatRoundedRoubles(plan.count > 0 ? total / plan.count : null)}</strong>
				<span className="ml-1 text-xs text-muted-foreground">each</span>
			</span>
			{!compact && plan.count !== 1 && (
				<span className="mt-0.5 block text-[11px] text-muted-foreground">
					×{formatQuantity(plan.count)} · <span className="font-mono">{formatRoundedRoubles(total)}</span> total
				</span>
			)}
		</span>
	);
}
